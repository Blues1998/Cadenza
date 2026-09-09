import React, { useState } from 'react';
import { ChordCard } from './ChordCard';
import { fitSong, type FitOption } from '../utils/fit';
import { updateSong } from '../utils/library';
import type { Song } from '../utils/library';
import { COMFORT_LABEL, skillFor } from '../utils/chordbook';

/**
 * Where this song sits under your hands, and what a capo would do about it.
 *
 * Not a button that rewrites the song. A capo position is a real decision with
 * a sound and a feel attached, and the app knows one thing about it — which
 * shapes come out. So it shows the eight positions, what each costs in chords
 * you do not have, and lets the choice be made by the person whose hands they
 * are. The recommendation is a row that is already highlighted, not an action
 * that has already happened.
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

  // An empty chord book is not the same as a hand that cannot make the shapes.
  // Told nothing, this panel would announce that four chords are beyond you and
  // list them all as homework, which is a confident claim built out of no
  // information. Until something has been marked it asks instead.
  const rated = now.chords.filter(c => skillFor(c.to) !== undefined).length;
  if (rated === 0) {
    return (
      <section className="song-panel fit">
        <div className="surface-label">
          <span>Fit</span>
          <span className="readout">{now.capo === 0 ? 'no capo' : `capo ${now.capo}`}</span>
        </div>
        <p className="fit-note">
          Mark the chords above as solid, shaky or not yet, and Fit will find the capo position
          that puts this song inside what your hands already do — at the same pitch, so it still
          plays along with the record.
        </p>
      </section>
    );
  }

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

  const headline = now.playable
    ? now.shaky === 0
      ? 'Every chord in this song is one you play solidly.'
      : `You have every chord here — ${now.shaky} of them shaky.`
    : `${now.missing} chord${now.missing === 1 ? '' : 's'} in this song ${now.missing === 1 ? 'is' : 'are'} not in your hands yet.`;

  return (
    <section className="song-panel fit">
      <div className="surface-label">
        <span>Fit</span>
        <span className="readout">{now.capo === 0 ? 'no capo' : `capo ${now.capo}`}</span>
      </div>

      <p className={`fit-headline${now.playable ? ' is-good' : ''}`}>{headline}</p>

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

      {!improves && !now.playable && best.capo === now.capo && (
        <p className="fit-note">
          No capo position gets round this one — these shapes are the work.
        </p>
      )}

      {best.missingChords.length > 0 && (
        <div className="fit-learn">
          <div className="surface-label song-subhead">
            <span>To play it at capo {best.capo}, learn</span>
            <span className="readout">{best.missingChords.length}</span>
          </div>
          <div className="chordcards">
            {best.missingChords.map(symbol => (
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
                  <span key={c.from} className={`fit-chord is-${c.comfort}`} title={`${c.from} → ${c.to} · ${COMFORT_LABEL[c.comfort]}`}>
                    {c.to}
                  </span>
                ))}
              </span>
              <span className="fit-score readout" role="cell">
                {option.missing > 0 ? `${option.missing} to learn` : option.shaky > 0 ? `${option.shaky} shaky` : 'all solid'}
              </span>
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
