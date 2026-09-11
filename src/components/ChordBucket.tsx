import React from 'react';
import { IconPlay } from './Icons';
import { comfortOf } from '../utils/chordbook';
import type { Slot } from '../utils/loop';

interface ChordBucketProps {
  slots: Slot[];
  /** Whether quick play is already showing. */
  open: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Show quick play and take me to it. */
  onPlay: () => void;
}

/**
 * What you have ticked, kept where you can see it.
 *
 * The page is a few hundred chords long, so a selection you cannot see is a
 * selection you stop trusting after the third tick. This rides the bottom of
 * the window and says, in order, what the loop will be — so the answer to
 * "what have I got so far" never costs a scroll back up.
 *
 * The chips are the control as well as the readout: pressing one takes that
 * chord out, which is the edit you actually want at this point, and the tick
 * on its card goes out with it.
 */
export const ChordBucket: React.FC<ChordBucketProps> = ({ slots, open, onRemove, onClear, onPlay }) => (
  <div className="bucket" role="region" aria-label="Picked chords">
    <span className="bucket-count readout">
      {slots.length} chord{slots.length === 1 ? '' : 's'}
    </span>

    <ol className="bucket-chords">
      {slots.map(slot => (
        <li key={slot.id}>
          <button
            type="button"
            className={`chordchip bucket-chip is-${comfortOf(slot.symbol)}`}
            onClick={() => onRemove(slot.id)}
            title={`Take ${slot.symbol} out`}
            aria-label={`Take ${slot.symbol} out of the bucket`}
          >
            {slot.symbol}
            <span className="bucket-x" aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ol>

    <button type="button" className="btn bucket-clear" onClick={onClear}>Clear</button>
    <button type="button" className="btn btn-primary bucket-play" onClick={onPlay}>
      <IconPlay size={14} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
      {open ? 'Back to the loop' : 'Play these'}
    </button>
  </div>
);

export default ChordBucket;
