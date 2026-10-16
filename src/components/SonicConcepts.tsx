import React, { useState, useRef, useEffect } from 'react';
import { audio } from '../utils/audio';

/**
 * Sonic Concepts: Sound-First Interactive Micro-Explorations
 * 
 * Teaches fundamental acoustic and musical phenomena with zero fluff:
 * Touch to hear, see the physical waveform/reaction, feel the concept.
 */
export const SonicConcepts: React.FC = () => {
  // --- 1. Overtones State ---
  const [activeHarmonics, setActiveHarmonics] = useState<number[]>([1]);
  const harmonicsList = [
    { n: 1, name: 'Fundamental (1x)', midi: 48, note: 'C3', ratio: '1:1', color: '#f59e0b' },
    { n: 2, name: 'Octave (2x)', midi: 60, note: 'C4', ratio: '2:1', color: '#10b981' },
    { n: 3, name: 'Fifth (3x)', midi: 67, note: 'G4', ratio: '3:1', color: '#38bdf8' },
    { n: 4, name: 'Double Octave (4x)', midi: 72, note: 'C5', ratio: '4:1', color: '#a855f7' },
    { n: 5, name: 'Major Third (5x)', midi: 76, note: 'E5', ratio: '5:1', color: '#ec4899' },
  ];

  const playHarmonic = (h: typeof harmonicsList[0]) => {
    audio.init();
    audio.playMidi(h.midi, 1.8);
    setActiveHarmonics(prev => prev.includes(h.n) ? prev : [...prev, h.n]);
    setTimeout(() => {
      setActiveHarmonics(prev => prev.filter(x => x !== h.n));
    }, 1200);
  };

  const playHarmonicsChord = () => {
    audio.init();
    harmonicsList.forEach((h, idx) => {
      audio.playMidi(h.midi, 2.2, audio.getCurrentTime() + idx * 0.08);
    });
    setActiveHarmonics(harmonicsList.map(h => h.n));
    setTimeout(() => setActiveHarmonics([]), 1800);
  };

  // --- 2. Mood Flip State ---
  const [mood, setMood] = useState<'major' | 'minor'>('major');
  const playMoodChord = (m: 'major' | 'minor') => {
    audio.init();
    setMood(m);
    // C Major = C3 (48), E3 (52), G3 (55), C4 (60)
    // C Minor = C3 (48), Eb3 (51), G3 (55), C4 (60)
    const midis = m === 'major' ? [48, 52, 55, 60] : [48, 51, 55, 60];
    audio.playStrum(midis, 2.4, 0.06);
  };

  // --- 3. Tension & Release State ---
  const [isTense, setIsTense] = useState(false);
  const [tensionResolved, setTensionResolved] = useState(false);
  const tenseIntervalRef = useRef<number | null>(null);

  const startTension = () => {
    audio.init();
    setIsTense(true);
    setTensionResolved(false);
    // G7 chord: G3 (43), D4 (50), F4 (53), B4 (59) - tritone F-B
    const g7 = [43, 50, 53, 59];
    audio.playChord(g7, 1.5);
    // Pulse every 400ms while held
    tenseIntervalRef.current = window.setInterval(() => {
      audio.playChord(g7, 0.8);
    }, 450);
  };

  const releaseTension = () => {
    if (tenseIntervalRef.current !== null) {
      clearInterval(tenseIntervalRef.current);
      tenseIntervalRef.current = null;
    }
    setIsTense(false);
    setTensionResolved(true);
    // C Major resolution: C3 (48), G3 (55), C4 (60), E4 (64)
    audio.playStrum([48, 55, 60, 64], 3.0, 0.05);
    setTimeout(() => setTensionResolved(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (tenseIntervalRef.current !== null) clearInterval(tenseIntervalRef.current);
    };
  }, []);

  // --- 4. Octave Leap State ---
  const [activeOctaveNote, setActiveOctaveNote] = useState<number | null>(null);
  const playOctaveNote = (midi: number) => {
    audio.init();
    setActiveOctaveNote(midi);
    audio.playMidi(midi, 2.0);
    setTimeout(() => setActiveOctaveNote(null), 1000);
  };

  // --- 5. Straight vs Swing State ---
  const [playingGroove, setPlayingGroove] = useState<'straight' | 'swing' | null>(null);
  const grooveTimerRef = useRef<number | null>(null);

  const playGrooveSample = (style: 'straight' | 'swing') => {
    audio.init();
    if (grooveTimerRef.current) {
      clearInterval(grooveTimerRef.current);
      grooveTimerRef.current = null;
    }
    setPlayingGroove(style);

    const now = audio.getCurrentTime();
    const bpm = 110;
    const spb = 60 / bpm; // ~0.545s per beat
    const beats = 4;

    for (let b = 0; b < beats; b++) {
      const beatTime = now + b * spb;
      // Beat click / bass
      audio.playClick(beatTime, b === 0);
      audio.playMidi(48, 0.35, beatTime); // C3 root

      // Offbeat subdivision:
      // Straight: 50%
      // Swing: 67% (triplet shuffle)
      const offbeatRatio = style === 'straight' ? 0.5 : 0.67;
      const offbeatTime = beatTime + offbeatRatio * spb;
      audio.playClick(offbeatTime, false, true);
      audio.playMidi(55, 0.25, offbeatTime); // G3 5th
    }

    grooveTimerRef.current = window.setTimeout(() => {
      setPlayingGroove(null);
    }, beats * spb * 1000);
  };

  // --- 6. Acoustic Touch: Open vs Muted ---
  const [touchState, setTouchState] = useState<'open' | 'muted' | null>(null);
  const playTouch = (type: 'open' | 'muted') => {
    audio.init();
    setTouchState(type);
    const chord = [40, 45, 50, 55, 59, 64]; // E standard open chord
    if (type === 'open') {
      audio.playStrum(chord, 3.0, 0.04);
    } else {
      audio.playStroke(chord, 'X', 0.2);
    }
    setTimeout(() => setTouchState(null), type === 'open' ? 1400 : 350);
  };

  return (
    <section className="sonic-concepts-container">
      <div className="sonic-header">
        <div className="sonic-header-title">
          <span className="sonic-header-icon" aria-hidden="true">⚡</span>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>
              Sonic Explorations
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Sound-first physical experiments. Tap and listen to discover why music works.
            </p>
          </div>
        </div>
      </div>

      <div className="sonic-grid">
        {/* Card 1: Harmonics & Overtones */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Physics</span>
            <h4>Harmonics &amp; Overtones</h4>
          </div>
          <p className="sonic-card-desc">
            A plucked string is not one pitch — it vibrates in halves, thirds, and fifths simultaneously!
          </p>

          <div className="harmonics-pill-list">
            {harmonicsList.map(h => {
              const isActive = activeHarmonics.includes(h.n);
              return (
                <button
                  key={h.n}
                  type="button"
                  className={`harmonic-pill${isActive ? ' is-active' : ''}`}
                  style={{ borderColor: isActive ? h.color : 'rgba(255,255,255,0.1)' }}
                  onClick={() => playHarmonic(h)}
                >
                  <span className="h-note" style={{ color: h.color }}>{h.note}</span>
                  <span className="h-name">{h.name}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn sonic-action-btn"
            onClick={playHarmonicsChord}
          >
            <span>✨ Ring All Harmonics Together</span>
          </button>
        </div>

        {/* Card 2: Mood Flip (Major vs Minor) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Emotion</span>
            <h4>The Mood Flip</h4>
          </div>
          <p className="sonic-card-desc">
            The secret between Joy and Sorrow is just <strong>one single semitone</strong>: the 3rd scale degree.
          </p>

          <div className="mood-flip-stage">
            <button
              type="button"
              className={`mood-button is-sun${mood === 'major' ? ' is-active' : ''}`}
              onClick={() => playMoodChord('major')}
            >
              <span className="mood-glyph">☀️</span>
              <span className="mood-title">MAJOR</span>
              <span className="mood-notes">C · <strong>E</strong> · G</span>
              <span className="mood-sub">Bright &amp; Hopeful</span>
            </button>

            <button
              type="button"
              className={`mood-button is-moon${mood === 'minor' ? ' is-active' : ''}`}
              onClick={() => playMoodChord('minor')}
            >
              <span className="mood-glyph">🌙</span>
              <span className="mood-title">MINOR</span>
              <span className="mood-notes">C · <strong style={{ color: '#818cf8' }}>E♭</strong> · G</span>
              <span className="mood-sub">Reflective &amp; Sad</span>
            </button>
          </div>
        </div>

        {/* Card 3: Tension & Release (V7 -> I) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Magnetism</span>
            <h4>Tension &amp; Release</h4>
          </div>
          <p className="sonic-card-desc">
            The heartbeat of music: chords create electric tension that aches to resolve home.
          </p>

          <div className="tension-interaction-box">
            <button
              type="button"
              className={`tension-trigger-btn${isTense ? ' is-tense' : ''}${tensionResolved ? ' is-resolved' : ''}`}
              onMouseDown={startTension}
              onMouseUp={releaseTension}
              onTouchStart={startTension}
              onTouchEnd={releaseTension}
            >
              {isTense ? (
                <div className="tension-state">
                  <span className="tension-icon is-wobbling">⚡</span>
                  <span className="tension-text">UNSTABLE (G7 Tritone Tension)</span>
                  <span className="tension-sub">Release mouse/finger to resolve!</span>
                </div>
              ) : tensionResolved ? (
                <div className="tension-state is-peaceful">
                  <span className="tension-icon">🌱</span>
                  <span className="tension-text">RESOLVED (C Major Home)</span>
                  <span className="tension-sub">The tension rests in peace.</span>
                </div>
              ) : (
                <div className="tension-state">
                  <span className="tension-icon">🧲</span>
                  <span className="tension-text">HOLD FOR TENSION</span>
                  <span className="tension-sub">Press &amp; hold, then release to hear resolution</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Card 4: Octave Leap */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Acoustics</span>
            <h4>The Octave Leap (2x Freq)</h4>
          </div>
          <p className="sonic-card-desc">
            Double the vibration speed = the exact same note, an octave higher in the sky.
          </p>

          <div className="octave-leap-controls">
            <button
              type="button"
              className={`octave-btn${activeOctaveNote === 48 ? ' is-active' : ''}`}
              onClick={() => playOctaveNote(48)}
            >
              <div className="octave-sine-wave is-slow" />
              <span className="octave-lbl">Low C3 · 130.8 Hz</span>
              <span className="octave-sub">1x vibration speed</span>
            </button>

            <button
              type="button"
              className={`octave-btn${activeOctaveNote === 60 ? ' is-active' : ''}`}
              onClick={() => playOctaveNote(60)}
            >
              <div className="octave-sine-wave is-fast" />
              <span className="octave-lbl">High C4 · 261.6 Hz</span>
              <span className="octave-sub">2x exact speed</span>
            </button>
          </div>
        </div>

        {/* Card 5: Straight vs Swing Pocket */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Groove</span>
            <h4>Straight vs Swing Shuffle</h4>
          </div>
          <p className="sonic-card-desc">
            Rhythm isn’t just speed; it’s where the offbeat lands. Hear the human pocket.
          </p>

          <div className="groove-dual-buttons">
            <button
              type="button"
              className={`groove-btn${playingGroove === 'straight' ? ' is-active' : ''}`}
              onClick={() => playGrooveSample('straight')}
            >
              <span className="groove-icon">🤖</span>
              <span className="groove-name">Straight 8ths</span>
              <span className="groove-sub">Even 50/50 clockwork</span>
            </button>

            <button
              type="button"
              className={`groove-btn${playingGroove === 'swing' ? ' is-active' : ''}`}
              onClick={() => playGrooveSample('swing')}
            >
              <span className="groove-icon">🎷</span>
              <span className="groove-name">Blues Swing</span>
              <span className="groove-sub">67/33 heart-pulse shuffle</span>
            </button>
          </div>
        </div>

        {/* Card 6: Acoustic Touch (Open Ring vs Palm Mute) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Guitar Dynamics</span>
            <h4>Acoustic Touch: Open vs Mute</h4>
          </div>
          <p className="sonic-card-desc">
            Guitar rhythm relies on the friction of palm muting to build percussive drive.
          </p>

          <div className="touch-buttons-row">
            <button
              type="button"
              className={`touch-btn is-open-touch${touchState === 'open' ? ' is-active' : ''}`}
              onClick={() => playTouch('open')}
            >
              <span className="touch-icon">🎸</span>
              <span className="touch-title">Open Ring</span>
              <span className="touch-sub">Strings ring uninhibited</span>
            </button>

            <button
              type="button"
              className={`touch-btn is-muted-touch${touchState === 'muted' ? ' is-active' : ''}`}
              onClick={() => playTouch('muted')}
            >
              <span className="touch-icon">✋</span>
              <span className="touch-title">Palm Mute (Chuck)</span>
              <span className="touch-sub">Damped percussive attack</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
