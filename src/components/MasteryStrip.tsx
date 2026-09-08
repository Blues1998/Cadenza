import React from 'react';
import { getMastery, getStat } from '../utils/mastery';

export interface MasteryItem {
  id: string;
  label: string;   // two or three characters — this is a row of thirteen
  name: string;    // the full name, for the tooltip
}

interface MasteryStripProps {
  items: MasteryItem[];
  unlocked?: number;         // how many of `items` are currently in play
  highlightId?: string | null;  // the item just answered
  onReset?: () => void;
}

// Where the accent starts and finishes coming in. Below the floor a bar stays
// grey, at the ceiling it is fully lit. Deliberately narrower than 0..1: mapped
// across the whole range, an item at 0.5 came out looking about as orange as
// one at 0.9, so the colour said nothing the height had not already said. This
// puts the whole colour range across the stretch that matters — the run from
// "getting there" to "known" — and holds everything below it grey.
const WARM_FLOOR = 0.35;
const WARM_CEIL = 0.9;

// What you know, as a row of bars — one per interval or chord quality.
//
// The score is drawn twice over: a bar grows as an item is learned, and its
// colour warms from grey to the accent as it does. Two encodings of one
// number is redundant on purpose, because the useful reading here is the
// shape of the whole row at a glance — where the dips are — rather than any
// single value. Locked items are outlines, so the ladder ahead is visible
// without being noise.
export const MasteryStrip: React.FC<MasteryStripProps> = ({
  items,
  unlocked = items.length,
  highlightId = null,
  onReset
}) => {
  const known = items.filter((item, i) => i < unlocked && getMastery(item.id) >= 0.7).length;

  return (
    <div className="mastery">
      <div className="surface-label mastery-head">
        <span>Mastery</span>
        <span className="readout">
          {String(known).padStart(2, '0')}/{unlocked}
        </span>
        {onReset && (
          <button type="button" className="mastery-reset" onClick={onReset} title="Clear mastery history">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 2v6h6" /><path d="M3.5 13a9 9 0 1 0 2.1-7.4L3 8" />
            </svg>
          </button>
        )}
      </div>

      <div className="mastery-row">
        {items.map((item, i) => {
          const locked = i >= unlocked;
          const mastery = locked ? 0 : getMastery(item.id);
          const stat = getStat(item.id);
          const title = locked
            ? `${item.name} — not yet unlocked`
            : `${item.name} — ${Math.round(mastery * 100)}%${stat ? ` (${stat.correct}/${stat.seen})` : ' (new)'}`;

          return (
            <div
              key={item.id}
              className={`mastery-cell${locked ? ' is-locked' : ''}${item.id === highlightId ? ' is-latest' : ''}`}
              title={title}
            >
              <span
                className="mastery-bar"
                style={{
                  ['--m' as string]: mastery,
                  ['--warm' as string]: Math.max(0, Math.min(1, (mastery - WARM_FLOOR) / (WARM_CEIL - WARM_FLOOR)))
                } as React.CSSProperties}
              >
                <span className="mastery-bar-fill" />
              </span>
              <span className="mastery-tick readout">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default MasteryStrip;
