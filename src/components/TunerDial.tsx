import React from 'react';
import { IN_TUNE_CENTS } from '../utils/tuning';

/**
 * The needle.
 *
 * A dial rather than the strip of bar that was here, for one reason: turning
 * a peg is a continuous motion and a dial is the only meter shape that says
 * which way to turn it without a word. Flat is left, sharp is right, and the
 * green is where you stop.
 *
 * The needle takes an already-sprung value. Pitch detection re-reads every
 * audio frame and jitters by a few cents on a perfectly steady note, so the
 * smoothing belongs upstream, where it is applied to the display only and not
 * to anything that judges.
 */

const SPAN = 50;      // cents at either end of the dial
const SWEEP = 80;     // degrees at either end
const PIVOT_X = 100;
const PIVOT_Y = 104;
const DIAL = 78;
const NEEDLE = 68;

const rad = (deg: number) => (deg * Math.PI) / 180;
const point = (deg: number, r: number) => ({
  x: PIVOT_X + r * Math.sin(rad(deg)),
  y: PIVOT_Y - r * Math.cos(rad(deg))
});

const degFor = (cents: number) => (Math.max(-SPAN, Math.min(SPAN, cents)) / SPAN) * SWEEP;

const arc = (from: number, to: number, r: number): string => {
  const a = point(from, r);
  const b = point(to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const TICKS = [-50, -25, 0, 25, 50];

interface TunerDialProps {
  /** Cents off the target, already smoothed. Null when nothing is sounding. */
  cents: number | null;
  inTune: boolean;
}

export const TunerDial: React.FC<TunerDialProps> = ({ cents, inTune }) => {
  const live = cents !== null;
  const angle = degFor(cents ?? 0);

  return (
    <svg className="dial" viewBox="14 18 172 96" role="img" aria-label={
      live
        ? inTune ? 'In tune' : `${Math.round(cents)} cents ${cents > 0 ? 'sharp' : 'flat'}`
        : 'Nothing sounding'
    }>
      <path className="dial-track" d={arc(-SWEEP, SWEEP, DIAL)} />
      {/* Where you stop turning. */}
      <path className="dial-home" d={arc(degFor(-IN_TUNE_CENTS), degFor(IN_TUNE_CENTS), DIAL)} />

      {TICKS.map(cent => {
        const deg = degFor(cent);
        const a = point(deg, DIAL + 3);
        const b = point(deg, DIAL + (cent === 0 ? 11 : 8));
        return <line key={cent} className={`dial-tick${cent === 0 ? ' is-home' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}

      {/* Flat and sharp, in the notation rather than in words — this is read
          from a metre away with a guitar in the way. */}
      <text className="dial-side" x={point(-SWEEP, DIAL + 20).x} y={point(-SWEEP, DIAL + 20).y} textAnchor="middle">♭</text>
      <text className="dial-side" x={point(SWEEP, DIAL + 20).x} y={point(SWEEP, DIAL + 20).y} textAnchor="middle">♯</text>

      <g className={`dial-hand${live ? '' : ' is-idle'}${inTune ? ' is-home' : ''}`} transform={`rotate(${angle.toFixed(2)} ${PIVOT_X} ${PIVOT_Y})`}>
        <line className="dial-needle" x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y - NEEDLE} />
      </g>
      <circle className="dial-pivot" cx={PIVOT_X} cy={PIVOT_Y} r={5} />
    </svg>
  );
};

export default TunerDial;
