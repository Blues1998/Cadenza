import React, { useState } from 'react';
import { skillFor } from '../utils/chordbook';
import { MAX_CAPO, scoreLine, type FitOption, type FitVerdict } from '../utils/fit';

/**
 * The capo, as a thing you move rather than a number you are told.
 *
 * Fit's whole argument is that the same song under a different clamp is a
 * different set of shapes, and that argument was being made in a paragraph.
 * Here the neck is drawn, the bar sits where the song has it, and running
 * along the frets re-letters the chords underneath — so the trade is read the
 * way it is actually made, by looking at what comes out. Pressing a fret is
 * what commits it; hovering only ever previews.
 *
 * Nothing here claims more than it knows. A chord you have rated is coloured
 * with that rating; one you have never had an opinion about is left plain,
 * because "not yet marked" and "cannot play it" are different facts and only
 * one of them is yours.
 */

/**
 * Where the frets fall.
 *
 * Each one sits 1 − 2^(−n/12) of the way along the scale, which is why they
 * crowd as they climb. Spacing them evenly would draw a different instrument,
 * and this one is meant to be recognisable at a glance by someone holding the
 * real thing.
 */
const SPAN = 1 - Math.pow(2, -MAX_CAPO / 12);
const along = (n: number): number => (1 - Math.pow(2, -n / 12)) / SPAN;

/** Room left of the nut for "no capo" — the position a guitar is already in. */
const NUT = 10;

const x = (n: number): number => NUT + along(n) * (100 - NUT);

/** A capo goes just behind the fret it is named for, not on top of it. */
const clampAt = (n: number): number => x(n - 1) + (x(n) - x(n - 1)) * 0.66;

const FRETS = Array.from({ length: MAX_CAPO }, (_, i) => i + 1);
const SLOTS = [0, ...FRETS];
// Looking at the neck the way tab is written: high e along the top.
const STRINGS = [0, 1, 2, 3, 4, 5];
const INLAYS = [3, 5, 7];

const capoWord = (capo: number): string => (capo === 0 ? 'No capo' : `Capo ${capo}`);


interface CapoBarProps {
  verdict: FitVerdict;
  onApply: (option: FitOption) => void;
}

export const CapoBar: React.FC<CapoBarProps> = ({ verdict, onApply }) => {
  const { now, best, options, improves } = verdict;
  const [preview, setPreview] = useState<number | null>(null);

  const at = preview ?? now.capo;
  const shown = options.find(option => option.capo === at) ?? now;
  const moved = preview !== null && preview !== now.capo;

  return (
    <div className="capobar">
      <div className="capobar-neck" aria-hidden="true">
        {STRINGS.map(i => (
          <span
            key={`s${i}`}
            className="capobar-string"
            style={{ top: `${((i + 0.5) / STRINGS.length) * 100}%`, height: `${0.9 + i * 0.26}px` }}
          />
        ))}
        {FRETS.map(n => (
          <span key={`f${n}`} className="capobar-fret" style={{ left: `${x(n)}%` }} />
        ))}
        {INLAYS.map(n => (
          <span key={`i${n}`} className="capobar-inlay" style={{ left: `${(x(n - 1) + x(n)) / 2}%` }} />
        ))}
        <span className={`capobar-nut${at === 0 ? ' is-on' : ''}`} style={{ left: `${NUT}%` }} />
        <span
          className={`capobar-clamp${at === 0 ? ' is-off' : ''}`}
          style={{ left: `${clampAt(Math.max(1, at))}%` }}
        />
      </div>

      <div className="capobar-frets" role="group" aria-label="Capo position">
        {SLOTS.map(n => {
          const option = options.find(o => o.capo === n);
          return (
            <button
              key={n}
              type="button"
              className={`capobar-slot${n === now.capo ? ' is-on' : ''}${improves && n === best.capo ? ' is-best' : ''}`}
              style={{ width: `${n === 0 ? NUT : x(n) - x(n - 1)}%` }}
              aria-pressed={n === now.capo}
              title={option ? `${capoWord(n)} — ${scoreLine(option)}` : capoWord(n)}
              onMouseEnter={() => setPreview(n)}
              onFocus={() => setPreview(n)}
              onMouseLeave={() => setPreview(null)}
              onBlur={() => setPreview(null)}
              onClick={() => { if (option) onApply(option); }}
            >
              {n === 0 ? 'off' : n}
            </button>
          );
        })}
      </div>

      {/* Keyed on the position so the letters redraw as the bar lands — the
          change is the point, and a row that quietly swapped its own text
          would let it pass unnoticed. */}
      <div className="capobar-shapes" key={shown.capo}>
        {shown.chords.map(chord => (
          <span
            key={chord.from}
            className={`fit-chord${skillFor(chord.to) ? ` is-${chord.comfort}` : ''}`}
            title={`${chord.from} at ${capoWord(shown.capo).toLowerCase()} is ${chord.to}`}
          >
            {chord.to}
          </span>
        ))}
      </div>

      <p className="capobar-said readout">
        {`${capoWord(shown.capo)} · ${scoreLine(shown)}`}
        {moved && <span className="capobar-press"> — press to move it</span>}
      </p>
    </div>
  );
};

export default CapoBar;
