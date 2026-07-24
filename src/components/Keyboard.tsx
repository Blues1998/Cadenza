import React from 'react';
import { NOTE_NAMES, PIANO_START_MIDI, PIANO_END_MIDI } from '../utils/musicTheory';

interface KeyboardProps {
  activeMidis?: number[];
  highlightCorrectMidis?: number[];
  rootMidis?: number[]; // the scale/chord root — drawn in its own color
  interactive?: boolean;
  onPlayNote?: (midi: number) => void;
}

export const Keyboard: React.FC<KeyboardProps> = ({
  activeMidis = [],
  highlightCorrectMidis = [],
  rootMidis = [],
  interactive = true,
  onPlayNote
}) => {
  // Generate keys from C3 (48) to C6 (84)
  const keys: { midi: number; isBlack: boolean; name: string }[] = [];
  for (let midi = PIANO_START_MIDI; midi <= PIANO_END_MIDI; midi++) {
    const noteName = NOTE_NAMES[midi % 12];
    const isBlack = noteName.includes('#');
    keys.push({ midi, isBlack, name: noteName });
  }

  const handleKeyClick = (midi: number) => {
    if (interactive && onPlayNote) {
      onPlayNote(midi);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>C3 (Low)</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>C4 (Middle C)</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>C6 (High)</span>
      </div>

      <div className="keyboard-container">
        {keys.map(({ midi, isBlack, name }) => {
          const isActive = activeMidis.includes(midi);
          const isCorrect = highlightCorrectMidis.includes(midi);
          const isRoot = rootMidis.includes(midi);

          // "Playing" flash wins so scale sweeps stay visible over static highlights
          let className = `piano-key ${isBlack ? 'black' : 'white'}`;
          if (isActive) {
            className += ' active';
          } else if (isRoot) {
            className += ' highlight-root';
          } else if (isCorrect) {
            className += ' highlight-correct';
          }

          return (
            <div
              key={midi}
              className={className}
              onClick={() => handleKeyClick(midi)}
              title={`${name}${Math.floor(midi / 12) - 1}`}
            />
          );
        })}
      </div>
    </div>
  );
};
export default Keyboard;
