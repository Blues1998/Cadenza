import React, { useState } from 'react';
import { CapoBar } from './CapoBar';
import { IconSection } from './Icons';
import { ChordCard } from './ChordCard';
import { fitSong, scoreLine, spokenFor, type FitOption } from '../utils/fit';
import { updateSong } from '../utils/library';
import type { Song } from '../utils/library';
import { COMFORT_LABEL, skillFor } from '../utils/chordbook';

/**
 * Where this song sits under your hands, and what a capo would do about it.
 *
 * Not a button that rewrites the song. A capo position is a real decision with
 * a sound and a feel attached, and the app knows one thing about it — which
 * shapes come out. So it draws the neck, shows what each position costs in
 * chords you do not have, and leaves the choice with the person whose hands
 * they are. Running along the frets only previews; the recommendation is a
 * marked position, not an action that has already happened.
 *
 * Applying one sets the capo and the chart's display lens together. They are
 * two views of a single decision, and letting them drift is how a sheet ends
 * up showing shapes nobody is playing.
 */
export const FitPanel: React.FC<{ song: Song }> = ({ song }) => {
  const [open, setOpen] = useState(false);
  const verdict = fitSong(song);
  if (!verdict) return null;

  const { best, now, options, improves } = verdict;

  const apply = (option: FitOption) => {
    void updateSong(song.id, {
      capo: option.capo,
      // The words never move; only the lens over them, and it moves by the same
      // difference the grips do. Setting it outright would be assuming the
      // chart was written at sounding pitch, which is exactly the assumption
      // the rest of this avoids making.
      ...(song.chart ? { chart: { ...song.chart, transpose: song.chart.transpose + option.shift } } : {})
    });
  };

  // An empty chord book is not the same as a hand that cannot make the shapes.
  // Told nothing, this panel would announce that four chords are beyond you and
  // list them all as homework, which is a confident claim built out of no
  // information. Until something has been marked it asks instead.
  const rated = now.chords.filter(c => skillFor(c.to) !== undefined).length;
  if (rated === 0) {
    return (
      <section className="song-panel fit">
        <div className="surface-label">
          <IconSection kind="fit" /><span>Fit</span>
          <span className="readout">{now.capo === 0 ? 'no capo' : `capo ${now.capo}`}</span>
        </div>
        <CapoBar verdict={verdict} onApply={apply} />
        <p className="fit-note">
          Mark the chords above as solid, shaky or not yet, and Fit will pick the position out of
          these for you — the one that puts this song inside what your hands already do, at the
          same pitch, so it still plays along with the record.
        </p>
      </section>
    );
  }

  // What this panel is allowed to say out loud.
  //
  // fit.ts files a chord nobody has rated under "not in your hands", which is
  // the right call for ordering positions — an unknown may well turn out to be
  // a wall — and the wrong thing to read back. Left as it was, rating a single
  // chord lifted the guard above and the panel began handing out homework for
  // every chord that had simply never been asked about. So the ordering keeps
  // the cautious count and everything with words on it uses this one.
  const here = spokenFor(now);
  const learn = spokenFor(best).learn;

  const headline = here.missing > 0
    ? `${here.missing} chord${here.missing === 1 ? '' : 's'} ${here.all ? 'in this song' : 'you have rated here'} ${here.missing === 1 ? 'is' : 'are'} not in your hands yet.`
    : here.shaky > 0
      ? `You have every chord ${here.all ? 'here' : 'you have rated here'} — ${here.shaky} of them shaky.`
      : here.all
        ? 'Every chord in this song is one you play solidly.'
        : `Every chord you have rated here is one you play solidly.`;

  return (
    <section className="song-panel fit">
      <div className="surface-label">
        <IconSection kind="fit" /><span>Fit</span>
        <span className="readout">{now.capo === 0 ? 'no capo' : `capo ${now.capo}`}</span>
      </div>

      <p className={`fit-headline${here.missing === 0 ? ' is-good' : ''}`}>{headline}</p>

      <CapoBar verdict={verdict} onApply={apply} />

      {now.capo > 0 && (
        <p className="fit-frame readout">
          Reading {now.chords.slice(0, 4).map(c => c.to).join(' · ')}
          {now.chords.length > 4 ? ' …' : ''} as the shapes you finger with the capo at {now.capo}.
        </p>
      )}

      {/* The one sentence this panel exists to say. */}
      {improves && (
        <div className="fit-suggest">
          <span className="fit-suggest-text">
            {best.playable
              ? <>Capo <strong>{best.capo}</strong> puts every chord inside what you already know{best.shaky > 0 ? `, ${best.shaky} of them shaky` : ''}.</>
              : <>Capo <strong>{best.capo}</strong> is the closest fit — {best.missing} still to learn.</>}
            <span className="fit-suggest-note"> Same pitch, different grip.</span>
          </span>
          <button type="button" className="btn btn-primary" onClick={() => apply(best)}>
            Use capo {best.capo}
          </button>
        </div>
      )}

      {!improves && here.missing > 0 && (
        <p className="fit-note">
          No capo position gets round this one — these shapes are the work.
        </p>
      )}

      {learn.length > 0 && (
        <div className="fit-learn">
          <div className="surface-label song-subhead">
            <span>To play it {best.capo === 0 ? 'as it is' : `at capo ${best.capo}`}, learn</span>
            <span className="readout">{learn.length}</span>
          </div>
          <div className="chordcards">
            {learn.map(symbol => (
              <ChordCard key={symbol} symbol={symbol} markable shapes scale={0.56} />
            ))}
          </div>
        </div>
      )}

      <button type="button" className="fit-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? 'Hide the other positions' : 'All capo positions'}
      </button>

      {open && (
        <div className="fit-table" role="table" aria-label="Capo positions">
          <div className="fit-row is-head" role="row">
            <span role="columnheader">Capo</span>
            <span role="columnheader">Shapes</span>
            <span role="columnheader">Fit</span>
            <span />
          </div>
          {[...options].sort((a, b) => a.capo - b.capo).map(option => (
            <div
              key={option.capo}
              className={`fit-row${option.current ? ' is-current' : ''}${option.capo === best.capo ? ' is-best' : ''}`}
              role="row"
            >
              <span className="fit-capo readout" role="cell">{option.capo === 0 ? 'none' : option.capo}</span>
              <span className="fit-shapes" role="cell">
                {option.chords.map(c => (
                  <span
                    key={c.from}
                    className={`fit-chord${skillFor(c.to) ? ` is-${c.comfort}` : ''}`}
                    title={skillFor(c.to) ? `${c.from} → ${c.to} · ${COMFORT_LABEL[c.comfort]}` : `${c.from} → ${c.to} · not rated`}
                  >
                    {c.to}
                  </span>
                ))}
              </span>
              <span className="fit-score readout" role="cell">{scoreLine(option)}</span>
              <span role="cell">
                {option.current
                  ? <span className="fit-now readout">now</span>
                  : <button type="button" className="btn chart-key-preset" onClick={() => apply(option)}>Use</button>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default FitPanel;
