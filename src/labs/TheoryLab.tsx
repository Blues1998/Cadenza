import React, { useState, useEffect, useMemo } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { Term } from '../components/Term';
import { ScaleChords } from '../components/ScaleChords';
import { ScaleControlBar } from '../components/ScaleControlBar';
import { Segmented } from '../components/Segmented';
import { audio } from '../utils/audio';
import {
  NOTE_NAMES,
  CIRCLE_OF_FIFTHS,
  CHORD_QUALITIES,
  SCALE_FORMULAS,
  GUITAR_CHORD_SHAPES,
  noteNameToMidi,
  normalizeNoteName
} from '../utils/musicTheory';
import type {
  CircleKeyInfo,
  ScaleFormula
} from '../utils/musicTheory';
import { SCALE_FEELINGS, CHORD_FEELINGS } from '../utils/glossary';
import { reportProgress } from '../utils/progress';
import { useComputerKeyboardInstrument } from '../hooks/useComputerKeyboardInstrument';
import { useGuitarChordKeyboard } from '../hooks/useGuitarChordKeyboard';

const INTRO_DISMISSED_KEY = 'theory-intro-dismissed';
const INSTRUMENT_KEY = 'theory-instrument-view';
const CIRCLE_OPEN_KEY = 'theory-circle-open';

