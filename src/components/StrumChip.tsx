import React from 'react';
import { STROKE_FACE, onBeat, parseStrum } from '../utils/strum';

/**
 * A strumming preset, in the alphabet the grid below it already speaks.
 *
 * These chips said "D D U U D U" directly above a grid drawing that same
 * pattern as arrows, so the one screen carried two notations for one idea and
 * the letters were the half nobody could read at a glance. The written form
 * still exists — it is what the field holds and what gets saved — but a thing
 * you pick by looking should be picked by looking.
 *
 * Anything that will not parse falls back to its own text rather than to
 * nothing: a preset nobody can draw is still a preset somebody can press.
 */
export const StrumChip: React.FC<{ text: string; beatsPerBar?: number }> = ({ text, beatsPerBar = 4 }) => {
  const pattern = parseStrum(text, beatsPerBar);
  if (!pattern) return <span className="readout">{text}</span>;

  return (
    <span className="strumchip" aria-hidden="true">
      {pattern.steps.map((stroke, i) => (
        <span
          key={i}
          className={`strumchip-face is-${stroke === '-' ? 'rest' : stroke.toLowerCase()}${onBeat(pattern, i) ? ' is-beat' : ''}`}
        >
          {STROKE_FACE[stroke]}
        </span>
      ))}
    </span>
  );
};

export default StrumChip;
