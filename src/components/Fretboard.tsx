import React from 'react';
import { GUITAR_STRINGS, midiToNoteName } from '../utils/musicTheory';

interface FretboardProps {
  activeMidis?: number[];
  highlightCorrectMidis?: number[];
  interactive?: boolean;
  onPlayNote?: (midi: number) => void;
  showAllNoteNames?: boolean; // Highlight all notes on the neck
}

export const Fretboard: React.FC<FretboardProps> = ({
  activeMidis = [],
  highlightCorrectMidis = [],
  interactive = true,
  onPlayNote,
  showAllNoteNames = false
}) => {
  const fretsCount = 12; // 0 (open) to 12

  // Fret marker configuration: which frets have dots
  const getFretDots = (fret: number): 'single' | 'double' | null => {
    if (fret === 12) return 'double';
    if ([3, 5, 7, 9].includes(fret)) return 'single';
    return null;
  };

  const handleCellClick = (stringStartMidi: number, fret: number) => {
    if (interactive && onPlayNote) {
      onPlayNote(stringStartMidi + fret);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Nut (Open Strings)</span>
        <span>Fret 3</span>
        <span>Fret 5</span>
        <span>Fret 7</span>
        <span>Fret 9</span>
        <span>Double Dot Octave (Fret 12)</span>
      </div>

      <div className="fretboard-container">
        <div className="fretboard-strings-container">
          
          {/* Render Fret Markers Row (top/middle neck markers) */}
          <div className="fret-marker-row">
            {/* Empty space for headstock string label */}
            <div style={{ flex: '0 0 60px' }} />
            {Array.from({ length: fretsCount }).map((_, i) => {
              const fretNum = i + 1;
              const dots = getFretDots(fretNum);
              return (
                <div key={fretNum} className="fret-marker-cell">
                  {dots === 'single' && <div className="fret-dot" />}
                  {dots === 'double' && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div className="fret-dot" />
                      <div className="fret-dot" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Render Guitar Strings */}
          {GUITAR_STRINGS.map((str, strIdx) => {
            const stringNum = 6 - strIdx; // 6th is bottom (E2), 1st is top (E4)
            return (
              <div key={strIdx} className="guitar-string-row">
                
                {/* Visual String line running behind note markers */}
                <div className={`guitar-string-line string-thickness-${stringNum}`} />

                {/* Open String Note Label on Headstock */}
                <div 
                  className="fret-cell"
                  style={{ fontWeight: 'bold', color: 'var(--primary)', borderRight: '4px solid #f59e0b' }}
                  onClick={() => handleCellClick(str.midi, 0)}
                >
                  <span style={{ cursor: 'pointer', zIndex: 11 }}>
                    {str.note}
                    <span style={{ fontSize: '0.65rem', verticalAlign: 'sub' }}>{str.octave}</span>
                  </span>
                  
                  {/* Highlight indicator if open string is playing */}
                  {activeMidis.includes(str.midi) && (
                    <div 
                      className={`guitar-note-marker active`}
                      style={{ position: 'absolute', right: '-12px', top: '8px' }}
                    >
                      {str.note}
                    </div>
                  )}
                  {highlightCorrectMidis.includes(str.midi) && (
                    <div 
                      className={`guitar-note-marker highlight-correct`}
                      style={{ position: 'absolute', right: '-12px', top: '8px' }}
                    >
                      {str.note}
                    </div>
                  )}
                </div>

                {/* Render Fret Cells for this String */}
                {Array.from({ length: fretsCount }).map((_, fIdx) => {
                  const fret = fIdx + 1;
                  const midiNote = str.midi + fret;
                  const noteInfo = midiToNoteName(midiNote);
                  
                  const isActive = activeMidis.includes(midiNote);
                  const isCorrect = highlightCorrectMidis.includes(midiNote);
                  
                  const showNote = showAllNoteNames || isActive || isCorrect;

                  return (
                    <div
                      key={fret}
                      className="fret-cell"
                      onClick={() => handleCellClick(str.midi, fret)}
                    >
                      {showNote && (
                        <div className={`guitar-note-marker ${isCorrect ? 'highlight-correct' : isActive ? 'active' : ''}`}>
                          {noteInfo.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default Fretboard;
