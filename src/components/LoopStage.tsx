import React from 'react';
import { ChordDiagram } from './ChordDiagram';
import { comfortOf } from '../utils/chordbook';
import { slotVoicing, type Slot } from '../utils/loop';

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
 * Three things, in the order they are wanted. The chord under your hands, big
 * enough to check a finger against. The beat, so you know where you are in the
 * bar without counting. And — the one this was really built for — the chord
 * coming next and how long you have got, because changing is the hard part and
 * a barre you find out about on the beat it lands is a barre you miss. Four
 * beats of warning is the difference between practising the change and
 * practising the recovery.
 */
export const LoopStage: React.FC<LoopStageProps> = ({ slots, now, left, pulse, beatsPerBar, countIn }) => {
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
        {/* The bar, as four lamps. Counting is something you should be able to
            stop doing, and a number you have to read is still counting. */}
        <div className="stage-beats" aria-hidden="true">
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <span key={i} className={`stage-beat${i === pulse ? ' is-on' : ''}${i === 0 ? ' is-one' : ''}`} />
          ))}
        </div>
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
