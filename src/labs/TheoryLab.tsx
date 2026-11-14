import React, { useState, useEffect, useMemo } from 'react';
import { Keyboard } from '../components/Keyboard';
import { LabIcon } from '../components/LabIcon';
import { Fretboard } from '../components/Fretboard';
import { Term } from '../components/Term';
import { ScaleChords } from '../components/ScaleChords';
import { ScaleControlBar, type TheoryTab } from '../components/ScaleControlBar';
import { Segmented } from '../components/Segmented';
import { audio } from '../utils/audio';
import {
  NOTE_NAMES,
  CIRCLE_OF_FIFTHS,
  SCALE_FORMULAS,
  GUITAR_CHORD_SHAPES,
  noteNameToMidi,
  normalizeNoteName
} from '../utils/musicTheory';
import type {
  CircleKeyInfo,
  ScaleFormula
} from '../utils/musicTheory';
import { SCALE_FEELINGS, shortScaleName } from '../utils/glossary';
import { reportProgress } from '../utils/progress';
import { useComputerKeyboardInstrument } from '../hooks/useComputerKeyboardInstrument';
import { useGuitarChordKeyboard } from '../hooks/useGuitarChordKeyboard';

const INSTRUMENT_KEY = 'theory-instrument-view';
const OCTAVE = 3;

type InstrumentView = 'piano' | 'guitar';

// What the colours on the neck and the keys mean.
const HighlightLegend: React.FC = () => (
  <div className="theory-legend">
    <span><i style={{ background: 'var(--note-root)' }} />Home note</span>
    <span><i style={{ background: 'var(--note-scale)' }} />In the scale</span>
  </div>
);

