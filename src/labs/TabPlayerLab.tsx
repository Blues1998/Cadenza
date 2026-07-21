import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlphaTabApi, synth, model, FileLoadError } from '@coderline/alphatab';
import { Term } from '../components/Term';
import { TAB_TECHNIQUES } from '../utils/glossary';
import {
  tabIdForFileName,
  saveTabToLibrary,
  updateTabMeta,
  listLibraryTabs,
  loadTabBlob,
  deleteTabFromLibrary
} from '../utils/tabLibrary';
import type { TabLibraryEntry } from '../utils/tabLibrary';
import { GUITAR_SOUNDFONT_URL, GUITAR_TONES, DEFAULT_GUITAR_TONE, toneKey, setScoreInstrument } from '../utils/guitarTones';
import { useMicPitch } from '../hooks/useMicPitch';
import { NOTE_NAMES } from '../utils/musicTheory';

const ACCEPTED_EXTENSIONS = '.gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.xml';

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// The hoverable region for a beat is a full-height column: horizontally a
// centered slice of the beat's own slot (its realBounds spans the whole
// rhythmic slot including the whitespace separating it from its neighbors —
// too wide to feel like "pointing at the note"), vertically the bar's full
// span across both the notation and tab staves (masterBarBounds — the same
// vertical extent alphaTab's own bar-cursor band uses). No guessed offsets:
// the notation glyphs, the technique letters between the staves, and the
// tab numbers all fall inside that column, and the highlight box draws this
// exact same rectangle, so what lights up is precisely what's hoverable.
const HOVER_WIDTH_FOCUS = 0.5; // fraction of the beat's own width to keep, centered
const HOVER_MIN_WIDTH = 18;
const HOVER_MARGIN = 4;
// Shared by both the hover-explanation box and the mic play-along grading
// box below — both are the same kind of "outline this beat" overlay.
const HIGHLIGHT_PADDING = 4;

type Box = { x: number; y: number; w: number; h: number };
function beatHoverColumn(beatBox: Box, barBox: Box): Box {
  const focusWidth = Math.max(Math.min(beatBox.w, HOVER_MIN_WIDTH), beatBox.w * HOVER_WIDTH_FOCUS);
  const insetX = (beatBox.w - focusWidth) / 2;
  return { x: beatBox.x + insetX, y: barBox.y, w: beatBox.w - insetX * 2, h: barBox.h };
}
function isNearBounds(x: number, y: number, box: Box): boolean {
  return (
    x >= box.x - HOVER_MARGIN &&
    x <= box.x + box.w + HOVER_MARGIN &&
    y >= box.y - HOVER_MARGIN &&
    y <= box.y + box.h + HOVER_MARGIN
  );
}

// How long the user gets to browse freely after a manual scroll before
// playback auto-follow resumes.
const BROWSE_GRACE_PERIOD_MS = 2000;

// Remembers the hover-tooltip on/off preference across visits — most people
// only need the explanations a handful of times before they've learned them.
const TOOLTIPS_ENABLED_STORAGE_KEY = 'cadenza-tab-player-tooltips-enabled';

// Fixed display order for the always-visible legend strip.
const LEGEND_KEYS = Object.keys(TAB_TECHNIQUES);

// Reads which technique markings apply to a beat, so hovering a note can
// explain exactly what's drawn on it (hammer-on vs. pull-off share the same
// underlying flag and are told apart by comparing fret numbers).
function detectBeatTechniques(beat: model.Beat): string[] {
  const found: string[] = [];
  const add = (key: string) => { if (!found.includes(key)) found.push(key); };

  if (beat.isPalmMute) add('palmMute');
  if (beat.isLetRing) add('letRing');
  if (beat.isTremolo) add('tremoloPicking');

  for (const note of beat.notes) {
    if (note.isHammerPullOrigin) {
      const dest = note.hammerPullDestination;
      add(!dest || dest.fret >= note.fret ? 'hammerOn' : 'pullOff');
    }
    if (note.slideInType !== model.SlideInType.None || note.slideOutType !== model.SlideOutType.None) add('slide');
    if (note.hasBend) add(note.bendType === model.BendType.Release ? 'bendRelease' : 'bend');
    if (note.vibrato !== model.VibratoType.None) add('vibrato');
    if (note.isGhost) add('ghostNote');
    if (note.isDead) add('deadNote');
    if (note.isHarmonic) add('harmonic');
    if (note.isTieDestination) add('tie');
    if (note.isStaccato) add('staccato');
    if (note.isTrill) add('trill');
  }

  return found;
}

// ---- Mic-verified play-along ----
// Reuses the same mic -> YIN pitch-detection pipeline as Play Challenges,
// but instead of the player pacing themselves note-by-note, grading is
// paced by the tab's own moving cursor: alphaTab's activeBeatsChanged event
// fires in real time, in sync with actual audio playback, whenever the set
// of currently-sounding beats changes — exactly the same signal that drives
// alphaTab's own built-in cursor highlight. Driving grading off that event
// (rather than pre-computing tick-based time windows ourselves) means it
// automatically accounts for tempo, playback-speed changes, and repeats
// with zero extra bookkeeping, and sidesteps the whole class of
// structural-vs-repeat-expanded-tick bug this session already had to fix
// once for the Ear Training tab source.
const GRADE_CENTS_TOLERANCE = 45; // matches Play Challenges' own matching tolerance
const RECENT_RESULTS_CAP = 24;

interface GradeTarget {
  beat: model.Beat;
  pitchClass: number; // 0-11, matched ignoring octave — mic octave detection
                       // errors are common enough on guitar that Play
                       // Challenges already treats "any octave counts" as a
                       // deliberate, forgiving default; this keeps that
                       // convention rather than inventing a stricter one.
  label: string; // e.g. "E4", for the recent-results strip
}