type InstrumentView = 'piano' | 'guitar' | 'both';

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
      <span><span style={dot('var(--note-root)')} />Root — the home note</span>
      <span><span style={dot('var(--note-scale)')} />Notes in this {mode}</span>
      <span><span style={dot('var(--note-active)')} />Playing right now</span>
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

  // Circle of Fifths — reference material folded away by default on a page
  // this tall, but the preference sticks once you open it.
  const [showCircle, setShowCircle] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CIRCLE_OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggleCircle = () => {
    setShowCircle(prev => {
      try {
        localStorage.setItem(CIRCLE_OPEN_KEY, prev ? '0' : '1');
      } catch { /* private browsing — this session only */ }
      return !prev;
    });
  };

  // The circle reflects the toolbar rather than remembering its own key.
  // It used to hold separate state, so picking F# Natural Minor up top left
  // the circle still highlighting C major and listing C major's chords —
  // two answers on screen to the question "what key am I in?".
  const inMinorKey = /Minor|Blues/.test(selectedScale.name);
  const activeCircleKey = useMemo(() => {
    const asMinor = CIRCLE_OF_FIFTHS.find(
      k => normalizeNoteName(k.relativeMinor.replace(/m$/, '')) === selectedRoot
    );
    const asMajor = CIRCLE_OF_FIFTHS.find(k => normalizeNoteName(k.name) === selectedRoot);
    return (inMinorKey ? asMinor : asMajor) ?? asMajor ?? asMinor ?? CIRCLE_OF_FIFTHS[0];
  }, [selectedRoot, inMinorKey]);

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
    // Add rather than replace, so a fast strum across several strings (each
    // its own handlePlayNote call) shows every struck note flashing at
    // once instead of each new note cutting the previous one's flash short.
    setActiveMidis((prev) => (prev.includes(midi) ? prev : [...prev, midi]));
    setTimeout(() => {
      setActiveMidis((prev) => prev.filter((m) => m !== midi));
    }, 150);
  };

  // Strum a whole chord shape: roll through its notes low string to high, the
  // way a downstroke actually sounds, and light them up on the neck below.
  const handleStrumVoicing = (midis: number[]) => {
    audio.init();
    reportProgress('theory-diatonic-played');
    reportProgress('theory-chord-shape-played');
    audio.playStrum(midis);
    setActiveMidis(midis);
    setTimeout(() => setActiveMidis([]), 1100);
  };

  // Which instrument the section at the bottom shows. The chosen tab is also
  // the one your computer keyboard plays, so "which panel is listening" is no
  // longer a second control you have to keep in sync in your head.
  const [instrument, setInstrument] = useState<InstrumentView>(() => {
    try {
      const saved = localStorage.getItem(INSTRUMENT_KEY);
      if (saved === 'piano' || saved === 'guitar' || saved === 'both') return saved;
    } catch { /* private browsing — fall through to the default */ }
    return 'both';
  });
  const chooseInstrument = (view: InstrumentView) => {
    setInstrument(view);
    try {
      localStorage.setItem(INSTRUMENT_KEY, view);
    } catch { /* private browsing — this session only */ }
  };
  const guitarMode = instrument === 'guitar';
  const showPiano = instrument !== 'guitar';
  const showGuitar = instrument !== 'piano';

  // The full key maps are reference material, not something you re-read every
  // visit, so they stay one click away instead of costing a screen of height.
  const [showKeyMap, setShowKeyMap] = useState(false);

  // Two mutually-exclusive keyboard input modes, both driving the same
  // handlePlayNote a mouse click already uses: melodic single-note typing
  // (piano-style), or Guitar Mode's chord-shape + per-string pick keys.
  const { octave: keyboardOctave } = useComputerKeyboardInstrument(handlePlayNote, !guitarMode);
  const { heldShape, heldShapeMidis, heldShapeRootMidis } = useGuitarChordKeyboard(handlePlayNote, guitarMode);

  // Play the entire scale in an ascending sweep sequence
  const playScaleSweep = () => {
    audio.init();
    reportProgress('theory-scale-played');
    if (selectedScale.name === 'Major (Ionian)') reportProgress('theory-scale-played:major');
    if (selectedScale.name === 'Natural Minor (Aeolian)') reportProgress('theory-scale-played:minor');
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

  // The toolbar's single Play button — whichever mode is active
  const playSelection = () => {
    if (selectedChordQuality !== -1) playCurrentChord();
    else playScaleSweep();
  };

  // Click on a key segment in the Circle of Fifths. `isMinorClick`
  // distinguishes the inner (relative minor) ring from the outer (major)
  // ring — they represent different home notes over the same note set.
  const handleCircleKeyClick = (keyInfo: CircleKeyInfo, isMinorClick: boolean = false) => {
    reportProgress('theory-circle-key-clicked');
    setSelectedChordQuality(-1); // Switch to scale mode for key

    const rootName = isMinorClick ? keyInfo.relativeMinor.replace(/m$/, '') : keyInfo.name;
    setSelectedRoot(normalizeNoteName(rootName));
    setSelectedOctave(3);

    // Clicking the inner ring means "the minor key", so the scale follows the
    // ring. An already-minor choice is left alone — someone exploring
    // harmonic minor shouldn't be dropped back to natural minor for clicking
    // a different key.
    if (isMinorClick && !inMinorKey) setSelectedScale(SCALE_FORMULAS[1]);
    if (!isMinorClick && inMinorKey) setSelectedScale(SCALE_FORMULAS[0]);

    // Play root tonic chord of this key
    const rootMidi = noteNameToMidi(rootName, 3);
    const chordIntervals = isMinorClick ? [0, 3, 7] : [0, 4, 7]; // minor or major triad
    const chordMidis = chordIntervals.map(i => rootMidi + i);

    audio.playChord(chordMidis, 2.0);
    setActiveMidis(chordMidis);
    setTimeout(() => setActiveMidis([]), 300);
  };

  // Play a diatonic chord from the selected Circle of Fifths key
  const playDiatonicChord = (chordName: string, _degreeIdx: number) => {
    audio.init();
    reportProgress('theory-diatonic-played');
    
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
      const labelY_maj = cy + (outerR + midR) / 2 * Math.sin(labelAngle) + 5;

      const labelX_min = cx + (midR + innerR) / 2 * Math.cos(labelAngle);
      const labelY_min = cy + (midR + innerR) / 2 * Math.sin(labelAngle) + 5;

      const isSelected = activeCircleKey.name === keyInfo.name;

      // Major and minor sectors are independently clickable — they
      // represent different home notes (relative major/minor) over the
      // same note set, so each needs its own handler rather than both
      // falling back to a single click on their shared <g>.
      const handleMajorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleCircleKeyClick(keyInfo, false);
      };
      const handleMinorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleCircleKeyClick(keyInfo, true);
      };

      return (
        <g key={keyInfo.name} style={{ cursor: 'pointer' }}>
          {/* Major Key Sector */}
          <path
            onClick={handleMajorClick}
            d={`M ${x1_mid} ${y1_mid} L ${x1_out} ${y1_out} A ${outerR} ${outerR} 0 0 1 ${x2_out} ${y2_out} L ${x2_mid} ${y2_mid} A ${midR} ${midR} 0 0 0 ${x1_mid} ${y1_mid}`}
            fill={isSelected ? 'rgba(255, 106, 42, 0.2)' : 'var(--surface-2)'}
            stroke={isSelected ? 'var(--primary)' : 'var(--surface-3)'}
            strokeWidth={isSelected ? '2' : '1'}
            className="sector-path"
          />
          {/* Minor Key Sector */}
          <path
            onClick={handleMinorClick}
            d={`M ${x1_in} ${y1_in} L ${x1_mid} ${y1_mid} A ${midR} ${midR} 0 0 1 ${x2_mid} ${y2_mid} L ${x2_in} ${y2_in} A ${innerR} ${innerR} 0 0 0 ${x1_in} ${y1_in}`}
            fill={isSelected ? 'rgba(255, 176, 138, 0.15)' : 'var(--surface-2)'}
            stroke={isSelected ? 'var(--secondary)' : 'var(--surface-3)'}
            strokeWidth={isSelected ? '1.5' : '0.5'}
          />

          {/* Text Labels */}
          <text onClick={handleMajorClick} x={labelX_maj} y={labelY_maj} fill={isSelected ? 'var(--primary)' : 'var(--text-primary)'} fontSize="13.5" fontWeight={isSelected ? 'bold' : 'normal'} textAnchor="middle">
            {keyInfo.name}
          </text>
          <text onClick={handleMinorClick} x={labelX_min} y={labelY_min} fill={isSelected ? 'var(--secondary)' : 'var(--text-secondary)'} fontSize="10.5" textAnchor="middle">
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
        <h2 className="lab-title">Theory &amp; Scales</h2>
      </div>

      {/* Dismissible "Start here" guide for first-time visitors */}
      {showIntro && (
        <section className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', borderColor: 'var(--panel-border-hover)' }}>
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>New here?</h3>
            {[
              ['1', 'Pick a feeling. "Happy & Bright" is the major scale.'],
              ['2', 'Press Play and listen.'],
              ['3', 'Orange is home — the note it all settles back to.']
            ].map(([num, text]) => (
              <div key={num} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, alignSelf: 'center' }}>{num}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <button onClick={dismissIntro} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
            Got it
          </button>
        </section>
      )}

      {/* Pinned controls — the whole page below reacts to these */}
      <ScaleControlBar
        root={selectedRoot}
        onRootChange={setSelectedRoot}
        octave={selectedOctave}
        onOctaveChange={setSelectedOctave}
        scale={selectedScale}
        onScaleChange={(sc) => { setSelectedScale(sc); setSelectedChordQuality(-1); }}
        chordQuality={selectedChordQuality}
        onChordQualityChange={setSelectedChordQuality}
        onPlay={playSelection}
      />

      {/* Plain-English read-out of whatever the toolbar currently has selected */}
      <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '0.85rem 1.1rem', fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
      {selectedChordQuality !== -1 ? (
        <>
          <strong style={{ color: 'var(--text-primary)' }}>{selectedRoot} {CHORD_QUALITIES[selectedChordQuality].name}</strong>
          {' · '}
          <strong className="readout" style={{ color: 'var(--text-primary)' }}>{currentNoteNames().join(' · ')}</strong>
          {' — sounds '}
          <strong style={{ color: 'var(--secondary)' }}>{(CHORD_FEELINGS[CHORD_QUALITIES[selectedChordQuality].name] ?? '').toLowerCase()}</strong>.
        </>
      ) : (
        <>
          <strong style={{ color: 'var(--text-primary)' }}>{selectedRoot} {selectedScale.name}</strong>
          {' · '}
          <strong className="readout" style={{ color: 'var(--text-primary)' }}>{currentNoteNames().join(' · ')}</strong>
          {' — listen for '}{SCALE_FEELINGS[selectedScale.name]?.listenFor ?? 'its distinctive character.'}
        </>
      )}
      </div>

      {/* Every chord this scale contains, with playable fingerings */}
      <ScaleChords
        rootName={selectedRoot}
        scale={selectedScale}
        onStrum={handleStrumVoicing}
      />

      {/* Circle of Fifths — background reference, so it sits after the things
          the toolbar actually drives rather than between them */}
      <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <div style={{ width: '100%', borderBottom: showCircle ? '1px solid rgba(var(--surface-tint-rgb),0.08)' : 'none', paddingBottom: showCircle ? '0.5rem' : 0, display: 'flex', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>
              <Term k="circleOfFifths">Circle of Fifths</Term>
              <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {' '}— currently <strong style={{ color: inMinorKey ? 'var(--secondary)' : 'var(--primary)' }}>
                  {inMinorKey ? activeCircleKey.relativeMinor : `${activeCircleKey.name} major`}
                </strong>
              </span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
              All 12 <Term k="musicalKey">keys</Term>. Neighbours share almost every note. Click one to hear it.
            </p>
          </div>
          <button
            onClick={toggleCircle}
            className="btn"
            aria-expanded={showCircle}
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', flexShrink: 0 }}
          >
            {showCircle ? 'Hide map ▴' : 'Show map ▾'}
          </button>
        </div>

        {showCircle && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          {/* SVG Circle */}
          <svg width="320" height="320" viewBox="0 0 320 320" style={{ transform: 'rotate(0deg)' }}>
            {renderCircleSectors()}
            {/* Inner core empty space */}
            <circle cx="160" cy="160" r="55" fill="var(--input-bg)" stroke="rgba(var(--surface-tint-rgb), 0.08)" strokeWidth="0.5" />
            {/* Core Label */}
            <text x="160" y="155" fill="var(--text-secondary)" fontSize="10" textAnchor="middle">SELECTED KEY</text>
            <text x="160" y="177" fill={inMinorKey ? 'var(--secondary)' : 'var(--primary)'} fontSize="18" fontWeight="bold" textAnchor="middle">
              {inMinorKey ? activeCircleKey.relativeMinor : `${activeCircleKey.name} Maj`}
            </text>
          </svg>

          {/* Key signature info */}
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(var(--surface-tint-rgb),0.04)' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.4rem' }}>About this Key</h4>
              <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><Term k="relativeMinor">Relative Minor</Term>: <span style={{ color: 'var(--secondary)' }}>{activeCircleKey.relativeMinor}</span> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(same notes, sad mood)</span></div>
                <div><Term k="accidentals">Accidentals</Term>: <span>
                  {activeCircleKey.sharps > 0 ? `${activeCircleKey.sharps} ♯ (Sharps)` :
                   activeCircleKey.sharps < 0 ? `${Math.abs(activeCircleKey.sharps)} ♭ (Flats)` :
                   'None (Natural Key)'}
                </span></div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <Term k="diatonicChords">Chords that belong</Term> in the Key of {activeCircleKey.name}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {activeCircleKey.chords.map((chordName, i) => {
                  const degrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
                  return (
                    <button
                      key={chordName}
                      onClick={() => playDiatonicChord(chordName, i)}
                      className="btn"
                      style={{ padding: '0.4rem', fontSize: '0.75rem', flexDirection: 'column', gap: '2px', background: 'var(--surface-2)' }}
                    >
                      <span style={{ fontWeight: 'bold' }}>{chordName}</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{degrees[i]}</span>
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                <Term k="romanNumerals">Roman numerals</Term>: UPPERCASE major, lowercase minor, ° tense.
                Play a few in a row and you have a progression.
              </p>
            </div>
          </div>
        </div>
        )}
      </section>

      {/* Instruments — one panel with tabs. Two full-height panels plus a
          separate "which one listens to the keyboard" bar was over a screen
          and a half of chrome for what is really a single choice. */}
      <section className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            {/* The one control that was still hand-rolled markup wearing the
                segmented class. It looked right but could not slide, which was
                conspicuous on the page's most prominent choice. */}
            <Segmented
              value={instrument}
              onChange={chooseInstrument}
              ariaLabel="Instrument"
              options={[
                { value: 'piano', label: 'Piano' },
                { value: 'guitar', label: 'Guitar' },
                { value: 'both', label: 'Both' }
              ]}
            />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              your keyboard plays the <strong style={{ color: 'var(--text-secondary)' }}>{guitarMode ? 'guitar' : 'piano'}</strong>
              {!guitarMode && <> · octave <strong className="readout" style={{ color: 'var(--text-secondary)' }}>{keyboardOctave}</strong></>}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowKeyMap(v => !v)}
              className="btn"
              aria-expanded={showKeyMap}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
            >
              Which keys? {showKeyMap ? '▴' : '▾'}
            </button>
            {showGuitar && (
              <button
                onClick={() => handlePlayNote(noteNameToMidi('E', 2))}
                className="btn"
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
              >
                Strum Guitar
              </button>
            )}
          </div>
        </div>

        {showKeyMap && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
            {guitarMode ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                  Hold a chord shape:
                  {GUITAR_CHORD_SHAPES.map((shape, i) => (
                    <span key={shape.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <kbd className="key-hint">{i + 1}</kbd>
                      <span>{shape.id}</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                  Pick a string (low → high):
                  <kbd className="key-hint">Z</kbd><kbd className="key-hint">X</kbd><kbd className="key-hint">C</kbd><kbd className="key-hint">V</kbd><kbd className="key-hint">B</kbd><kbd className="key-hint">N</kbd>
                  <span>— no shape held = strings ring open</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                Play the piano with:
                <kbd className="key-hint">A</kbd><kbd className="key-hint">S</kbd><kbd className="key-hint">D</kbd><kbd className="key-hint">F</kbd><kbd className="key-hint">G</kbd><kbd className="key-hint">H</kbd><kbd className="key-hint">J</kbd><kbd className="key-hint">K</kbd>
                <span>+</span>
                <kbd className="key-hint">W</kbd><kbd className="key-hint">E</kbd><kbd className="key-hint">T</kbd><kbd className="key-hint">Y</kbd><kbd className="key-hint">U</kbd>
                <span>for sharps ·</span>
                <kbd className="key-hint">Z</kbd><span>/</span><kbd className="key-hint">X</kbd>
                <span>to change octave</span>
              </div>
            )}
          </div>
        )}

        {/* One legend for the whole section — it was identical in both panels */}
        <HighlightLegend mode={selectedChordQuality !== -1 ? 'chord' : 'scale'} />

        {showPiano && (
          <div>
            <h3 className="surface-label">Piano</h3>
            <Keyboard
              activeMidis={activeMidis}
              highlightCorrectMidis={highlightedMidis}
              rootMidis={rootMidis}
              onPlayNote={handlePlayNote}
            />
          </div>
        )}

        {showGuitar && (
          <div>
            <h3 className="surface-label">
              Fretboard <span className="readout">EADGBE</span>
            </h3>
            {guitarMode && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                <strong style={{ color: heldShape ? 'var(--primary)' : 'var(--text-muted)' }}>{heldShape ? heldShape.label : 'Open strings'}</strong>
              </p>
            )}
            <Fretboard
              activeMidis={activeMidis}
              highlightCorrectMidis={guitarMode && heldShape ? heldShapeMidis : highlightedMidis}
              rootMidis={guitarMode && heldShape ? heldShapeRootMidis : rootMidis}
              onPlayNote={handlePlayNote}
              showAllNoteNames={true}
            />
          </div>
        )}
      </section>

    </div>
  );
};
export default TheoryLab;
