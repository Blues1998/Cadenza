import React, { useState, useEffect } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { Term } from '../components/Term';
import { audio } from '../utils/audio';
import {
  NOTE_NAMES,
  CIRCLE_OF_FIFTHS,
  CHORD_QUALITIES,
  SCALE_FORMULAS,
  noteNameToMidi
} from '../utils/musicTheory';
import type {
  CircleKeyInfo,
  ScaleFormula
} from '../utils/musicTheory';
import { SCALE_FEELINGS, CHORD_FEELINGS } from '../utils/glossary';

const INTRO_DISMISSED_KEY = 'theory-intro-dismissed';

// Color legend explaining the keyboard/fretboard highlights
const HighlightLegend: React.FC<{ mode: 'scale' | 'chord' }> = ({ mode }) => {
  const dot = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: color,
    marginRight: '0.35rem',
    verticalAlign: 'middle'
  });
  return (
    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
      <span><span style={dot('var(--warning)')} />Root — the home note</span>
      <span><span style={dot('var(--success)')} />Notes in this {mode}</span>
      <span><span style={dot('var(--primary)')} />Playing right now</span>
    </div>
  );
};

export const TheoryLab: React.FC = () => {
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const [selectedOctave, setSelectedOctave] = useState<number>(3);
  const [selectedScale, setSelectedScale] = useState<ScaleFormula>(SCALE_FORMULAS[0]);
  const [selectedChordQuality, setSelectedChordQuality] = useState<number>(-1); // -1 means scale mode

  const [activeMidis, setActiveMidis] = useState<number[]>([]);
  const [highlightedMidis, setHighlightedMidis] = useState<number[]>([]);
  const [rootMidis, setRootMidis] = useState<number[]>([]);

  // "Start here" intro card — shown until the user dismisses it once
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INTRO_DISMISSED_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const dismissIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem(INTRO_DISMISSED_KEY, '1');
    } catch { /* private browsing — just hide for this session */ }
  };

  // Circle of Fifths State
  const [selectedCircleKey, setSelectedCircleKey] = useState<CircleKeyInfo>(CIRCLE_OF_FIFTHS[0]);

  // Compute notes to highlight based on scale or chord selections
  useEffect(() => {
    try {
      const rootMidi = noteNameToMidi(selectedRoot, selectedOctave);
      const highlighted: number[] = [];

      if (selectedChordQuality !== -1) {
        // Chord mode
        const chord = CHORD_QUALITIES[selectedChordQuality];
        chord.intervals.forEach((interval) => {
          // Highlight across multiple octaves for piano/fretboard visibility
          highlighted.push(rootMidi + interval);
          highlighted.push(rootMidi + interval - 12);
          highlighted.push(rootMidi + interval + 12);
          highlighted.push(rootMidi + interval + 24);
        });
      } else {
        // Scale mode
        selectedScale.steps.forEach((step) => {
          highlighted.push(rootMidi + step);
          highlighted.push(rootMidi + step - 12);
          highlighted.push(rootMidi + step + 12);
          highlighted.push(rootMidi + step + 24);
        });
      }
      setHighlightedMidis(highlighted.filter(midi => midi >= 40 && midi <= 84));

      // The root itself gets its own color in every visible octave
      const roots = [rootMidi - 12, rootMidi, rootMidi + 12, rootMidi + 24];
      setRootMidis(roots.filter(midi => midi >= 40 && midi <= 84));
    } catch (e) {
      console.error(e);
    }
  }, [selectedRoot, selectedOctave, selectedScale, selectedChordQuality]);

  // Note names of the current selection, in playing order (for the caption)
  const currentNoteNames = (): string[] => {
    const rootIndex = NOTE_NAMES.indexOf(selectedRoot);
    const offsets = selectedChordQuality !== -1
      ? CHORD_QUALITIES[selectedChordQuality].intervals
      : selectedScale.steps;
    return offsets.map(off => NOTE_NAMES[(rootIndex + off) % 12]);
  };

  const handlePlayNote = (midi: number) => {
    audio.playMidi(midi, 1.5);
    setActiveMidis([midi]);
    setTimeout(() => {
      setActiveMidis((prev) => prev.filter((m) => m !== midi));
    }, 150);
  };

  // Play the entire scale in an ascending sweep sequence
  const playScaleSweep = () => {
    audio.init();
    const rootMidi = noteNameToMidi(selectedRoot, selectedOctave);
    const steps = selectedScale.steps;
    const now = audio.getCurrentTime();
    
    steps.forEach((step, index) => {
      const noteMidi = rootMidi + step;
      const noteTime = now + index * 0.35; // 350ms interval between notes
      
      // Schedule audio play
      audio.playMidi(noteMidi, 1.0, noteTime);
      
      // Sync visual playing indicators
      setTimeout(() => {
        setActiveMidis([noteMidi]);
      }, index * 350);
    });

    // Clear active keys when done
    setTimeout(() => {
      setActiveMidis([]);
    }, steps.length * 350);
  };

  // Play selected chord
  const playCurrentChord = () => {
    if (selectedChordQuality === -1) return;
    audio.init();
    const rootMidi = noteNameToMidi(selectedRoot, selectedOctave);
    const chord = CHORD_QUALITIES[selectedChordQuality];
    
    const midis = chord.intervals.map(interval => rootMidi + interval);
    audio.playChord(midis, 2.5);

    setActiveMidis(midis);
    setTimeout(() => {
      setActiveMidis([]);
    }, 400);
  };

  // Click on a key segment in the Circle of Fifths
  const handleCircleKeyClick = (keyInfo: CircleKeyInfo) => {
    setSelectedCircleKey(keyInfo);
    setSelectedRoot(keyInfo.name.replace('m', ''));
    setSelectedOctave(3);
    setSelectedChordQuality(-1); // Switch to scale mode for key
    
    // Play root tonic chord of this key
    const isMinor = keyInfo.name.endsWith('m');
    const rootMidi = noteNameToMidi(keyInfo.name.replace('m', ''), 3);
    const chordIntervals = isMinor ? [0, 3, 7] : [0, 4, 7]; // minor or major triad
    const chordMidis = chordIntervals.map(i => rootMidi + i);
    
    audio.playChord(chordMidis, 2.0);
    setActiveMidis(chordMidis);
    setTimeout(() => setActiveMidis([]), 300);
  };

  // Play a diatonic chord from the selected Circle of Fifths key
  const playDiatonicChord = (chordName: string, _degreeIdx: number) => {
    audio.init();
    
    // Parse chord name, e.g. "Dm", "F#dim", "C"
    let cleanRoot = chordName;
    let isMinor = false;
    let isDim = false;

    if (chordName.endsWith('dim')) {
      cleanRoot = chordName.replace('dim', '');
      isDim = true;
    } else if (chordName.endsWith('m')) {
      cleanRoot = chordName.replace('m', '');
      isMinor = true;
    }

    const rootMidi = noteNameToMidi(cleanRoot, selectedOctave);
    
    let intervals = [0, 4, 7]; // default major
    if (isDim) {
      intervals = [0, 3, 6];
    } else if (isMinor) {
      intervals = [0, 3, 7];
    }

    const chordMidis = intervals.map(i => rootMidi + i);
    audio.playChord(chordMidis, 2.0);
    
    setActiveMidis(chordMidis);
    setTimeout(() => setActiveMidis([]), 350);
  };

  // Helper to draw sector paths for Circle of Fifths
  const renderCircleSectors = () => {
    const cx = 160;
    const cy = 160;
    const outerR = 140;
    const midR = 95;
    const innerR = 55;

    return CIRCLE_OF_FIFTHS.map((keyInfo, index) => {
      // 12 keys, each spans 30 degrees (360/12)
      // C is at index 0 (top, 12 o'clock). Shift angles by -90 degrees
      const startAngle = (index * 30 - 15 - 90) * Math.PI / 180;
      const endAngle = (index * 30 + 15 - 90) * Math.PI / 180;

      // Outer sector coordinates (Major keys)
      const x1_out = cx + outerR * Math.cos(startAngle);
      const y1_out = cy + outerR * Math.sin(startAngle);
      const x2_out = cx + outerR * Math.cos(endAngle);
      const y2_out = cy + outerR * Math.sin(endAngle);

      const x1_mid = cx + midR * Math.cos(startAngle);
      const y1_mid = cy + midR * Math.sin(startAngle);
      const x2_mid = cx + midR * Math.cos(endAngle);
      const y2_mid = cy + midR * Math.sin(endAngle);

      // Inner sector coordinates (Minor keys)
      const x1_in = cx + innerR * Math.cos(startAngle);
      const y1_in = cy + innerR * Math.sin(startAngle);
      const x2_in = cx + innerR * Math.cos(endAngle);
      const y2_in = cy + innerR * Math.sin(endAngle);

      // Center of sector for labels
      const labelAngle = (index * 30 - 90) * Math.PI / 180;
      const labelX_maj = cx + (outerR + midR) / 2 * Math.cos(labelAngle);
      const labelY_maj = cx + (outerR + midR) / 2 * Math.sin(labelAngle) + 5;
      
      const labelX_min = cx + (midR + innerR) / 2 * Math.cos(labelAngle);
      const labelY_min = cx + (midR + innerR) / 2 * Math.sin(labelAngle) + 5;

      const isSelected = selectedCircleKey.name === keyInfo.name;

      return (
        <g key={keyInfo.name} style={{ cursor: 'pointer' }} onClick={() => handleCircleKeyClick(keyInfo)}>
          {/* Major Key Sector */}
          <path
            d={`M ${x1_mid} ${y1_mid} L ${x1_out} ${y1_out} A ${outerR} ${outerR} 0 0 1 ${x2_out} ${y2_out} L ${x2_mid} ${y2_mid} A ${midR} ${midR} 0 0 0 ${x1_mid} ${y1_mid}`}
            fill={isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.02)'}
            stroke={isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)'}
            strokeWidth={isSelected ? '2' : '1'}
            className="sector-path"
          />
          {/* Minor Key Sector */}
          <path
            d={`M ${x1_in} ${y1_in} L ${x1_mid} ${y1_mid} A ${midR} ${midR} 0 0 1 ${x2_mid} ${y2_mid} L ${x2_in} ${y2_in} A ${innerR} ${innerR} 0 0 0 ${x1_in} ${y1_in}`}
            fill={isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.01)'}
            stroke={isSelected ? 'var(--secondary)' : 'rgba(255, 255, 255, 0.05)'}
            strokeWidth={isSelected ? '1.5' : '0.5'}
          />

          {/* Text Labels */}
          <text x={labelX_maj} y={labelY_maj} fill={isSelected ? 'var(--primary)' : '#fff'} fontSize="13.5" fontWeight={isSelected ? 'bold' : 'normal'} textAnchor="middle">
            {keyInfo.name}
          </text>
          <text x={labelX_min} y={labelY_min} fill={isSelected ? 'var(--secondary)' : 'var(--text-secondary)'} fontSize="10.5" textAnchor="middle">
            {keyInfo.relativeMinor}
          </text>
        </g>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title">Visual Theory & Scale Explorer</h2>
        <p className="lab-description">
          See and hear how music works — no theory knowledge needed.
          Pick a <Term k="scale">scale</Term> or <Term k="chordQuality">chord</Term> below
          and the same notes light up on the piano and guitar at once.
          Anything with a dotted underline can be hovered or tapped for a plain-English explanation.
        </p>
      </div>

      {/* Dismissible "Start here" guide for first-time visitors */}
      {showIntro && (
        <section className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', borderColor: 'rgba(0, 240, 255, 0.25)' }}>
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--primary)' }}>New here? Try this first</h3>
            {[
              ['1', 'Pick a feeling below — start with "Happy & Bright" (that’s the Major scale).'],
              ['2', 'Press Play and just listen. Does it match the feeling on the label?'],
              ['3', 'Watch the same notes light up on the piano and guitar — the amber note is "home".']
            ].map(([num, text]) => (
              <div key={num} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,240,255,0.15)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, alignSelf: 'center' }}>{num}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <button onClick={dismissIntro} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
            Got it — hide this
          </button>
        </section>
      )}

      <div className="grid-2">
        
        {/* Scale/Chord Config Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Explorer Settings</span>
            <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
              Mode: {selectedChordQuality !== -1 ? 'Chord' : 'Scale'}
            </span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                <Term k="rootNote">Root Note</Term> <span style={{ color: 'var(--text-muted)' }}>— the home note</span>
              </label>
              <select 
                value={selectedRoot} 
                onChange={(e) => setSelectedRoot(e.target.value)}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', color: '#fff', outline: 'none' }}
              >
                {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                <Term k="octave">Octave</Term> <span style={{ color: 'var(--text-muted)' }}>— how high or low</span>
              </label>
              <select 
                value={selectedOctave} 
                onChange={(e) => setSelectedOctave(Number(e.target.value))}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', color: '#fff', outline: 'none' }}
              >
                <option value={2}>Low (2)</option>
                <option value={3}>Mid (3)</option>
                <option value={4}>High (4)</option>
              </select>
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Pick a <Term k="scale">scale</Term> by its feeling
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SCALE_FORMULAS.map((scale) => (
                <button
                  key={scale.name}
                  onClick={() => {
                    setSelectedScale(scale);
                    setSelectedChordQuality(-1);
                  }}
                  className={`btn ${selectedScale.name === scale.name && selectedChordQuality === -1 ? 'btn-primary' : ''}`}
                  style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', flexDirection: 'column', gap: '1px', alignItems: 'flex-start' }}
                >
                  <span style={{ fontWeight: 600 }}>{SCALE_FEELINGS[scale.name]?.feeling ?? scale.name}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{scale.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              …or pick a <Term k="chordQuality">chord</Term> by its feeling
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {CHORD_QUALITIES.map((chord, idx) => (
                <button
                  key={chord.name}
                  onClick={() => setSelectedChordQuality(idx)}
                  className={`btn ${selectedChordQuality === idx ? 'btn-secondary' : ''}`}
                  style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', flexDirection: 'column', gap: '1px', alignItems: 'flex-start' }}
                >
                  <span style={{ fontWeight: 600 }}>{CHORD_FEELINGS[chord.name] ?? chord.name}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{chord.name} ({chord.symbols[0]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic plain-English caption for the current selection */}
          <div style={{ background: 'rgba(0, 240, 255, 0.04)', border: '1px solid rgba(0, 240, 255, 0.15)', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '0.3rem' }}>
              What you're seeing & hearing
            </span>
            {selectedChordQuality !== -1 ? (
              <>
                <strong style={{ color: '#fff' }}>{selectedRoot} {CHORD_QUALITIES[selectedChordQuality].name}</strong>
                {' '}sounds <strong style={{ color: 'var(--secondary)' }}>{(CHORD_FEELINGS[CHORD_QUALITIES[selectedChordQuality].name] ?? '').toLowerCase()}</strong>.
                {' '}It's the notes <strong style={{ color: '#fff' }}>{currentNoteNames().join(' · ')}</strong> played
                at the same time, built up from the home note {selectedRoot}. Press play and listen for that feeling.
              </>
            ) : (
              <>
                <strong style={{ color: '#fff' }}>{selectedRoot} {selectedScale.name}</strong> — start
                at the home note <strong style={{ color: 'var(--warning)' }}>{selectedRoot}</strong> and
                climb: <strong style={{ color: '#fff' }}>{currentNoteNames().join(' · ')}</strong>.
                {' '}Listen for {SCALE_FEELINGS[selectedScale.name]?.listenFor ?? 'its distinctive character.'}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', paddingTop: '1rem' }}>
            {selectedChordQuality !== -1 ? (
              <button onClick={playCurrentChord} className="btn btn-secondary" style={{ flex: 1, justifySelf: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Arpeggiate/Play Chord
              </button>
            ) : (
              <button onClick={playScaleSweep} className="btn btn-primary" style={{ flex: 1 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Play Scale (Sweep)
              </button>
            )}
          </div>
        </section>

        {/* Interactive Circle of Fifths */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '100%', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem' }}>
              <Term k="circleOfFifths">Circle of Fifths</Term>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
              A map of all 12 musical <Term k="musicalKey">keys</Term>. Neighboring slices share almost
              all their notes, so they blend well together — click any slice to hear its home chord.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {/* SVG Circle */}
            <svg width="320" height="320" viewBox="0 0 320 320" style={{ transform: 'rotate(0deg)' }}>
              {renderCircleSectors()}
              {/* Inner core empty space */}
              <circle cx="160" cy="160" r="55" fill="#080a0f" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.5" />
              {/* Core Label */}
              <text x="160" y="155" fill="var(--text-secondary)" fontSize="10" textAnchor="middle">SELECTED KEY</text>
              <text x="160" y="177" fill="var(--primary)" fontSize="18" fontWeight="bold" textAnchor="middle">{selectedCircleKey.name} Maj</text>
            </svg>

            {/* Key signature info */}
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.4rem' }}>About this Key</h4>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div><Term k="relativeMinor">Relative Minor</Term>: <span style={{ color: 'var(--secondary)' }}>{selectedCircleKey.relativeMinor}</span> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(same notes, sad mood)</span></div>
                  <div><Term k="accidentals">Accidentals</Term>: <span>
                    {selectedCircleKey.sharps > 0 ? `${selectedCircleKey.sharps} ♯ (Sharps)` :
                     selectedCircleKey.sharps < 0 ? `${Math.abs(selectedCircleKey.sharps)} ♭ (Flats)` :
                     'None (Natural Key)'}
                  </span></div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  <Term k="diatonicChords">Chords that belong</Term> in the Key of {selectedCircleKey.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {selectedCircleKey.chords.map((chordName, i) => {
                    const degrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
                    return (
                      <button
                        key={chordName}
                        onClick={() => playDiatonicChord(chordName, i)}
                        className="btn"
                        style={{ padding: '0.4rem', fontSize: '0.75rem', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <span style={{ fontWeight: 'bold' }}>{chordName}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{degrees[i]}</span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  The <Term k="romanNumerals">Roman numerals</Term> tell you each chord's role:
                  UPPERCASE = happy major, lowercase = sad minor, ° = tense. Click a few in a
                  row — congratulations, you're writing a chord progression.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Piano View */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
          3-Octave Piano Keyboard
          <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Click any key to hear it — colored keys belong to your selection above.
          </span>
        </h3>
        <HighlightLegend mode={selectedChordQuality !== -1 ? 'chord' : 'scale'} />
        <Keyboard
          activeMidis={activeMidis}
          highlightCorrectMidis={highlightedMidis}
          rootMidis={rootMidis}
          onPlayNote={handlePlayNote}
        />
      </section>

      {/* Fretboard View */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Guitar Fretboard (Standard Tuning EADGBE)</span>
          <button 
            onClick={() => handlePlayNote(noteNameToMidi('E', 2))} 
            className="btn" 
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
          >
            Strum Guitar
          </button>
        </h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.75rem', marginBottom: '0.75rem' }}>
          The exact same notes as the piano above, mapped onto the guitar neck — one note can live in several places on a guitar.
        </p>
        <HighlightLegend mode={selectedChordQuality !== -1 ? 'chord' : 'scale'} />
        <Fretboard
          activeMidis={activeMidis}
          highlightCorrectMidis={highlightedMidis}
          rootMidis={rootMidis}
          onPlayNote={handlePlayNote}
          showAllNoteNames={true}
        />
      </section>

    </div>
  );
};
export default TheoryLab;
