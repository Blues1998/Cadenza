import React from 'react';
import {
  countLabel,
  nextStroke,
  onBeat,
  perBar,
  withStroke,
  withoutBar,
  type Stroke,
  type StrumPattern
} from '../utils/strum';

/** An arrow says which way the arm went; a letter would have to be learned. */
const FACE: Record<Stroke, string> = { D: '↓', U: '↑', X: '✕', '-': '·' };
const NAME: Record<Stroke, string> = { D: 'Down', U: 'Up', X: 'Muted', '-': 'No contact' };

interface StrumGridProps {
  pattern: StrumPattern;
  /** Which subdivision is sounding, counting on past the end. -1 for none. */
  live?: number;
  /** Given the whole pattern rewritten, when a cell or a bar is pressed. */
  onChange?: (text: string) => void;
}

/**
 * A strumming pattern as the grid a hand plays it on.
 *
 * The written form is a shorthand and reading it is a skill; this is what it
 * resolved to, which is not the same thing and is the thing you are about to
 * hear. Every cell can be pressed, so a pattern that came out wrong is fixed
 * where it is wrong rather than by rewriting the line and trying again.
 *
 * Pressing a cell changes that cell and nothing else. The placement rule that
 * decides where a written stroke lands has already run by the time this is
 * drawn, and re-running it on an edit would let one press shunt the whole
 * pattern sideways — so a cell only ever offers the strokes its own slot can
 * hold, and the edit is written back with its bar lines intact.
 *
 * The count runs above it — 1 & 2 & — because that is the part people already
 * have, and against it the pattern reads without being explained.
 */
export const StrumGrid: React.FC<StrumGridProps> = ({ pattern, live = -1, onChange }) => {
  const slots = perBar(pattern);
  const sounding = live >= 0 ? live % pattern.steps.length : -1;

  return (
    <div className="strumgrid" role={onChange ? 'group' : 'img'}
      aria-label={onChange ? 'Strumming pattern' : `Strumming pattern: ${pattern.steps.join(' ')}`}>
      {Array.from({ length: pattern.bars }, (_, bar) => (
        <div className="strumbar" key={bar} style={{ ['--slots' as string]: slots }}>
          {pattern.steps.slice(bar * slots, (bar + 1) * slots).map((stroke, i) => {
            const index = bar * slots + i;
            const className = [
              'strumcell',
              `is-${stroke === '-' ? 'rest' : stroke.toLowerCase()}`,
              onBeat(pattern, index) ? 'is-beat' : '',
              index === sounding ? 'is-live' : ''
            ].filter(Boolean).join(' ');
            const label = `${NAME[stroke]} on ${countLabel(pattern, index)}`;

            if (!onChange) {
              return (
                <span key={index} className={className} title={label}>
                  <span className="strumcell-count">{countLabel(pattern, index)}</span>
                  <span className="strumcell-face" aria-hidden="true">{FACE[stroke]}</span>
                </span>
              );
            }
            // Down slots offer down, muted, pass; up slots offer up, muted,
            // pass. Which way the arm is going at this point in the bar is not
            // a choice anybody has, so it is not offered as one.
            const next = nextStroke(index, stroke);
            return (
              <button
                key={index}
                type="button"
                className={className}
                onClick={() => onChange(withStroke(pattern, index, next))}
                title={`${label} — press for ${NAME[next].toLowerCase()}`}
                aria-label={label}
              >
                <span className="strumcell-count">{countLabel(pattern, index)}</span>
                <span className="strumcell-face" aria-hidden="true">{FACE[stroke]}</span>
              </button>
            );
          })}
          {/* A bar is easy to gain — writing one stroke too many for the metre
              adds one — so it has to be as easy to lose. Not on a one-bar
              pattern: the field is where you get rid of that. */}
          {onChange && pattern.bars > 1 && (
            <button
              type="button"
              className="strumbar-drop"
              onClick={() => onChange(withoutBar(pattern, bar))}
              aria-label={`Remove bar ${bar + 1}`}
              title={`Remove bar ${bar + 1}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default StrumGrid;