interface GradeResult {
  id: number; // beat.id, React key
  label: string;
  hit: boolean;
}

// Reads grading info straight off whatever Beat instance the playback
// engine hands us via activeBeatsChanged, rather than pre-matching against
// beats collected by walking api.score ourselves — Beat carries a
// @clone_ignore'd id, so a beat handed back by the player isn't guaranteed
// to share identity (or even .id) with the one found by tree-walking the
// score, but it always carries the same notes/voice/bar data either way.
// Only single, freshly-picked notes are gradable: a chord can't be verified
// note-by-note through one monophonic pitch detector, a rest has nothing to
// play, and a tied note isn't something the player re-picks (they just let
// the previous note ring) — grading any of those would be meaningless.
function gradeTargetFromBeat(beat: model.Beat): GradeTarget | null {
  if (beat.voice.bar.staff.track.index !== 0) return null;
  if (beat.isRest || beat.notes.length !== 1) return null;
  const note = beat.notes[0];
  if (note.isTieDestination) return null;
  const pitchClass = ((note.realValue % 12) + 12) % 12;
  const octave = Math.floor(note.realValue / 12) - 1;
  return { beat, pitchClass, label: `${NOTE_NAMES[pitchClass]}${octave}` };
}

export const TabPlayerLab: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaTabApi | null>(null);
  const isPlayingRef = useRef(false);
  const userBrowsingRef = useRef(false);
  const browsingTimeoutRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);

  const [scoreTitle, setScoreTitle] = useState<string>('');
  const [scoreArtist, setScoreArtist] = useState<string>('');
  const [trackNames, setTrackNames] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [looping, setLooping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ current: 0, end: 0 });
  const [guitarTone, setGuitarTone] = useState(DEFAULT_GUITAR_TONE);
  const [guitarSoundfontMissing, setGuitarSoundfontMissing] = useState(false);
  const [sectionRange, setSectionRange] = useState<{ startBar: number; endBar: number } | null>(null);
  const dragStartBeatRef = useRef<model.Beat | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; techniques: string[] } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(() => {
    try {
      return localStorage.getItem(TOOLTIPS_ENABLED_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const tooltipsEnabledRef = useRef(tooltipsEnabled);
  const highlightElRef = useRef<HTMLDivElement | null>(null);

  // Mic-verified play-along: see the "Mic-verified play-along" comment block
  // above gradeTargetFromBeat for the overall design.
  const { pitch: micPitch, isActive: micActive, error: micError, start: startMic, stop: stopMic } = useMicPitch();
  const [micGradingEnabled, setMicGradingEnabled] = useState(false);
  // True only once the toggle is on AND the mic has actually come online —
  // the single gate both the activeBeatsChanged handler and the live pitch
  // effect check, so neither has to separately track both conditions.
  const micGradingLiveRef = useRef(false);
  const [gradeStats, setGradeStats] = useState({ hits: 0, misses: 0 });
  const [recentResults, setRecentResults] = useState<GradeResult[]>([]);
  const [currentTargetLabel, setCurrentTargetLabel] = useState<string | null>(null);
  const pendingTargetRef = useRef<GradeTarget | null>(null);
  const pendingResolvedRef = useRef(false);
  const gradeHighlightElRef = useRef<HTMLDivElement | null>(null);
  const gradeFadeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    micGradingLiveRef.current = micGradingEnabled && micActive;
  }, [micGradingEnabled, micActive]);

  const positionGradeBox = useCallback((beat: model.Beat): boolean => {
    const api = apiRef.current;
    const el = gradeHighlightElRef.current;
    if (!api?.boundsLookup || !el) return false;
    const beatBounds = api.boundsLookup.findBeat(beat);
    if (!beatBounds) return false;
    const box = beatHoverColumn(beatBounds.realBounds, beatBounds.barBounds.masterBarBounds.visualBounds);
    el.style.left = `${box.x - HIGHLIGHT_PADDING}px`;
    el.style.top = `${box.y - HIGHLIGHT_PADDING}px`;
    el.style.width = `${box.w + HIGHLIGHT_PADDING * 2}px`;
    el.style.height = `${box.h + HIGHLIGHT_PADDING * 2}px`;
    return true;
  }, []);

  const hideGradeHighlight = useCallback(() => {
    if (gradeFadeTimeoutRef.current !== null) {
      window.clearTimeout(gradeFadeTimeoutRef.current);
      gradeFadeTimeoutRef.current = null;
    }
    if (gradeHighlightElRef.current) gradeHighlightElRef.current.style.opacity = '0';
  }, []);

  // "Listening" state: amber outline drawn the moment a gradable beat
  // becomes current, before we know yet whether it'll be hit or missed.
  const showPendingBox = useCallback((beat: model.Beat) => {
    if (gradeFadeTimeoutRef.current !== null) {
      window.clearTimeout(gradeFadeTimeoutRef.current);
      gradeFadeTimeoutRef.current = null;
    }
    const el = gradeHighlightElRef.current;
    if (!el || !positionGradeBox(beat)) return;
    el.style.borderColor = 'rgba(245, 158, 11, 0.9)';
    el.style.background = 'rgba(245, 158, 11, 0.12)';
    el.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
    el.style.opacity = '1';
  }, [positionGradeBox]);

  // Flashes green/red over the box already positioned by showPendingBox,
  // then fades it out — a brief result flash rather than a mark left
  // sitting on the notation forever, since the cursor keeps moving on.
  const flashResultBox = useCallback((hit: boolean) => {
    const el = gradeHighlightElRef.current;
    if (!el) return;
    el.style.borderColor = hit ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
    el.style.background = hit ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)';
    el.style.boxShadow = hit ? '0 0 14px rgba(16, 185, 129, 0.5)' : '0 0 14px rgba(239, 68, 68, 0.5)';
    el.style.opacity = '1';
    if (gradeFadeTimeoutRef.current !== null) window.clearTimeout(gradeFadeTimeoutRef.current);
    gradeFadeTimeoutRef.current = window.setTimeout(() => {
      el.style.opacity = '0';
      gradeFadeTimeoutRef.current = null;
    }, 400);
  }, []);

  // Resolves the currently-open grading window exactly once — called either
  // the instant a correct pitch is heard (see the pitch-matching effect
  // below), or when the window closes without one (a new beat became
  // current, or playback paused/stopped) with no match ever recorded.
  const resolvePending = useCallback((hit: boolean) => {
    const target = pendingTargetRef.current;
    if (!target || pendingResolvedRef.current) return;
    pendingResolvedRef.current = true;
    setGradeStats(s => (hit ? { ...s, hits: s.hits + 1 } : { ...s, misses: s.misses + 1 }));
    setRecentResults(prev => {
      const next = [...prev, { id: target.beat.id, label: target.label, hit }];
      return next.length > RECENT_RESULTS_CAP ? next.slice(next.length - RECENT_RESULTS_CAP) : next;
    });
    flashResultBox(hit);
  }, [flashResultBox]);

  // Grades in real time as pitch readings arrive (~60/s while the mic is
  // active) rather than waiting for the window to close, so a correctly
  // played note flashes green immediately instead of a beat later.
  useEffect(() => {
    if (!micGradingLiveRef.current || !isPlayingRef.current) return;
    const target = pendingTargetRef.current;
    if (!target || pendingResolvedRef.current || !micPitch) return;
    const heardPc = ((micPitch.midi % 12) + 12) % 12;
    if (heardPc === target.pitchClass && Math.abs(micPitch.cents) <= GRADE_CENTS_TOLERANCE) {
      resolvePending(true);
    }
  }, [micPitch, resolvePending]);

  const toggleMicGrading = () => {
    if (micGradingEnabled) {
      setMicGradingEnabled(false);
      stopMic();
    } else {
      setMicGradingEnabled(true);
      startMic();
    }
    pendingTargetRef.current = null;
    pendingResolvedRef.current = false;
    setCurrentTargetLabel(null);
    hideGradeHighlight();
  };

  const resetGradeStats = () => {
    setGradeStats({ hits: 0, misses: 0 });
    setRecentResults([]);
  };

  // Local library: recently opened tabs persisted in IndexedDB (see
  // src/utils/tabLibrary.ts) so a piece doesn't need re-dragging every
  // session, and reopening one resumes its saved position/tempo/tone.
  const [libraryEntries, setLibraryEntries] = useState<TabLibraryEntry[]>([]);
  const currentTabIdRef = useRef<string | null>(null);
  const pendingImportRef = useRef<{ fileName: string; data: ArrayBuffer } | null>(null);
  const pendingRestoreRef = useRef<{
    lastPositionMs: number;
    tempoPct: number;
    guitarTone: { bank: number; program: number };
  } | null>(null);
  const guitarToneRef = useRef(guitarTone);
  useEffect(() => {
    guitarToneRef.current = guitarTone;
  }, [guitarTone]);

  const refreshLibrary = useCallback(() => {
    listLibraryTabs().then(setLibraryEntries).catch(() => {});
  }, []);
  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Reads live playback state straight off the api (always current, unlike
  // React state closed over at mount), so this can be called from a
  // setInterval, a pause event, or a tempo/tone change alike.
  const persistCurrentTab = useCallback((overrides?: { guitarTone?: { bank: number; program: number }; tempoPct?: number }) => {
    const id = currentTabIdRef.current;
    const api = apiRef.current;
    if (!id || !api?.score) return;
    updateTabMeta(id, {
      lastPositionMs: api.timePosition,
      durationMs: api.endTime,
      tempoPct: overrides?.tempoPct ?? Math.round(api.playbackSpeed * 100),
      guitarTone: overrides?.guitarTone ?? guitarToneRef.current,
      lastOpenedAt: Date.now()
    }).catch(() => {});
  }, []);

  useEffect(() => {
    tooltipsEnabledRef.current = tooltipsEnabled;
    if (!tooltipsEnabled) {
      setHoverInfo(null);
      if (highlightElRef.current) highlightElRef.current.style.opacity = '0';
    }
    // Best-effort only: a storage exception (private-browsing quirks, etc.)
    // must never block clearing the tooltip/highlight state above.
    try {
      localStorage.setItem(TOOLTIPS_ENABLED_STORAGE_KEY, String(tooltipsEnabled));
    } catch {
      // ignore
    }
  }, [tooltipsEnabled]);

  // Set up the AlphaTabApi instance once against the viewport div.
  useEffect(() => {
    if (!viewportRef.current) return;

    const viewport = viewportRef.current;

    const api = new AlphaTabApi(viewport, {
      core: {
        fontDirectory: '/font/'
      },
      player: {
        enablePlayer: true,
        playerMode: 'EnabledAutomatic',
        soundFont: '/soundfont/sonivox.sf2',
        enableCursor: true,
        // A non-Off mode is required for alphaTab to dispatch scroll updates
        // at all, but the actual behavior comes entirely from
        // customScrollHandler below — it implements "follow, but pause while
        // the user is browsing", not alphaTab's built-in "always snap to
        // the cursor" (which would fight any attempt to scroll away).
        scrollMode: 'Continuous',
        scrollElement: viewport
      }
    });
    apiRef.current = api;

    // Animates scrollTop ourselves (instead of the native
    // scrollTo({behavior:'smooth'}), whose actual duration is entirely
    // browser-determined and not something we can know) so we always know
    // exactly when our own scroll starts and ends — that precision is what
    // lets the manual-scroll guard below be exact instead of guessed.
    let scrollAnimationFrame: number | null = null;
    const animateScrollTo = (targetTop: number, durationMs: number) => {
      if (scrollAnimationFrame !== null) cancelAnimationFrame(scrollAnimationFrame);
      const startTop = viewport.scrollTop;
      const distance = targetTop - startTop;
      const startTime = performance.now();
      isAutoScrollingRef.current = true;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - (1 - t) ** 3; // ease-out cubic
        viewport.scrollTop = startTop + distance * eased;
        if (t < 1) {
          scrollAnimationFrame = requestAnimationFrame(step);
        } else {
          scrollAnimationFrame = null;
          isAutoScrollingRef.current = false;
        }
      };
      scrollAnimationFrame = requestAnimationFrame(step);
    };

    // Scrolls so the given bar lands about a quarter of the way down the
    // viewport. Uses alphaTab's own authoritative layout bounds (the Y
    // position it just computed for this exact beat) rather than reading
    // the cursor element's DOM position back out, which can briefly lag a
    // frame behind.
    const scrollToBar = (barY: number, durationMs: number) => {
      const target = Math.max(0, barY - viewport.clientHeight * 0.25);
      if (Math.abs(target - viewport.scrollTop) < 2) return;
      animateScrollTo(target, durationMs);
    };

    api.customScrollHandler = {
      // Deliberate "jump to the cursor now" — used by our own
      // api.scrollToCursor() calls below, always honored.
      forceScrollTo(currentBeatBounds) {
        scrollToBar(currentBeatBounds.barBounds.masterBarBounds.realBounds.y, 400);
      },
      // Fires continuously as the beat cursor advances during playback.
      // Only act if the user isn't browsing, nothing's already animating
      // (never stack a new scroll on top of one still in flight), and the
      // bar has actually drifted near the edge of the visible pane — checked
      // at both its top and bottom edge, so a tall system (lots of
      // fingerings/annotations) triggers a follow as soon as either end
      // gets close, not only once its top edge does.
      onBeatCursorUpdating(startBeat) {
        if (userBrowsingRef.current || isAutoScrollingRef.current) return;
        const bounds = startBeat.barBounds.masterBarBounds.realBounds;
        const relativeTop = bounds.y - viewport.scrollTop;
        const relativeBottom = bounds.y + bounds.h - viewport.scrollTop;
        const margin = viewport.clientHeight * 0.15;
        if (relativeTop < margin || relativeBottom > viewport.clientHeight - margin) {
          scrollToBar(bounds.y, 350);
        }
      },
      [Symbol.dispose]() {
        if (scrollAnimationFrame !== null) cancelAnimationFrame(scrollAnimationFrame);
      }
    };

    const handleManualScroll = () => {
      if (isAutoScrollingRef.current) return; // our own scroll, not the user's
      userBrowsingRef.current = true;
      if (browsingTimeoutRef.current !== null) window.clearTimeout(browsingTimeoutRef.current);
      browsingTimeoutRef.current = window.setTimeout(() => {
        userBrowsingRef.current = false;
        if (isPlayingRef.current) api.scrollToCursor();
      }, BROWSE_GRACE_PERIOD_MS);
    };
    viewport.addEventListener('scroll', handleManualScroll);

    // Highlights whichever note the hover tooltip is currently explaining.
    // Plain, imperatively-managed DOM (not React-rendered) since it lives
    // inside the same container alphaTab itself injects its cursor/selection
    // overlays into — React never gets a say over that div's children.
    const highlightEl = document.createElement('div');
    highlightEl.style.position = 'absolute';
    highlightEl.style.pointerEvents = 'none';
    highlightEl.style.border = '2px solid rgba(0, 240, 255, 0.9)';
    highlightEl.style.borderRadius = '6px';
    highlightEl.style.background = 'rgba(0, 240, 255, 0.1)';
    highlightEl.style.boxShadow = '0 0 12px rgba(0, 240, 255, 0.45)';
    highlightEl.style.opacity = '0';
    highlightEl.style.transition = 'opacity 0.12s ease';
    // alphaTab's own cursor overlay wrapper (.at-cursors) is explicitly
    // z-index 1000, so this needs to clear that to actually be visible on
    // top of it rather than silently render underneath.
    highlightEl.style.zIndex = '1001';
    viewport.appendChild(highlightEl);
    highlightElRef.current = highlightEl;

    // Mic play-along's own grading box — same imperative overlay pattern as
    // the hover-explanation box above, kept as a separate element (rather
    // than repurposing highlightEl) since the two are shown for unrelated
    // reasons and could otherwise legitimately need to be visible together.
    // One layer above the hover box so a result flash never hides under it.
    const gradeHighlightEl = document.createElement('div');
    gradeHighlightEl.style.position = 'absolute';
    gradeHighlightEl.style.pointerEvents = 'none';
    gradeHighlightEl.style.border = '2px solid transparent';
    gradeHighlightEl.style.borderRadius = '6px';
    gradeHighlightEl.style.opacity = '0';
    gradeHighlightEl.style.transition = 'opacity 0.15s ease';
    gradeHighlightEl.style.zIndex = '1002';
    viewport.appendChild(gradeHighlightEl);
    gradeHighlightElRef.current = gradeHighlightEl;

    // Explains tab notation on hover: alphaTab's own mouse-move event only
    // fires while a beat is already pressed (used for drag-to-select above),
    // so a plain hover has to be done ourselves via api.boundsLookup, which
    // maps a raw x/y position back to the beat rendered there. Coordinates
    // are relative to the unscrolled content's own origin, which sits inset
    // from the viewport's border-box (what getBoundingClientRect reports) by
    // the viewport's own padding — that inset has to be subtracted back out,
    // or every hit-test lands a few pixels away from whatever was clicked.
    let hoverFrame: number | null = null;
    const updateHoverAt = (clientX: number, clientY: number) => {
      if (!tooltipsEnabledRef.current) return;
      const boundsLookup = api.boundsLookup;
      if (!boundsLookup) return;
      const rect = viewport.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const insetLeft = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);
      const insetTop = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
      const contentX = clientX - rect.left - insetLeft + viewport.scrollLeft;
      const contentY = clientY - rect.top - insetTop + viewport.scrollTop;
      const beat = boundsLookup.getBeatAtPos(contentX, contentY);
      const beatBounds = beat ? boundsLookup.findBeat(beat) : null;
      const box = beatBounds
        ? beatHoverColumn(beatBounds.realBounds, beatBounds.barBounds.masterBarBounds.visualBounds)
        : undefined;
      const isNear = box ? isNearBounds(contentX, contentY, box) : false;
      const techniques = beat && isNear ? detectBeatTechniques(beat) : [];
      if (!beat || !isNear || techniques.length === 0) {
        setHoverInfo(null);
        highlightEl.style.opacity = '0';
        return;
      }
      setHoverInfo({ x: clientX, y: clientY, techniques });
      if (box) {
        highlightEl.style.left = `${box.x - HIGHLIGHT_PADDING}px`;
        highlightEl.style.top = `${box.y - HIGHLIGHT_PADDING}px`;
        highlightEl.style.width = `${box.w + HIGHLIGHT_PADDING * 2}px`;
        highlightEl.style.height = `${box.h + HIGHLIGHT_PADDING * 2}px`;
        highlightEl.style.opacity = '1';
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (hoverFrame !== null) return;
      const { clientX, clientY } = e;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        updateHoverAt(clientX, clientY);
      });
    };
    const handleMouseLeave = () => {
      if (hoverFrame !== null) {
        cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      setHoverInfo(null);
      highlightEl.style.opacity = '0';
    };
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) updateHoverAt(touch.clientX, touch.clientY);
    };
    viewport.addEventListener('mousemove', handleMouseMove);
    viewport.addEventListener('mouseleave', handleMouseLeave);
    viewport.addEventListener('touchstart', handleTouchStart);

    // loadSoundFont() silently no-ops until the internal player exists,
    // which isn't the case yet right after construction — so wait for the
    // base GM soundfont to actually finish loading before appending the
    // higher-quality guitar samples on top of it. Guard against re-firing
    // for our own appended font's completion.
    let guitarFontAppended = false;
    api.soundFontLoaded.on(() => {
      if (guitarFontAppended) return;
      guitarFontAppended = true;
      api.loadSoundFont(GUITAR_SOUNDFONT_URL, true);
    });

    api.error.on((e) => {
      console.error('alphaTab error', e);
      // Soundfont load failures (e.g. missing guitar samples) surface here
      // too — alphaTab funnels them into the same `error` event.
      if (e instanceof FileLoadError && e.xhr.responseURL.includes('/instruments/')) {
        setGuitarSoundfontMissing(true);
      } else {
        setError(e.message || 'Could not load this file.');
      }
    });
    // alphaTab's default mouse interaction (on by default via
    // player.enableUserInteraction) already turns click-drag on the notation
    // into a real api.playbackRange, and a plain click clears it — we just
    // track the same start/end beat identities ourselves to know the bar
    // numbers for our own display, and to auto-enable looping once a section
    // is actually selected (a drag, not a plain click-to-seek).
    api.beatMouseDown.on((beat) => {
      dragStartBeatRef.current = beat;
    });
    api.beatMouseUp.on((beat) => {
      const startBeat = dragStartBeatRef.current;
      dragStartBeatRef.current = null;
      if (startBeat && beat && startBeat !== beat) {
        setSectionRange({
          startBar: Math.min(startBeat.voice.bar.index, beat.voice.bar.index),
          endBar: Math.max(startBeat.voice.bar.index, beat.voice.bar.index)
        });
        setLooping(true);
        api.isLooping = true;
      } else {
        setSectionRange(null);
      }
    });

    // Mic play-along grading: fires in real time, synced to actual audio
    // playback, whenever the set of currently-sounding beats changes — the
    // same signal that drives alphaTab's own cursor. See the design comment
    // above gradeTargetFromBeat for why this beats pre-computed tick windows.
    api.activeBeatsChanged.on((args) => {
      if (!micGradingLiveRef.current || !isPlayingRef.current) return;

      let matched: GradeTarget | null = null;
      for (const b of args.activeBeats) {
        const t = gradeTargetFromBeat(b);
        if (t) {
          matched = t;
          break;
        }
      }

      // Known limitation: a section loop of exactly one gradable note re-
      // triggers this same id on every lap, which reads identically to "the
      // one ongoing note hasn't changed yet" — so only the first lap grades.
      // Looping two or more notes (the realistic case) is unaffected, since
      // the loop's own first beat always differs in id from its last.
      const openId = pendingTargetRef.current?.beat.id ?? null;
      const matchedId = matched?.beat.id ?? null;
      if (matchedId === openId) return; // same target still current, nothing to resolve or open

      if (openId !== null && !pendingResolvedRef.current) resolvePending(false);

      pendingTargetRef.current = matched;
      pendingResolvedRef.current = false;
      if (matched) {
        setCurrentTargetLabel(matched.label);
        showPendingBox(matched.beat);
      } else {
        setCurrentTargetLabel(null);
        hideGradeHighlight();
      }
    });

    api.scoreLoaded.on((score) => {
      setScoreTitle(score.title || 'Untitled');
      setScoreArtist(score.artist || '');
      setTrackNames(score.tracks.map(t => t.name || 'Track'));
      setError(null);
      setSectionRange(null);
      setHoverInfo(null);
      highlightEl.style.opacity = '0';

      // A new score invalidates any in-flight grading window and starts a
      // fresh scoreboard — stats from a previous piece shouldn't bleed in.
      pendingTargetRef.current = null;
      pendingResolvedRef.current = false;
      setCurrentTargetLabel(null);
      hideGradeHighlight();
      setGradeStats({ hits: 0, misses: 0 });
      setRecentResults([]);

      // Every loaded tab defaults to the nylon classical tone regardless of
      // what the file itself specifies — this player is for guitar practice —
      // unless we're reopening a piece that had a different tone/tempo saved.
      const restore = pendingRestoreRef.current;
      const tone = restore?.guitarTone ?? DEFAULT_GUITAR_TONE;
      setScoreInstrument(score, tone.bank, tone.program);
      setGuitarTone(GUITAR_TONES.find(t => t.bank === tone.bank && t.program === tone.program) ?? DEFAULT_GUITAR_TONE);
      const tempoToUse = restore?.tempoPct ?? 100;
      setTempoPct(tempoToUse);
      api.playbackSpeed = tempoToUse / 100;
      api.loadMidiForScore();

      const pending = pendingImportRef.current;
      if (pending) {
        // Freshly dropped/browsed file — save it into the library now that
        // the score's title/artist are known for nicer display.
        pendingImportRef.current = null;
        saveTabToLibrary(pending.fileName, pending.data, {
          title: score.title || pending.fileName,
          artist: score.artist || '',
          lastOpenedAt: Date.now(),
          lastPositionMs: restore?.lastPositionMs ?? 0,
          durationMs: 0,
          tempoPct: tempoToUse,
          guitarTone: tone
        }).then((id) => {
          currentTabIdRef.current = id;
          refreshLibrary();
        }).catch(() => {});
      } else if (currentTabIdRef.current) {
        // Reopened from the library — bump it to the top of the list.
        updateTabMeta(currentTabIdRef.current, { lastOpenedAt: Date.now() }).then(refreshLibrary).catch(() => {});
      }
    });
    api.playerStateChanged.on((args) => {
      const playing = args.state === synth.PlayerState.Playing;
      isPlayingRef.current = playing;
      setIsPlaying(playing);
      // Reorient immediately when playback (re)starts, in case the user
      // browsed away while paused.
      if (playing && !userBrowsingRef.current) api.scrollToCursor();
      if (!playing) {
        persistCurrentTab();
        // Every opened grading window must resolve exactly once — pausing
        // or stopping mid-note closes it out as a miss rather than leaving
        // it dangling (which would otherwise either silently eat the next
        // window's open, or double-count if playback resumes later).
        if (pendingTargetRef.current && !pendingResolvedRef.current) resolvePending(false);
        pendingTargetRef.current = null;
        pendingResolvedRef.current = false;
        setCurrentTargetLabel(null);
        hideGradeHighlight();
      }
    });
    api.playerReady.on(() => {
      setIsReady(true);
      // Resume where we left off, if this score was reopened from the library.
      const restore = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      if (restore && restore.lastPositionMs > 0) {
        api.timePosition = restore.lastPositionMs;
        api.scrollToCursor();
      }
    });
    api.playerPositionChanged.on((args) => {
      setPosition({ current: args.currentTime, end: args.endTime });
    });

    // Best-effort autosave of position/tempo/tone while a library-tracked
    // tab is open, so "continue where you left off" stays accurate even if
    // the tab is just closed outright instead of explicitly paused.
    const persistInterval = window.setInterval(persistCurrentTab, 5000);

    return () => {
      window.clearInterval(persistInterval);
      persistCurrentTab();
      viewport.removeEventListener('scroll', handleManualScroll);
      viewport.removeEventListener('mousemove', handleMouseMove);
      viewport.removeEventListener('mouseleave', handleMouseLeave);
      viewport.removeEventListener('touchstart', handleTouchStart);
      if (browsingTimeoutRef.current !== null) window.clearTimeout(browsingTimeoutRef.current);
      if (scrollAnimationFrame !== null) cancelAnimationFrame(scrollAnimationFrame);
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      highlightEl.remove();
      highlightElRef.current = null;
      if (gradeFadeTimeoutRef.current !== null) window.clearTimeout(gradeFadeTimeoutRef.current);
      gradeHighlightEl.remove();
      gradeHighlightElRef.current = null;
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  const loadFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    // Re-dropping a file already in the library should resume its saved
    // progress rather than reset it — check before scoreLoaded fires.
    const existing = libraryEntries.find(e => e.id === tabIdForFileName(file.name));
    pendingImportRef.current = { fileName: file.name, data: buf };
    pendingRestoreRef.current = existing
      ? { lastPositionMs: existing.lastPositionMs, tempoPct: existing.tempoPct, guitarTone: existing.guitarTone }
      : null;
    currentTabIdRef.current = existing?.id ?? null;
    apiRef.current?.load(new Uint8Array(buf));
  };

  const loadFromLibrary = async (entry: TabLibraryEntry) => {
    const data = await loadTabBlob(entry.id);
    if (!data || !apiRef.current) return;
    pendingImportRef.current = null;
    pendingRestoreRef.current = {
      lastPositionMs: entry.lastPositionMs,
      tempoPct: entry.tempoPct,
      guitarTone: entry.guitarTone
    };
    currentTabIdRef.current = entry.id;
    apiRef.current.load(new Uint8Array(data));
  };

  const handleDeleteFromLibrary = (id: string) => {
    if (currentTabIdRef.current === id) currentTabIdRef.current = null;
    deleteTabFromLibrary(id).then(refreshLibrary).catch(() => {});
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleTempoChange = (pct: number) => {
    setTempoPct(pct);
    if (apiRef.current) apiRef.current.playbackSpeed = pct / 100;
    persistCurrentTab({ tempoPct: pct });
  };

  const toggleLoop = () => {
    const next = !looping;
    setLooping(next);
    if (apiRef.current) apiRef.current.isLooping = next;
  };

  const clearSection = () => {
    const api = apiRef.current;
    if (!api) return;
    api.playbackRange = null;
    api.clearPlaybackRangeHighlight();
    setSectionRange(null);
  };

  const applyGuitarTone = (bank: number, program: number) => {
    const api = apiRef.current;
    if (!api?.score) return;
    setScoreInstrument(api.score, bank, program);
    api.loadMidiForScore();
    const tone = GUITAR_TONES.find(t => t.bank === bank && t.program === program);
    if (tone) setGuitarTone(tone);
    persistCurrentTab({ guitarTone: { bank, program } });
  };

  const hasScore = scoreTitle !== '';
  const gradedTotal = gradeStats.hits + gradeStats.misses;
  const gradeAccuracyPct = gradedTotal > 0 ? Math.round((gradeStats.hits / gradedTotal) * 100) : null;

  return (
    <section className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Tab Player</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Import a Guitar Pro (.gp3, .gp4, .gp5, .gpx) or MusicXML file and play it back right here —
          slow the tempo down to isolate the hard parts, loop them, and practice along on your real instrument.
        </p>
      </div>

      {libraryEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Your Library</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {libraryEntries.map(entry => (
              <div
                key={entry.id}
                onClick={() => loadFromLibrary(entry)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
                  padding: '0.65rem 0.9rem', borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title || entry.fileName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {entry.artist ? `${entry.artist} · ` : ''}
                    {entry.durationMs > 0 ? `${formatTime(entry.lastPositionMs)} / ${formatTime(entry.durationMs)} · ` : ''}
                    {formatRelativeTime(entry.lastOpenedAt)}
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFromLibrary(entry.id); }}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', flexShrink: 0 }}
                  title="Remove from library"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone / file picker */}
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          padding: '1.25rem', borderRadius: '12px', cursor: 'pointer',
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}`,
          background: isDragging ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255,255,255,0.015)',
          transition: 'border-color 0.15s ease, background 0.15s ease'
        }}
      >
        <input type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileInput} style={{ display: 'none' }} />
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Drop a tab file here, or click to browse ({ACCEPTED_EXTENSIONS})
        </span>
      </label>

      {error && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {guitarSoundfontMissing && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)', fontSize: '0.85rem' }}>
          The high-quality guitar samples didn't load, so playback will fall back to a generic synth sound.
          Run <code>npm run setup:soundfont</code> in the project to fetch them.
        </div>
      )}

      {hasScore && (
        <>
          {/* Score info + transport controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{scoreTitle}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {scoreArtist ? `${scoreArtist} · ` : ''}{trackNames.join(', ')}
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {formatTime(position.current)} / {formatTime(position.end)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                disabled={!isReady}
                onClick={() => apiRef.current?.playPause()}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button className="btn" onClick={() => apiRef.current?.stop()} style={{ padding: '0.5rem 1rem' }}>
                Stop
              </button>
              <button
                className="btn"
                onClick={toggleLoop}
                style={{
                  padding: '0.5rem 1rem',
                  borderColor: looping ? 'var(--primary)' : undefined,
                  color: looping ? 'var(--primary)' : undefined
                }}
              >
                {sectionRange ? 'Loop Section' : 'Loop'} {looping ? 'On' : 'Off'}
              </button>
              {sectionRange && (
                <button
                  className="btn"
                  onClick={clearSection}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
                  title="Clear the selected section and loop the whole song instead"
                >
                  Clear Bars {sectionRange.startBar + 1}–{sectionRange.endBar + 1}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '260px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Tempo</span>
              <input
                type="range"
                min={25}
                max={150}
                step={5}
                value={tempoPct}
                onChange={(e) => handleTempoChange(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, width: '3.2rem', textAlign: 'right' }}>
                {tempoPct}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Guitar</span>
              <select
                value={toneKey(guitarTone.bank, guitarTone.program)}
                onChange={(e) => {
                  const [bank, program] = e.target.value.split(':').map(Number);
                  applyGuitarTone(bank, program);
                }}
                style={{ background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', color: '#fff', outline: 'none', fontSize: '0.8rem' }}
              >
                {GUITAR_TONES.map(t => <option key={toneKey(t.bank, t.program)} value={toneKey(t.bank, t.program)}>{t.label}</option>)}
              </select>
            </div>

            {!isReady && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading sound engine…</span>
            )}
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Guitar samples: "Nylon and Steel Guitars" by Soundfonts4U, CC BY-NC-SA 4.0
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tip: click-drag across the notation to loop a passage
              {tooltipsEnabled && ', and hover any note to see what its markings (hammer-on, slide, palm mute…) mean'}.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn"
                onClick={() => setTooltipsEnabled(v => !v)}
                title="Explanations that pop up when you hover a note's technique marking"
                style={{
                  padding: '0.4rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap',
                  borderColor: tooltipsEnabled ? 'var(--primary)' : undefined,
                  color: tooltipsEnabled ? 'var(--primary)' : undefined
                }}
              >
                Hover Tips: {tooltipsEnabled ? 'On' : 'Off'}
              </button>
              <button
                className="btn"
                onClick={() => setShowLegend(v => !v)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                {showLegend ? 'Hide' : 'Show'} Tab Symbol Legend
              </button>
            </div>
          </div>

          {showLegend && (
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem',
                padding: '0.85rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.82rem', color: 'var(--text-secondary)'
              }}
            >
              {LEGEND_KEYS.map(key => (
                <Term key={key} k={key} source={TAB_TECHNIQUES}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, marginRight: '0.35rem' }}>
                    {TAB_TECHNIQUES[key].symbol}
                  </span>
                  {TAB_TECHNIQUES[key].title}
                </Term>
              ))}
            </div>
          )}

          {/* Mic-verified play-along: grades single-note melodic beats in
              real time against the mic as the cursor advances, using the
              exact same pitch-detection pipeline as Play Challenges. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: '10px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mic Play-Along</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem', maxWidth: '480px', lineHeight: 1.5 }}>
                  Play along on your real guitar as the cursor moves — each single note lights up green the instant your mic hears it, or red if the cursor moves on first.
                  Best with headphones: the mic can't otherwise tell your guitar apart from this tab's own backing track.
                </p>
              </div>
              <button
                className="btn"
                onClick={toggleMicGrading}
                style={{
                  padding: '0.4rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap',
                  borderColor: micGradingEnabled ? 'var(--primary)' : undefined,
                  color: micGradingEnabled ? 'var(--primary)' : undefined
                }}
              >
                Mic Play-Along: {micGradingEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {micError && (
              <div style={{ fontSize: '0.78rem', color: '#f87171' }}>{micError}</div>
            )}

            {micGradingEnabled && !micActive && !micError && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Waiting for microphone access…</div>
            )}

            {micGradingEnabled && micActive && (
              <>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--success)' }}>Hits: <strong>{gradeStats.hits}</strong></span>
                  <span style={{ color: 'var(--danger)' }}>Misses: <strong>{gradeStats.misses}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Accuracy: <strong>{gradeAccuracyPct === null ? '—' : `${gradeAccuracyPct}%`}</strong>
                  </span>
                  {currentTargetLabel && (
                    <span style={{ color: 'var(--text-muted)' }}>Now: <strong style={{ color: 'var(--warning)' }}>{currentTargetLabel}</strong></span>
                  )}
                  <button className="btn" onClick={resetGradeStats} style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}>
                    Reset Stats
                  </button>
                </div>

                {recentResults.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {recentResults.map((r, i) => (
                      <span
                        key={`${r.id}-${i}`}
                        style={{
                          padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                          border: `1px solid ${r.hit ? 'var(--success)' : 'var(--danger)'}`,
                          background: r.hit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: r.hit ? 'var(--success)' : 'var(--danger)'
                        }}
                      >
                        {r.hit ? '✓' : '✕'} {r.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* alphaTab's playback cursor divs (.at-cursor-bar/.at-cursor-beat) are
          injected into the DOM with no default styling at all — invisible
          until given a color, same story as the notation background. */}
      <style>{`
        .at-cursor-bar { background: rgba(0, 240, 255, 0.12); }
        .at-cursor-beat { background: #0090a8; width: 3px; }
        .at-highlight * { fill: #0090a8; stroke: #0090a8; }
        .at-selection div { background: rgba(0, 240, 255, 0.1); }
      `}</style>

      {/* alphaTab draws notation in dark ink meant for a page, so this stays
          white regardless of the app's dark theme */}
      <div
        ref={viewportRef}
        style={{
          minHeight: hasScore ? '400px' : '120px',
          maxHeight: hasScore ? '65vh' : undefined,
          overflow: 'auto',
          background: hasScore ? '#ffffff' : '#0b0c10',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: hasScore ? '1rem' : 0
        }}
      />

      {/* Floating explanation for whatever technique marking is under the
          cursor right now — same visual language as the <Term> tooltips
          above, just following the mouse instead of being pinned to static
          text, since alphaTab renders the notation itself (not our JSX).
          Portaled straight to <body>: the panel this section lives in uses
          backdrop-filter, which (per spec) makes it the containing block for
          any position:fixed descendant — without the portal, "fixed" ends up
          anchored to the panel's own box instead of the real viewport. */}
      {tooltipsEnabled && hoverInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            left: Math.min(hoverInfo.x + 16, window.innerWidth - 300),
            top: Math.min(Math.max(hoverInfo.y - 12, 12), window.innerHeight - 40),
            width: '280px',
            maxWidth: '85vw',
            maxHeight: '60vh',
            overflowY: 'auto',
            background: '#10131c',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '10px',
            padding: '0.7rem 0.85rem',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
            zIndex: 500,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}
        >
          {hoverInfo.techniques.map(key => {
            const entry = TAB_TECHNIQUES[key];
            if (!entry) return null;
            return (
              <div key={key}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.82rem', marginBottom: '2px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: '1.6rem', padding: '0.1rem 0.35rem',
                    background: 'rgba(0,240,255,0.12)', borderRadius: '4px',
                    fontFamily: 'monospace', fontSize: '0.72rem'
                  }}>
                    {entry.symbol}
                  </span>
                  {entry.title}
                </strong>
                {entry.definition}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </section>
  );
};
export default TabPlayerLab;
