import React from 'react';
import { GUITAR_STRINGS, midiToNoteName } from '../utils/musicTheory';

interface FretboardProps {
  activeMidis?: number[];
  highlightCorrectMidis?: number[];
  rootMidis?: number[]; // the scale/chord root — drawn in its own color
  interactive?: boolean;
  onPlayNote?: (midi: number) => void;
  showAllNoteNames?: boolean; // Highlight all notes on the neck
}

const FRETS_COUNT = 12; // 0 (open) to 12

// Real frets follow the 12th-root-of-two rule: the distance from the nut to
// fret n, as a fraction of scale length, is 1 - 2^(-n/12). That's what makes
// a fretboard taper — each fret is narrower than the last moving up the neck.
const fretPosition = (n: number): number => 1 - Math.pow(2, -n / 12);
const NECK_SPAN = fretPosition(FRETS_COUNT);

// Width of each fret cell as a % of the fretted area (excludes the nut column)
const FRET_WIDTH_PCT = Array.from({ length: FRETS_COUNT }, (_, i) => {
  const fret = i + 1;
  return ((fretPosition(fret) - fretPosition(fret - 1)) / NECK_SPAN) * 100;
});

// Center point of a fret cell as a % of the fretted area — used to place inlays
const fretCenterPct = (fret: number): number =>
  (((fretPosition(fret - 1) + fretPosition(fret)) / 2) / NECK_SPAN) * 100;

// Fret marker configuration: which frets have inlay dots
const getFretDots = (fret: number): 'single' | 'double' | null => {
  if (fret === 12) return 'double';
  if ([3, 5, 7, 9].includes(fret)) return 'single';
  return null;
};

export const Fretboard: React.FC<FretboardProps> = ({
  activeMidis = [],
  highlightCorrectMidis = [],
  rootMidis = [],
  interactive = true,
  onPlayNote,
  showAllNoteNames = false
}) => {
  const handleCellClick = (stringStartMidi: number, fret: number) => {
    if (interactive && onPlayNote) {
      onPlayNote(stringStartMidi + fret);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Nut (Open Strings)</span>
        <span>12th Fret (Octave)</span>
      </div>

      <div className="fretboard-container">
        <div className="fretboard-strings-container">

          {/* Inlay position markers, sitting on the wood between strings 3 & 4 */}
          <div className="inlay-layer">
            {Array.from({ length: FRETS_COUNT }, (_, i) => i + 1).map(fret => {
              const dots = getFretDots(fret);
              if (!dots) return null;
              const left = `${fretCenterPct(fret)}%`;
              return dots === 'single' ? (
                <div key={fret} className="inlay-dot" style={{ left, top: '50%' }} />
              ) : (
                <React.Fragment key={fret}>
                  <div className="inlay-dot" style={{ left, top: '32%' }} />
                  <div className="inlay-dot" style={{ left, top: '68%' }} />
                </React.Fragment>
              );
            })}
          </div>

          {/* Render Guitar Strings */}
          {GUITAR_STRINGS.map((str, strIdx) => {
            const stringNum = strIdx + 1; // 1 = high E (thinnest) ... 6 = low E (thickest)
            return (
              <div key={strIdx} className="guitar-string-row">

                {/* Visual String line running behind note markers */}
                <div className={`guitar-string-line string-thickness-${stringNum}`} />

                {/* Open String Note Label on Headstock */}
                <div
                  className="fret-cell nut-cell"
                  onClick={() => handleCellClick(str.midi, 0)}
                >
                  <span style={{ cursor: 'pointer', zIndex: 11, color: '#00f0ff', fontWeight: 'bold' }}>
                    {str.note}
                    <span style={{ fontSize: '0.65rem', verticalAlign: 'sub' }}>{str.octave}</span>
                  </span>

                  {/* Highlight indicator if open string is playing / in scale */}
                  {(activeMidis.includes(str.midi) || rootMidis.includes(str.midi) || highlightCorrectMidis.includes(str.midi)) && (
                    <div
                      className={`guitar-note-marker ${
                        activeMidis.includes(str.midi) ? 'active' :
                        rootMidis.includes(str.midi) ? 'highlight-root' : 'highlight-correct'
                      }`}
                      style={{ position: 'absolute', right: '-12px', top: '8px' }}
                    >
                      {str.note}
                    </div>
                  )}
                </div>

                {/* Render Fret Cells for this String, tapered to real fret spacing */}
                <div className="fret-area">
                  {Array.from({ length: FRETS_COUNT }).map((_, fIdx) => {
                    const fret = fIdx + 1;
                    const midiNote = str.midi + fret;
                    const noteInfo = midiToNoteName(midiNote);

                    const isActive = activeMidis.includes(midiNote);
                    const isCorrect = highlightCorrectMidis.includes(midiNote);
                    const isRoot = rootMidis.includes(midiNote);

                    const showNote = showAllNoteNames || isActive || isCorrect || isRoot;

                    return (
                      <div
                        key={fret}
                        className="fret-cell"
                        style={{ width: `${FRET_WIDTH_PCT[fIdx]}%` }}
                        onClick={() => handleCellClick(str.midi, fret)}
                      >
                        {showNote && (
                          <div className={`guitar-note-marker ${isActive ? 'active' : isRoot ? 'highlight-root' : isCorrect ? 'highlight-correct' : ''}`}>
                            {noteInfo.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Fret-number ruler, aligned to the same tapered cell widths as
              the strings above so each number sits under its real fret */}
          <div className="fret-ruler-row">
            <div className="fret-ruler-nut">0</div>
            <div className="fret-ruler-area">
              {FRET_WIDTH_PCT.map((pct, i) => (
                <div key={i} className="fret-ruler-cell" style={{ width: `${pct}%` }}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Fretboard;
