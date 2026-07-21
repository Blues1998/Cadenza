import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlphaTabApi, synth, model, FileLoadError } from '@coderline/alphatab';
import { Term } from '../components/Term';
import { TAB_TECHNIQUES } from '../utils/glossary';

const ACCEPTED_EXTENSIONS = '.gp,.gp3,.gp4,.gp5,.gpx,.musicxml,.xml';

// Real recorded classical/steel guitar samples (4 velocity layers + fret
// noise) from the "Nylon and Steel Guitars-4U" soundfont (soundfonts4u,
// CC BY-NC-SA 4.0), which sounds far less robotic than the default GM patch.
// Its presets were rebanked from 0 to 1 (see scripts/rebank-sf2.mjs-style
// patch) purely to avoid colliding with the base soundfont's bank-0 GM
// programs 0-6 (pianos) when both are loaded together.
const GUITAR_SOUNDFONT_URL = '/instruments/soundfonts4u-nylon-steel-guitars-bank1.sf2';
const GUITAR_TONES = [
  { bank: 1, program: 0, label: 'Nylon Classical' },
  { bank: 1, program: 1, label: 'Nylon (No Fret Noise)' },
  { bank: 1, program: 2, label: 'Nylon Smooth' },
  { bank: 1, program: 3, label: 'Steel-String Acoustic' },
  { bank: 1, program: 4, label: 'Chorus Guitar' },
  { bank: 1, program: 5, label: 'Clean Electric' },
  { bank: 1, program: 6, label: '12-String Guitar' }
];
const DEFAULT_GUITAR_TONE = GUITAR_TONES[0]; // Nylon Classical

function toneKey(bank: number, program: number): string {
  return `${bank}:${program}`;
}

// alphaTab bakes the instrument into an "automation" event on each track's
// very first beat the first time it's accessed (during initial rendering) —
// after that, changing track.playbackInfo.program alone does nothing, since
// playback always reads that frozen first-beat automation. Update both.
// (Bank has no such freeze, so a plain property set is enough for it.)
function setScoreInstrument(score: model.Score, bank: number, program: number) {
  score.tracks.forEach(track => {
    track.playbackInfo.bank = bank;
    track.playbackInfo.program = program;
    const firstBeat = track.staves[0]?.bars[0]?.voices[0]?.beats[0];
    if (!firstBeat) return;
    const existing = firstBeat.getAutomation(model.AutomationType.Instrument);
    if (existing) {
      existing.value = program;
    } else {
      firstBeat.automations.push(model.Automation.buildInstrumentAutomation(false, 0, program));
    }
  });
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// How long the user gets to browse freely after a manual scroll before
// playback auto-follow resumes.
const BROWSE_GRACE_PERIOD_MS = 2000;

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
      const boundsLookup = api.boundsLookup;
      if (!boundsLookup) return;
      const rect = viewport.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const insetLeft = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);
      const insetTop = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
      const contentX = clientX - rect.left - insetLeft + viewport.scrollLeft;
      const contentY = clientY - rect.top - insetTop + viewport.scrollTop;
      const beat = boundsLookup.getBeatAtPos(contentX, contentY);
      if (!beat) {
        setHoverInfo(null);
        return;
      }
      const techniques = detectBeatTechniques(beat);
      if (techniques.length === 0) {
        setHoverInfo(null);
        return;
      }
      setHoverInfo({ x: clientX, y: clientY, techniques });
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

    api.scoreLoaded.on((score) => {
      setScoreTitle(score.title || 'Untitled');
      setScoreArtist(score.artist || '');
      setTrackNames(score.tracks.map(t => t.name || 'Track'));
      setError(null);
      setSectionRange(null);
      setHoverInfo(null);

      // Every loaded tab defaults to the nylon classical tone regardless of
      // what the file itself specifies — this player is for guitar practice.
      setScoreInstrument(score, DEFAULT_GUITAR_TONE.bank, DEFAULT_GUITAR_TONE.program);
      setGuitarTone(DEFAULT_GUITAR_TONE);
      api.loadMidiForScore();
    });
    api.playerStateChanged.on((args) => {
      const playing = args.state === synth.PlayerState.Playing;
      isPlayingRef.current = playing;
      setIsPlaying(playing);
      // Reorient immediately when playback (re)starts, in case the user
      // browsed away while paused.
      if (playing && !userBrowsingRef.current) api.scrollToCursor();
    });
    api.playerReady.on(() => setIsReady(true));
    api.playerPositionChanged.on((args) => {
      setPosition({ current: args.currentTime, end: args.endTime });
    });

    return () => {
      viewport.removeEventListener('scroll', handleManualScroll);
      viewport.removeEventListener('mousemove', handleMouseMove);
      viewport.removeEventListener('mouseleave', handleMouseLeave);
      viewport.removeEventListener('touchstart', handleTouchStart);
      if (browsingTimeoutRef.current !== null) window.clearTimeout(browsingTimeoutRef.current);
      if (scrollAnimationFrame !== null) cancelAnimationFrame(scrollAnimationFrame);
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    apiRef.current?.load(new Uint8Array(buf));
  }, []);

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
  };

  const hasScore = scoreTitle !== '';

  return (
    <section className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Tab Player</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Import a Guitar Pro (.gp3, .gp4, .gp5, .gpx) or MusicXML file and play it back right here —
          slow the tempo down to isolate the hard parts, loop them, and practice along on your real instrument.
        </p>
      </div>

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
              Tip: click-drag across the notation to loop a passage, and hover any note to see what
              its markings (hammer-on, slide, palm mute…) mean.
            </div>
            <button
              className="btn"
              onClick={() => setShowLegend(v => !v)}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              {showLegend ? 'Hide' : 'Show'} Tab Symbol Legend
            </button>
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
      {hoverInfo && createPortal(
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
