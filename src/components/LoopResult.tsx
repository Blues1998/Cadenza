import React from 'react';
import { IconBest, IconX } from './Icons';
import { TEMPO_MAX } from '../utils/chart';

/** The rung a ramp climbs. Two is a step you can take and cannot feel. */
const RAMP = 2;

export interface RunResult {
  /** The loop's signature, for looking its record up and banking against it. */
  signature: string;
  chords: [string, number][];
  beatsPerBar: number;
  /** The tempo the run was actually played at, pinned when it started. */
  tempo: number;
  laps: number;
  bars: number;
  seconds: number;
  /** The record as it stood before this run, or null if there was none. */
  best: number | null;
  /** Set once the run has been banked — see bankRun. */
  banked: { best: number; isBest: boolean; previous: number | null; gained: number; runs: number } | null;
}

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const ordinal = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * What the run came to.
 *
 * Stop used to put the panel back exactly as it was before you played, which
 * meant a drill ended with no evidence that it had happened. Four numbers and
 * a sentence, in the place the stage was standing a second ago — measured, so
 * they are true whatever you decide, and then one press to say the thing the
 * app cannot know, which is whether it held together.
 *
 * The ramp is offered only after that press. Banking a run you did not play
 * cleanly would make the number worthless, and being offered a faster tempo
 * for a run that fell apart would make the offer worthless too; earning the
 * next rung is the whole shape of the thing.
 */
export const LoopResult: React.FC<{
  result: RunResult;
  onBank: () => void;
  onAgain: (tempo: number) => void;
  onClose: () => void;
}> = ({ result, onBank, onAgain, onClose }) => {
  const { tempo, laps, bars, seconds, best, banked } = result;
  // The rung climbs from what was just played, not from the record. Somebody
  // who has held this at 120 and has come back to it at 80 is being offered
  // the next thing to try, and that is 82.
  const next = Math.min(TEMPO_MAX, tempo + RAMP);
  const isRecord = banked?.isBest ?? false;

  const said = banked
    ? banked.isBest
      ? banked.previous === null
        ? 'The first one banked on this loop. That is the number to beat.'
        : `Up ${banked.gained} from ${banked.previous}.`
      : `Banked — your best here is still ${banked.best} bpm. ${ordinal(banked.runs)} clean run.`
    : best === null
      ? 'Nothing banked on this loop yet. If that held together, keep it and you have a number to beat.'
      : tempo > best
        ? `Your best here is ${best} bpm. Keep this one and it becomes ${tempo}.`
        : `Your best here is ${best} bpm.`;

  return (
    <div className={`runcard${isRecord ? ' is-record' : ''}`} role="status">
      <span className="runcard-label readout">
        {isRecord ? <><IconBest size={13} /> new best</> : banked ? 'banked' : 'that run'}
      </span>

      <dl className="runcard-nums">
        <div><dt>{laps === 1 ? 'lap' : 'laps'}</dt><dd className="readout">{laps}</dd></div>
        <div><dt>{bars === 1 ? 'bar' : 'bars'}</dt><dd className="readout">{bars}</dd></div>
        <div><dt>bpm</dt><dd className="readout">{banked?.best ?? tempo}</dd></div>
        <div><dt>held</dt><dd className="readout">{clock(seconds)}</dd></div>
      </dl>

      <p className="runcard-said">{said}</p>

      <div className="runcard-acts">
        {banked
          ? next > tempo && (
              <button type="button" className="btn btn-primary" onClick={() => onAgain(next)}>
                Again at {next}
              </button>
            )
          : (
            <button type="button" className="btn btn-primary" onClick={onBank}>
              Clean — keep it
            </button>
          )}
      </div>

      <button type="button" className="runcard-shut" onClick={onClose} aria-label="Dismiss" title="Dismiss">
        <IconX size={13} />
      </button>
    </div>
  );
};

export default LoopResult;
