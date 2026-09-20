import React from 'react';
import { ChordDiagram } from './ChordDiagram';
import { StrumGrid } from './StrumGrid';
import { comfortOf } from '../utils/chordbook';
import { slotVoicing, type Slot } from '../utils/loop';
import type { StrumPattern } from '../utils/strum';

interface LoopStageProps {
  slots: Slot[];
  /** The slot sounding now. -1 while the count-in is still running. */
  now: number;
  /** Beats left of the chord being held. */
  left: number;
  /** Beat within the bar, counting from 0. The count-in counts too. */
  pulse: number;
  beatsPerBar: number;
  /** Beats until the first chord. 0 once the loop is actually running. */
  countIn: number;
  /** What the strumming arm is doing, or null when there is no pattern. */
  pattern: StrumPattern | null;
  /** Which subdivision the arm is on. -1 through the count-in. */
  stroke: number;
}

/**
 * What a pair of hands needs while the loop is running.
 *
 * Everything else in the panel is for building a loop, and building is done by
 * the time anybody presses play. From then on the screen is a metre away, both
 * hands are busy, and it gets looked at for about as long as it takes to fall
 * through the strings — so what it shows has to be readable at that distance
 * in that time, and there has to be almost nothing of it.
 *
 * Three things, left to right, which is also the order they happen in. The
 * chord under your left hand, big enough to check a finger against. The bar
 * itself — the strumming pattern, with the stroke you are on lit, because the
 * right hand is half of what is being practised and reading it off a grid at
 * the bottom of the panel meant reading it off a different part of the room.
 * And the chord coming next with how long you have got, which is the one this
 * was really built for: changing is the hard part, and a barre you find out
 * about on the beat it lands is a barre you have already missed.
 *
 * The pattern is shown, not edited. Everything that edits — the bars, the
 * ordering, the shelf, the pattern field — belongs to the stopped state, and
 * one rule applied everywhere is worth more than four controls kept within
 * reach of a hand that is holding a plectrum.
 */
export const LoopStage: React.FC<LoopStageProps> = ({
  slots, now, left, pulse, beatsPerBar, countIn, pattern, stroke
}) => {
  if (slots.length === 0) return null;

  const pending = now < 0;
  const at = pending ? 0 : now;
  const here = slots[at];
  const after = slots[(at + 1) % slots.length];
  const held = slotVoicing(here);
  const coming = slotVoicing(after);

  // Rounded up and floored at one, so the number never reads 0 while you are
  // still meant to be holding the chord. A countdown that shows 0 for a beat
  // gets read as "now" once and then stops being trusted.
  const inBeats = Math.max(1, Math.ceil(left - 1e-6));

  return (
    <div className={`loopstage${pending ? ' is-countin' : ''}`}>
      <div className="stage-now">
        {held
          ? <ChordDiagram frets={held.frets} fingers={held.fingers} scale={1.32} />
          : <span className="stage-noshape readout">no shape</span>}
        <div className="stage-said">
          <span className={`stage-chord is-${comfortOf(here.symbol)}`}>{here.symbol}</span>
          <span className="stage-shape readout">{held?.label ?? ''}</span>
        </div>
      </div>

      <div className="stage-mid">
        {/* The arm, and where in the bar it has got to. With no pattern there
            is no arm — the chords stay silent under the click — and then the
            bar is just four lamps, which is all there is to say. */}
        {pattern ? (
          <div className="stage-strum">
            <StrumGrid pattern={pattern} live={stroke} />
          </div>
        ) : (
          <div className="stage-beats" aria-hidden="true">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <span key={i} className={`stage-beat${i === pulse ? ' is-on' : ''}${i === 0 ? ' is-one' : ''}`} />
            ))}
          </div>
        )}
        {pending && <span className="stage-in">in {countIn}</span>}
      </div>

      <div className="stage-next">
        <span className="stage-label readout">next</span>
        <div className="stage-nextbox">
          {coming && <ChordDiagram frets={coming.frets} fingers={coming.fingers} scale={0.78} />}
          <div className="stage-said">
            <span className="stage-nextchord">{after.symbol}</span>
            {!pending && (
              <span className="stage-countdown">
                in {inBeats}<span className="stage-countunit"> beat{inBeats === 1 ? '' : 's'}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoopStage;