// Interactive Whole vs Half Step Tone Ladder
const ScaleStepLadder: React.FC<{
  rootName: string;
  octave: number;
  scale: ScaleFormula;
  onPlayNote: (midi: number) => void;
  activeMidis: number[];
}> = ({ rootName, octave, scale, onPlayNote, activeMidis }) => {
  const rootMidi = noteNameToMidi(rootName, octave);
  const steps = scale.steps;
  const rootIndex = NOTE_NAMES.indexOf(rootName);

  return (
    <div className="scale-step-ladder">
      <div className="step-ladder-track">
        {steps.map((step, idx) => {
          const noteMidi = rootMidi + step;
          const noteName = NOTE_NAMES[(rootIndex + step) % 12];
          const isActive = activeMidis.includes(noteMidi);
          const isRoot = step === 0 || step === 12;
          const nextStep = steps[idx + 1];
          const intervalToNext = nextStep !== undefined ? nextStep - step : null;

          return (
            <React.Fragment key={idx}>
              <button
                type="button"
                className={`ladder-rung${isRoot ? ' is-root' : ''}${isActive ? ' is-active' : ''}`}
                onClick={() => onPlayNote(noteMidi)}
                title={`Degree ${idx + 1}: ${noteName} (${isRoot ? 'Root / Home Note' : `+${step} semitones`})`}
              >
                <span className="rung-degree">{idx === steps.length - 1 ? '8' : idx + 1}</span>
                <span className="rung-note">{noteName}</span>
              </button>

              {intervalToNext !== null && (
                <div
                  className={`ladder-link${intervalToNext === 1 ? ' is-half' : intervalToNext === 2 ? ' is-whole' : ' is-leap'}`}
                  title={intervalToNext === 1 ? 'Half step: 1 fret / 1 semitone' : intervalToNext === 2 ? 'Whole step: 2 frets / 2 semitones' : `${intervalToNext} semitones`}
                >
                  <span className="link-type">
                    {intervalToNext === 1 ? 'H' : intervalToNext === 2 ? 'W' : `+${intervalToNext}`}
                  </span>
                  <span className="link-frets">
                    {intervalToNext === 1 ? '1 fret' : intervalToNext === 2 ? '2 frets' : `${intervalToNext}fr`}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const TheoryLab: React.FC = () => {
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const selectedOctave = OCTAVE;
  const [selectedScale, setSelectedScale] = useState<ScaleFormula>(SCALE_FORMULAS[0]);
  const [tab, setTab] = useState<TheoryTab>('scale');

  const [activeMidis, setActiveMidis] = useState<number[]>([]);
  const [highlightedMidis, setHighlightedMidis] = useState<number[]>([]);
  const [rootMidis, setRootMidis] = useState<number[]>([]);

  // The circle reflects the toolbar rather than remembering its own key.
  // It used to hold separate state, so picking F# Natural Minor up top left
  // the circle still highlighting C major and listing C major's chords,
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

      selectedScale.steps.forEach((step) => {
        highlighted.push(rootMidi + step);
        highlighted.push(rootMidi + step - 12);
        highlighted.push(rootMidi + step + 12);
        highlighted.push(rootMidi + step + 24);
      });
      setHighlightedMidis(highlighted.filter(midi => midi >= 40 && midi <= 84));

      // The root itself gets its own color in every visible octave
      const roots = [rootMidi - 12, rootMidi, rootMidi + 12, rootMidi + 24];
      setRootMidis(roots.filter(midi => midi >= 40 && midi <= 84));
    } catch (e) {
      console.error(e);
    }
  }, [selectedRoot, selectedOctave, selectedScale]);

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

  // A sound that is not one of the key's own chords: no Journey credit.
  const handleSound = (midis: number[]) => {
    audio.init();
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
      if (saved === 'piano') return 'piano';
    } catch { /* private browsing, fall through to the default */ }
    // A guitar app: the neck first. "Both" from before is read as guitar.
    return 'guitar';
  });
  const chooseInstrument = (view: InstrumentView) => {
    setInstrument(view);
    try {
      localStorage.setItem(INSTRUMENT_KEY, view);
    } catch { /* private browsing, this session only */ }
  };
  const guitarMode = instrument === 'guitar';

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

  // Click on a key segment in the Circle of Fifths. `isMinorClick`
  // distinguishes the inner (relative minor) ring from the outer (major)
  // ring, they represent different home notes over the same note set.
  const handleCircleKeyClick = (keyInfo: CircleKeyInfo, isMinorClick: boolean = false) => {
    reportProgress('theory-circle-key-clicked');

    const rootName = isMinorClick ? keyInfo.relativeMinor.replace(/m$/, '') : keyInfo.name;
    setSelectedRoot(normalizeNoteName(rootName));

    // Clicking the inner ring means "the minor key", so the scale follows the
    // ring. An already-minor choice is left alone, someone exploring
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

      // Major and minor sectors are independently clickable, they
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

  const feeling = SCALE_FEELINGS[selectedScale.name];
  const relative = inMinorKey
    ? { label: 'Relative major', value: `${activeCircleKey.name} major` }
    : { label: 'Relative minor', value: activeCircleKey.relativeMinor };
  const accidentals = activeCircleKey.sharps === 0
    ? 'None'
    : activeCircleKey.sharps > 0
      ? `${activeCircleKey.sharps} ${activeCircleKey.sharps === 1 ? 'sharp' : 'sharps'}`
      : `${-activeCircleKey.sharps} ${activeCircleKey.sharps === -1 ? 'flat' : 'flats'}`;

  return (
    <div className="lab-stack theory">
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="theory" />Theory</h2>
      </div>

      {/* Key, mood, Play and the tabs, pinned together: every tab below
          answers to the same key. */}
      <ScaleControlBar
        root={selectedRoot}
        onRootChange={setSelectedRoot}
        scale={selectedScale}
        onScaleChange={setSelectedScale}
        onPlay={playScaleSweep}
        tab={tab}
        onTab={setTab}
      />

      {tab === 'scale' && (
        <div className="theory-panel" role="tabpanel" id="theory-panel-scale" aria-labelledby="theory-tab-scale">
          <section className="glass-panel theory-card">
            <div>
              <h3 className="theory-card-title">{selectedRoot.replace('#', '♯')} {shortScaleName(selectedScale.name)}</h3>
              <p className="theory-listen">Listen for {feeling?.listenFor ?? 'its own character.'}</p>
            </div>
            <ScaleStepLadder
              rootName={selectedRoot}
              octave={selectedOctave}
              scale={selectedScale}
              onPlayNote={handlePlayNote}
              activeMidis={activeMidis}
            />
            <p className="theory-note"><strong>H</strong> is a half step, one fret. <strong>W</strong> is a whole step, two frets. Tap a note to hear it.</p>
          </section>

          <section className="glass-panel theory-card">
            <div className="theory-card-head">
              <Segmented
                value={instrument}
                onChange={chooseInstrument}
                ariaLabel="Instrument"
                size="sm"
                options={[
                  { value: 'guitar', label: 'Guitar' },
                  { value: 'piano', label: 'Piano' }
                ]}
              />
              <HighlightLegend />
            </div>

            {instrument === 'piano' ? (
              <Keyboard
                activeMidis={activeMidis}
                highlightCorrectMidis={highlightedMidis}
                rootMidis={rootMidis}
                onPlayNote={handlePlayNote}
              />
            ) : (
              <>
                {heldShape && <p className="theory-note"><strong>{heldShape.label}</strong></p>}
                <Fretboard
                  activeMidis={activeMidis}
                  highlightCorrectMidis={heldShape ? heldShapeMidis : highlightedMidis}
                  rootMidis={heldShape ? heldShapeRootMidis : rootMidis}
                  onPlayNote={handlePlayNote}
                  showAllNoteNames={true}
                />
              </>
            )}

            {/* Typing to play, for a computer keyboard: reference, one tap away. */}
            <div className="keys-only theory-keys">
              <button type="button" className="btn" onClick={() => setShowKeyMap(v => !v)} aria-expanded={showKeyMap}>
                Play with your keyboard {showKeyMap ? '▴' : '▾'}
              </button>
              {showKeyMap && (
                <div className="theory-keymap">
                  {guitarMode ? (
                    <>
                      <div>
                        Hold a chord shape:
                        {GUITAR_CHORD_SHAPES.map((shape, i) => (
                          <span key={shape.id}><kbd className="key-hint">{i + 1}</kbd> {shape.id}</span>
                        ))}
                      </div>
                      <div>
                        Pick a string, low to high:
                        <kbd className="key-hint">Z</kbd><kbd className="key-hint">X</kbd><kbd className="key-hint">C</kbd><kbd className="key-hint">V</kbd><kbd className="key-hint">B</kbd><kbd className="key-hint">N</kbd>
                      </div>
                    </>
                  ) : (
                    <div>
                      Keys <kbd className="key-hint">A</kbd> to <kbd className="key-hint">K</kbd>, sharps on
                      <kbd className="key-hint">W</kbd><kbd className="key-hint">E</kbd><kbd className="key-hint">T</kbd><kbd className="key-hint">Y</kbd><kbd className="key-hint">U</kbd>,
                      octave <kbd className="key-hint">Z</kbd> / <kbd className="key-hint">X</kbd> (now <span className="readout">{keyboardOctave}</span>)
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'chords' && (
        <div className="theory-panel" role="tabpanel" id="theory-panel-chords" aria-labelledby="theory-tab-chords">
          <ScaleChords
            rootName={selectedRoot}
            scale={selectedScale}
            onStrum={handleStrumVoicing}
            onSound={handleSound}
          />
        </div>
      )}

      {tab === 'keys' && (
        <div className="theory-panel" role="tabpanel" id="theory-panel-keys" aria-labelledby="theory-tab-keys">
          <section className="glass-panel theory-card theory-keys-card">
            <p className="theory-note">
              <Term k="circleOfFifths">The circle of fifths</Term>: neighbours share all but one note. Tap a key to switch to it and hear its home chord.
            </p>
            <svg className="theory-circle" width="320" height="320" viewBox="0 0 320 320" role="group" aria-label="Circle of fifths">
              {renderCircleSectors()}
              <circle cx="160" cy="160" r="55" fill="var(--input-bg)" stroke="rgba(var(--surface-tint-rgb), 0.08)" strokeWidth="0.5" />
              <text x="160" y="167" fill="var(--primary)" fontSize="20" fontWeight="bold" textAnchor="middle">
                {inMinorKey ? activeCircleKey.relativeMinor : activeCircleKey.name}
              </text>
            </svg>
            <div className="theory-facts">
              <div><small><Term k="relativeMinor">{relative.label}</Term></small><strong>{relative.value}</strong></div>
              <div><small><Term k="accidentals">Sharps or flats</Term></small><strong>{accidentals}</strong></div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default TheoryLab;
