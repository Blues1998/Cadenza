import React, { useEffect, useRef } from 'react';

/**
 * The metronome, drawn — and the one thing on this page that knows the tempo.
 *
 * A real metronome ticks at each end of its swing, once per beat, so the arm
 * is at an extreme on the beat and passing through upright between two. For
 * small angles a pendulum's angle genuinely is θmax·cos(ωt), which means the
 * beats and the degrees sit on the same cosine and nothing has to be faked to
 * make the picture agree with the sound.
 *
 * Everything here is drawn from a clock rather than from React state. A beat
 * is an audio-clock event a few milliseconds wide and a render is not, so a
 * component that re-rendered per beat would show you a pulse that was near
 * enough — and near enough is the one thing a timing page cannot be. The
 * timing graph beside it takes refs for exactly the same reason.
 */

/** Degrees either side of upright. */
const SWING = 25;
const PIVOT_X = 100;
const PIVOT_Y = 104;
const ARM = 84;

const rad = (deg: number) => (deg * Math.PI) / 180;
const tip = (deg: number) => ({
  x: PIVOT_X + ARM * Math.sin(rad(deg)),
  y: PIVOT_Y - ARM * Math.cos(rad(deg))
});

const left = tip(-SWING);
const right = tip(SWING);
const ARC = `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} A ${ARM} ${ARM} 0 0 1 ${right.x.toFixed(1)} ${right.y.toFixed(1)}`;

/**
 * How long a cell stays lit, as a fraction of its own tick.
 *
 * Short, and then nothing. A cell that faded across the whole gap to the next
 * one would leave every cell half-lit at sixteenths, and "which one is now"
 * is the entire job.
 */
const HOLD = 0.6;

/**
 * How a bar is counted out loud, after the number on the beat.
 *
 * "One and two and", "one trip-let two trip-let", "one-ee-and-a" — the
 * vocabulary a teacher uses in the room, and the only part of subdividing
 * that is actually hard to pick up from a click alone.
 */
const COUNT: Record<number, string[]> = {
  1: [],
  2: ['&'],
  3: ['trip', 'let'],
  4: ['e', '&', 'a']
};

interface PendulumProps {
  beatsPerBar: number;
  /** Ticks to a beat: 1 quarters, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: number;
  /**
   * Where the beat is, continuously, in the time the click is *heard* — 0 on
   * the first beat of the run, 4.5 halfway through the fifth, null when
   * nothing is running.
   */
  at: () => number | null;
  /** Called once each time the heard bar changes, for a readout elsewhere. */
  onBar?: (bar: number) => void;
}

export const Pendulum: React.FC<PendulumProps> = ({ beatsPerBar, subdivision, at, onBar }) => {
  const arm = useRef<SVGGElement | null>(null);
  const lit = useRef<(SVGElement | HTMLElement | null)[]>([]);
  const angle = useRef(0);
  const bar = useRef<number | null>(null);
  const bell = useRef(onBar);
  bell.current = onBar;

  useEffect(() => {
    const cells = beatsPerBar * subdivision;
    // A swinging arm is the whole point of the drawing and also exactly what
    // somebody who has asked for less motion is asking not to have. The grid
    // still lights, because that is information rather than decoration.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;

    const draw = () => {
      const t = at();

      // Upright when the click stops, eased rather than frozen mid-swing: a
      // metronome at rest is a vertical arm, and snapping there reads as a
      // bug in the drawing.
      const want = t === null || still ? 0 : SWING * Math.cos(Math.PI * t);
      angle.current = t === null || still ? angle.current + (want - angle.current) * 0.12 : want;
      arm.current?.setAttribute('transform', `rotate(${angle.current.toFixed(2)} ${PIVOT_X} ${PIVOT_Y})`);

      const tick = t === null ? null : t * subdivision;
      for (let i = 0; i < cells; i++) {
        const el = lit.current[i];
        if (!el) continue;
        let on = 0;
        if (tick !== null) {
          const since = ((((tick - i) % cells) + cells) % cells) / 1;
          if (since < HOLD) {
            const f = 1 - since / HOLD;
            on = f * f;
          }
        }
        el.style.opacity = on.toFixed(3);
      }

      if (bell.current) {
        const now = t === null ? null : Math.floor(t / beatsPerBar);
        if (now !== bar.current) {
          bar.current = now;
          bell.current(now ?? 0);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [at, beatsPerBar, subdivision]);

  return (
    <div className="pendulum">
      {/* Cropped to what is actually drawn. The geometry above is written in
          round numbers around a pivot at 100,104 because that is the readable
          way to write it; the box then takes only the strip the arm sweeps,
          so the panel is not paying for the corners. */}
      <svg className="pendulum-case" viewBox="59 18 82 92" aria-hidden="true">
        <path className="pendulum-arc" d={ARC} />
        {[left, right].map((end, i) => (
          <line
            key={i}
            className="pendulum-stop"
            x1={end.x}
            y1={end.y}
            x2={PIVOT_X + (ARM + 7) * Math.sin(rad(i === 0 ? -SWING : SWING))}
            y2={PIVOT_Y - (ARM + 7) * Math.cos(rad(i === 0 ? -SWING : SWING))}
          />
        ))}
        <g ref={arm}>
          <line className="pendulum-arm" x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y - ARM} />
          {/* The weight rides high on the arm, which is what makes a real one
              slow: the further up it slides, the longer the swing. */}
          <rect className="pendulum-weight" x={PIVOT_X - 9} y={PIVOT_Y - ARM + 22} width={18} height={10} rx={2.5} />
        </g>
        <circle className="pendulum-pivot" cx={PIVOT_X} cy={PIVOT_Y} r={4.5} />
      </svg>

      {/* One column per tick, grouped by beat, with the count written under
          it — the syllables every teacher uses, which is the thing worth
          learning and the thing a row of anonymous dots could never say. The
          words sit below the bars rather than inside them so that a lit cell
          never has to carry text it would swallow. */}
      <div className="beatgrid" aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, b) => (
          <div className="beatgrid-group" key={b}>
            {Array.from({ length: subdivision }, (_, s) => {
              const i = b * subdivision + s;
              return (
                <div className={`beatgrid-cell${s === 0 ? ' is-beat' : ''}${i === 0 ? ' is-one' : ''}`} key={s}>
                  <span className="beatgrid-bar">
                    <i className="beatgrid-lit" ref={el => { lit.current[i] = el; }} />
                  </span>
                  <span className="beatgrid-say readout">{s === 0 ? b + 1 : COUNT[subdivision][s - 1]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pendulum;
