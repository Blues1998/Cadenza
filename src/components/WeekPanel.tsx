import React from 'react';
import { spanLabel, type WeekRecap } from '../utils/weekly';
import { heldLabel } from '../utils/tempoLog';

/**
 * The last seven days, as a shape and then as sentences.
 *
 * This card replaced four metrics that had no relationship to one another —
 * minutes, a streak, an average confidence and a completion count, four
 * different spans of time stacked in a two-by-two grid. Read together they
 * did not describe anything. Read separately the streak was the only one with
 * any pull, and it spent most of its life reading zero.
 *
 * So: one span, stated once at the top, and everything above the footer
 * belongs to it. Only facts with something to say are rendered — a week with
 * no tempo record simply has no tempo line, rather than a line saying there
 * is none. The two all-time figures worth keeping sit in the footer under
 * their own label, because the failure this card is fixing was mostly a
 * failure to say which stretch of time a number was talking about.
 */

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// A three-minute day should read as a small day, not as a whole week's work.
const FLOOR = 20;
// ...and it should still be visible. Below this the bar rounds away to nothing.
const MIN_SHOWN = 0.09;

export const WeekPanel: React.FC<{ recap: WeekRecap }> = ({ recap }) => {
  const top = Math.max(FLOOR, ...recap.days.map(day => day.minutes));
  const best = recap.songs[0] ?? null;

  return (
    <section className="dash-card weekpanel">
      <div className="card-head">
        <span className="surface-label">This week</span>
        <span className="card-count readout">
          {recap.minutes > 0 ? <><strong>{recap.minutes}</strong> min</> : 'nothing yet'}
        </span>
      </div>

      <div className="weekstrip" role="img" aria-label={
        recap.minutes > 0
          ? `${recap.minutes} minutes over ${recap.played} of the last seven days`
          : 'No practice logged in the last seven days'
      }>
        {recap.days.map(day => {
          const share = day.minutes > 0 ? Math.max(MIN_SHOWN, day.minutes / top) : 0;
          const when = new Date(`${day.date}T12:00:00`);
          return (
            <span
              key={day.date}
              className={`weekbar${day.open ? ' is-today' : ''}${day.minutes > 0 ? ' is-on' : ''}`}
              title={`${when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} — ${day.minutes > 0 ? `${day.minutes} min` : 'nothing logged'}`}
            >
              <span className="weekbar-track">
                <span className="weekbar-fill" style={{ height: `${(share * 100).toFixed(1)}%` }} />
              </span>
              <span className="weekbar-day">{LETTER[when.getDay()]}</span>
            </span>
          );
        })}
      </div>

      {recap.quiet ? (
        <p className="week-quiet">
          Nothing logged in the last seven days. The strip fills in as you play, and every
          figure on this card comes from what you actually did.
        </p>
      ) : (
        <ul className="weekfacts">
          {recap.minutes > 0 && (
            <li className="weekfact">
              <span className="weekfact-value readout">{recap.played}</span>
              <span className="weekfact-said">
                of seven days played{recap.streakDays > 1 ? `, ${recap.streakDays} in a row` : ''}
              </span>
            </li>
          )}
          {recap.chordsRated > 0 && (
            <li className="weekfact">
              <span className="weekfact-value readout">{recap.chordsRated}</span>
              <span className="weekfact-said">
                chord{recap.chordsRated === 1 ? '' : 's'} rated
                {recap.chordsSolid > 0 ? `, ${recap.chordsSolid} of them solid` : ''}
              </span>
            </li>
          )}
          {recap.tempo && (
            <li className="weekfact">
              <span className="weekfact-value readout">{recap.tempo.bpm}</span>
              <span className="weekfact-said">
                bpm held {heldLabel(recap.tempo.seconds)}
                {recap.tempo.previous !== null ? `, up from ${recap.tempo.previous}` : ''}
              </span>
            </li>
          )}
        </ul>
      )}

      <div className="week-foot card-foot">
        {best && best.minutes > 0 && (
          <span className="week-most">Most of it on <strong>{best.title}</strong></span>
        )}
        <span className="week-alltime readout">
          All time · {spanLabel(recap.totalMinutes)}
          {recap.avgConfidence !== null && ` · ${recap.avgConfidence.toFixed(1)}/10 confidence`}
        </span>
      </div>
    </section>
  );
};

export default WeekPanel;
