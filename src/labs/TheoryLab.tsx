import React, { useState, useEffect } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { audio } from '../utils/audio';
import { 
  NOTE_NAMES, 
  CIRCLE_OF_FIFTHS, 
  CHORD_QUALITIES, 
  noteNameToMidi 
} from '../utils/musicTheory';
import type { 
  CircleKeyInfo 
} from '../utils/musicTheory';

interface ScaleFormula {
  name: string;
  steps: number[]; // semitone offsets from root
}

const SCALE_FORMULAS: ScaleFormula[] = [
  { name: 'Major (Ionian)', steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  { name: 'Natural Minor (Aeolian)', steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  { name: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11, 12] },
  { name: 'Pentatonic Major', steps: [0, 2, 4, 7, 9, 12] },
  { name: 'Pentatonic Minor', steps: [0, 3, 5, 7, 10, 12] },
  { name: 'Blues Scale', steps: [0, 3, 5, 6, 7, 10, 12] }
];

export const TheoryLab: React.FC = () => {
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const [selectedOctave, setSelectedOctave] = useState<number>(3);
  const [selectedScale, setSelectedScale] = useState<ScaleFormula>(SCALE_FORMULAS[0]);
  const [selectedChordQuality, setSelectedChordQuality] = useState<number>(-1); // -1 means scale mode

  const [activeMidis, setActiveMidis] = useState<number[]>([]);
  const [highlightedMidis, setHighlightedMidis] = useState<number[]>([]);
  
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
    } catch (e) {
      console.error(e);
    }
  }, [selectedRoot, selectedOctave, selectedScale, selectedChordQuality]);

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
        <p className="lab-description">Explore scale patterns, chords, and the Circle of Fifths. Visualize notes on the piano keyboard and guitar fretboard simultaneously.</p>
      </div>

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
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Root Note</label>
              <select 
                value={selectedRoot} 
                onChange={(e) => setSelectedRoot(e.target.value)}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', color: '#fff', outline: 'none' }}
              >
                {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Octave</label>
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
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select Scale Formula</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SCALE_FORMULAS.map((scale) => (
                <button
                  key={scale.name}
                  onClick={() => {
                    setSelectedScale(scale);
                    setSelectedChordQuality(-1);
                  }}
                  className={`btn ${selectedScale.name === scale.name && selectedChordQuality === -1 ? 'btn-primary' : ''}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  {scale.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Or Select Chord Quality</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {CHORD_QUALITIES.map((chord, idx) => (
                <button
                  key={chord.name}
                  onClick={() => setSelectedChordQuality(idx)}
                  className={`btn ${selectedChordQuality === idx ? 'btn-secondary' : ''}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  {chord.name} ({chord.symbols[0]})
                </button>
              ))}
            </div>
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
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', width: '100%' }}>
            Circle of Fifths
          </h3>

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
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.4rem' }}>Key Signatures</h4>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>Relative Minor: <span style={{ color: 'var(--secondary)' }}>{selectedCircleKey.relativeMinor}</span></div>
                  <div>Accidentals: <span>
                    {selectedCircleKey.sharps > 0 ? `${selectedCircleKey.sharps} ♯ (Sharps)` : 
                     selectedCircleKey.sharps < 0 ? `${Math.abs(selectedCircleKey.sharps)} ♭ (Flats)` : 
                     'None (Natural Key)'}
                  </span></div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Diatonic Chords in Key of {selectedCircleKey.name}</h4>
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
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Piano View */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
          3-Octave Piano Keyboard
        </h3>
        <Keyboard 
          activeMidis={activeMidis} 
          highlightCorrectMidis={highlightedMidis}
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
        <Fretboard 
          activeMidis={activeMidis} 
          highlightCorrectMidis={highlightedMidis} 
          onPlayNote={handlePlayNote}
          showAllNoteNames={true}
        />
      </section>

    </div>
  );
};
export default TheoryLab;
