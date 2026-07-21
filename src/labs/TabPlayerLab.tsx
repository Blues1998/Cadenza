import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlphaTabApi, synth, model, FileLoadError } from '@coderline/alphatab';

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
// Only re-check whether the cursor needs following this often, so it's a
// smooth, occasional nudge rather than a scroll fight on every beat.
const FOLLOW_CHECK_THROTTLE_MS = 250;

export const TabPlayerLab: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AlphaTabApi | null>(null);
  const isPlayingRef = useRef(false);
  const userBrowsingRef = useRef(false);
  const browsingTimeoutRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const lastFollowCheckRef = useRef(0);

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
        // alphaTab's built-in auto-scroll only knows "always snap to the
        // cursor", which fights any attempt to browse away while playing.
        // We want "follow, but let the user look around and only pull them
        // back after a pause" — that needs custom scroll handling below, so
        // the built-in follow behavior stays off.
        scrollMode: 'Off'
      }
    });
    apiRef.current = api;

    // Smoothly scrolls the viewport so the currently playing beat is nicely
    // in view (about a third of the way down), without fighting a scroll
    // that's already in flight or one the user just triggered themselves.
    const scrollToCurrentBeat = () => {
      const beatCursor = viewport.querySelector('.at-cursor-beat') as HTMLElement | null;
      if (!beatCursor) return;
      const containerRect = viewport.getBoundingClientRect();
      const beatRect = beatCursor.getBoundingClientRect();
      const currentAbsoluteTop = beatRect.top - containerRect.top + viewport.scrollTop;
      const targetScrollTop = Math.max(0, currentAbsoluteTop - viewport.clientHeight * 0.3);
      if (Math.abs(targetScrollTop - viewport.scrollTop) < 2) return;
      isAutoScrollingRef.current = true;
      viewport.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      window.setTimeout(() => { isAutoScrollingRef.current = false; }, 700);
    };

    const handleManualScroll = () => {
      if (isAutoScrollingRef.current) return; // our own scroll, not the user's
      userBrowsingRef.current = true;
      if (browsingTimeoutRef.current !== null) window.clearTimeout(browsingTimeoutRef.current);
      browsingTimeoutRef.current = window.setTimeout(() => {
        userBrowsingRef.current = false;
        if (isPlayingRef.current) scrollToCurrentBeat();
      }, BROWSE_GRACE_PERIOD_MS);
    };
    viewport.addEventListener('scroll', handleManualScroll);

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
    api.scoreLoaded.on((score) => {
      setScoreTitle(score.title || 'Untitled');
      setScoreArtist(score.artist || '');
      setTrackNames(score.tracks.map(t => t.name || 'Track'));
      setError(null);

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
      if (playing && !userBrowsingRef.current) scrollToCurrentBeat();
    });
    api.playerReady.on(() => setIsReady(true));
    api.playerPositionChanged.on((args) => {
      setPosition({ current: args.currentTime, end: args.endTime });

      if (userBrowsingRef.current) return;
      const now = performance.now();
      if (now - lastFollowCheckRef.current < FOLLOW_CHECK_THROTTLE_MS) return;
      lastFollowCheckRef.current = now;

      const beatCursor = viewport.querySelector('.at-cursor-beat') as HTMLElement | null;
      if (!beatCursor) return;
      const containerRect = viewport.getBoundingClientRect();
      const beatRect = beatCursor.getBoundingClientRect();
      const relativeTop = beatRect.top - containerRect.top;
      const margin = viewport.clientHeight * 0.15;
      if (relativeTop < margin || relativeTop > viewport.clientHeight - margin) {
        scrollToCurrentBeat();
      }
    });

    return () => {
      viewport.removeEventListener('scroll', handleManualScroll);
      if (browsingTimeoutRef.current !== null) window.clearTimeout(browsingTimeoutRef.current);
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
                Loop {looping ? 'On' : 'Off'}
              </button>
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
    </section>
  );
};
export default TabPlayerLab;
