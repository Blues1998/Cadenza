import React, { useCallback, useRef } from 'react';
import { NOTE_NAMES, PIANO_START_MIDI, PIANO_END_MIDI } from '../utils/musicTheory';
import { useNotePress } from '../hooks/useNotePress';

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

  const playKey = useCallback((midi: number) => {
    if (interactive && onPlayNote) onPlayNote(midi);
  }, [interactive, onPlayNote]);

  const press = useNotePress(playKey);

  // Black keys overlap the whites, so asking the document what is under the
  // point gets the hit-testing right for free rather than reimplementing it.
  const midiAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const key = el?.closest<HTMLElement>('[data-midi]');
    if (!key || !key.closest('.keyboard-container')) return null;
    const midi = Number(key.dataset.midi);
    return Number.isFinite(midi) ? midi : null;
  };

  // Dragging along the keys is a glissando. Mouse and pen only: the keyboard
  // is wider than a phone screen and has to stay draggable to scroll.
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null) return;
    press.begin(midi);
    if (e.pointerType !== 'touch') {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi !== null) press.moveTo(midi);
  };

  const handlePointerUp = () => {
    dragging.current = false;
    press.end();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
        <span className="readout" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>C3 (Low)</span>
        <span className="readout" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>C4 (Middle C)</span>
        <span className="readout" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>C6 (High)</span>
      </div>

      <div
        className="keyboard-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
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
              data-midi={midi}
              title={`${name}${Math.floor(midi / 12) - 1}`}
            />
          );
        })}
      </div>
    </div>
  );
};
export default Keyboard;
