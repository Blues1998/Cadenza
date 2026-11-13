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
    { n: 1, name: 'Fundamental', midi: 48, note: 'C3', ratio: '1:1', color: 'var(--primary)' },
    { n: 2, name: 'Octave', midi: 60, note: 'C4', ratio: '2:1', color: 'var(--primary)' },
    { n: 3, name: 'Fifth', midi: 67, note: 'G4', ratio: '3:1', color: 'var(--primary)' },
    { n: 4, name: 'Two octaves', midi: 72, note: 'C5', ratio: '4:1', color: 'var(--primary)' },
    { n: 5, name: 'Major third', midi: 76, note: 'E5', ratio: '5:1', color: 'var(--primary)' },
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
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>
              Sonic Explorations
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Tap and listen.
            </p>
          </div>
        </div>
      </div>

      <div className="sonic-grid">
        {/* Card 1: Harmonics & Overtones */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Sound</span>
            <h4>Harmonics</h4>
          </div>
          <p className="sonic-card-desc">
            A plucked string isn't one pitch. It vibrates in halves, thirds and fifths at once.
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
            <span>Play them together</span>
          </button>
        </div>

        {/* Card 2: Mood Flip (Major vs Minor) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Harmony</span>
            <h4>One note apart</h4>
          </div>
          <p className="sonic-card-desc">
            Major and minor differ by <strong>one note</strong>: the 3rd, a semitone apart.
          </p>

          <div className="mood-flip-stage">
            <button
              type="button"
              className={`mood-button is-sun${mood === 'major' ? ' is-active' : ''}`}
              onClick={() => playMoodChord('major')}
            >
              <span className="mood-title">Major</span>
              <span className="mood-notes">C · <strong>E</strong> · G</span>
              <span className="mood-sub">Bright</span>
            </button>

            <button
              type="button"
              className={`mood-button is-moon${mood === 'minor' ? ' is-active' : ''}`}
              onClick={() => playMoodChord('minor')}
            >
              <span className="mood-title">Minor</span>
              <span className="mood-notes">C · <strong>E♭</strong> · G</span>
              <span className="mood-sub">Dark</span>
            </button>
          </div>
        </div>

        {/* Card 3: Tension & Release (V7 -> I) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Harmony</span>
            <h4>Tension and release</h4>
          </div>
          <p className="sonic-card-desc">
            Some chords pull toward home.
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
                  <span className="tension-text">G7: tense</span>
                  <span className="tension-sub">Let go to resolve</span>
                </div>
              ) : tensionResolved ? (
                <div className="tension-state is-peaceful">
                  <span className="tension-text">C: home</span>
                  <span className="tension-sub">Resolved</span>
                </div>
              ) : (
                <div className="tension-state">
                  <span className="tension-text">Hold for tension</span>
                  <span className="tension-sub">Press, hold, let go</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Card 4: Octave Leap */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Sound</span>
            <h4>The octave</h4>
          </div>
          <p className="sonic-card-desc">
            Double the frequency and you get the same note, an octave higher.
          </p>

          <div className="octave-leap-controls">
            <button
              type="button"
              className={`octave-btn${activeOctaveNote === 48 ? ' is-active' : ''}`}
              onClick={() => playOctaveNote(48)}
            >
              <div className="octave-sine-wave is-slow" />
              <span className="octave-lbl">C3 · 130.8 Hz</span>
              <span className="octave-sub">Base frequency</span>
            </button>

            <button
              type="button"
              className={`octave-btn${activeOctaveNote === 60 ? ' is-active' : ''}`}
              onClick={() => playOctaveNote(60)}
            >
              <div className="octave-sine-wave is-fast" />
              <span className="octave-lbl">C4 · 261.6 Hz</span>
              <span className="octave-sub">Twice as fast</span>
            </button>
          </div>
        </div>

        {/* Card 5: Straight vs Swing Pocket */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Rhythm</span>
            <h4>Straight or swing</h4>
          </div>
          <p className="sonic-card-desc">
            Same tempo, different feel: it’s where the offbeat lands.
          </p>

          <div className="groove-dual-buttons">
            <button
              type="button"
              className={`groove-btn${playingGroove === 'straight' ? ' is-active' : ''}`}
              onClick={() => playGrooveSample('straight')}
            >
              <span className="groove-name">Straight 8ths</span>
              <span className="groove-sub">Even, 50/50</span>
            </button>

            <button
              type="button"
              className={`groove-btn${playingGroove === 'swing' ? ' is-active' : ''}`}
              onClick={() => playGrooveSample('swing')}
            >
              <span className="groove-name">Swing</span>
              <span className="groove-sub">Long-short, 67/33</span>
            </button>
          </div>
        </div>

        {/* Card 6: Acoustic Touch (Open Ring vs Palm Mute) */}
        <div className="sonic-card">
          <div className="sonic-card-head">
            <span className="sonic-tag">Technique</span>
            <h4>Open or muted</h4>
          </div>
          <p className="sonic-card-desc">
            Palm muting makes strumming percussive.
          </p>

          <div className="touch-buttons-row">
            <button
              type="button"
              className={`touch-btn is-open-touch${touchState === 'open' ? ' is-active' : ''}`}
              onClick={() => playTouch('open')}
            >
              <span className="touch-title">Open</span>
              <span className="touch-sub">Let it ring</span>
            </button>

            <button
              type="button"
              className={`touch-btn is-muted-touch${touchState === 'muted' ? ' is-active' : ''}`}
              onClick={() => playTouch('muted')}
            >
              <span className="touch-title">Palm mute</span>
              <span className="touch-sub">Short and percussive</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
