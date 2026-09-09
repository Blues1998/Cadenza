import React, { useEffect, useState } from 'react';
import type { Song } from '../utils/library';

interface DayGridProps {
  byDay: (Song | null)[];
  currentDay: number | null;
  onPick?: (day: number, song: Song | null) => void;
  /** 'sm' is the Home summary, 'md' the Songs page's own header. */
  size?: 'sm' | 'md';
}

// Which days were already finished the last time a grid was on screen.
//
// Module scope rather than a ref, and this is the whole reason the pop works:
// a song is marked complete on its own page, so by the time a grid is in front
// of you again the component has been unmounted and remounted. A per-component
// memory would treat every arrival as a first paint and the animation would
// never once have fired for a real person. Held for the session only — a
// reload is a fresh start and nothing pops.
let seenComplete: Set<number> | null = null;

// Thirty days as thirty marks.
//
// A month of practice is a shape before it is a number: where the run is, where
// it broke, how far in you are. Four states and nothing else — done, started,
// today, not yet — because a legend with six entries is a legend nobody reads.
// The count beside it carries the precision.
export const DayGrid: React.FC<DayGridProps> = ({ byDay, currentDay, onPick, size = 'sm' }) => {
  const [justDone, setJustDone] = useState<ReadonlySet<number>>(new Set());

  // Which days are finished, as a value rather than an array identity. byDay is
  // rebuilt on every render, so an effect keyed on it would run every time.
  const doneKey = byDay
    .map((song, i) => (song?.status === 'complete' ? i + 1 : ''))
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    const done = new Set(doneKey.split(',').filter(Boolean).map(Number));
    if (seenComplete === null) {
      // First grid of the session. Everything already finished is history.
      seenComplete = done;
      return;
    }
    const fresh = [...done].filter(day => !seenComplete?.has(day));
    seenComplete = done;
    if (fresh.length > 0) setJustDone(new Set(fresh));
  }, [doneKey]);

  // The node takes its own class off when the animation says it is finished,
  // rather than on a timer. A timer has to be cancelled somewhere, and every
  // place there is to cancel it is also a place a re-render passes through —
  // which is how the pop ended up frozen on the node it had just played on.
  const endPop = (day: number) => setJustDone(prev => {
    if (!prev.has(day)) return prev;
    const next = new Set(prev);
    next.delete(day);
    return next;
  });

  return (
    <div className={`daygrid daygrid-${size}`} role="list">
      {byDay.map((song, i) => {
        const day = i + 1;
        const isToday = day === currentDay;
        const state = song?.status === 'complete' ? 'done' : song ? 'started' : 'empty';
        const label = song
          ? `Day ${day} · ${song.title}${song.status === 'complete' ? ' · complete' : ''}`
          : `Day ${day} · nothing yet`;
        const className = [
          'daynode',
          `is-${state}`,
          isToday ? 'is-today' : '',
          justDone.has(day) ? 'is-fresh' : ''
        ].filter(Boolean).join(' ');

        return onPick ? (
          <button
            key={day}
            type="button"
            role="listitem"
            className={className}
            title={label}
            aria-label={label}
            onClick={() => onPick(day, song)}
            onAnimationEnd={e => { if (e.animationName === 'dayComplete') endPop(day); }}
          >
            <span className="daynode-num readout">{day}</span>
          </button>
        ) : (
          <span
            key={day}
            role="listitem"
            className={className}
            title={label}
            aria-label={label}
            onAnimationEnd={e => { if (e.animationName === 'dayComplete') endPop(day); }}
          >
            <span className="daynode-num readout">{day}</span>
          </span>
        );
      })}
    </div>
  );
};

export default DayGrid;
