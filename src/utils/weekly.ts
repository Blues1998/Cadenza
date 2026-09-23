// The week behind you, out of what this app can actually account for.
//
// Home used to open with "Ready to play?" over a metric reading "0 days
// Streak". Both are the same mistake in different registers: one is a greeting
// addressed to nobody in particular, the other a number with no story around
// it, and a zero in a big typeface reads as a reprimand for a week you might
// have spent entirely reasonably.
//
// What replaces them is an account of the last seven days assembled from the
// three stores that now hold something worth reading back — the practice
// ledger, the chord book, and the tempo log. The rule it follows is the one
// the Fit panel had to learn: say only what the data supports. A quiet week is
// reported as a quiet week. Nothing here invents encouragement, and nothing
// claims a trend the stores cannot evidence.
//
// One claim in particular is deliberately weaker than it could be. The chord
// book stamps `updatedAt` whenever a card is touched, including a change of
// preferred voicing, and keeps no history — so it can say a chord was rated
// this week and what it says now, and it cannot say the chord was *promoted*.
// "3 rated, 2 of them solid" is true. "2 chords promoted" would not be.

import { getChordSkills } from './chordbook';
import { getSongs, practiceLedger, practiceStats, shiftIso, today } from './library';
import { getTempoLog, type TempoRun } from './tempoLog';

export const WEEK = 7;

export interface WeekDay {
  date: string;
  minutes: number;
  /** The last cell. Still open, so an empty one is not yet a day missed. */
  open: boolean;
}

export interface WeekTempo {
  bpm: number;
  seconds: number;
  beatsPerBar: number;
  /**
   * The best in the log from before this week, when this week beat it.
   *
   * The log keeps its last eight runs, so this is "better than anything still
   * on record" and never "your best ever" — which is why nothing built on it
   * is allowed to use the word.
   */
  previous: number | null;
}

export interface WeekSong {
  id: string;
  title: string;
  minutes: number;
}

export interface WeekRecap {
  /** Seven days, oldest first, today last. */
  days: WeekDay[];
  minutes: number;
  /** Days with anything logged on them. */
  played: number;
  streakDays: number;
  chordsRated: number;
  chordsSolid: number;
  tempo: WeekTempo | null;
  /** Where the minutes went, most first. */
  songs: WeekSong[];
  /** Nothing happened at all. Say so plainly rather than dressing it up. */
  quiet: boolean;
  /** All-time, kept separate so no line has to guess which span it means. */
  totalMinutes: number;
  avgConfidence: number | null;
}

/** Midnight at the start of the seventh day back — the same window the ledger uses. */
function weekStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (WEEK - 1));
  return d.getTime();
}

export function weekRecap(): WeekRecap {
  const now = today();
  const since = weekStart();

  const days: WeekDay[] = [];
  for (let back = WEEK - 1; back >= 0; back--) {
    days.push({ date: shiftIso(now, -back), minutes: 0, open: back === 0 });
  }
  const cell = new Map(days.map((day, i) => [day.date, i]));

  const perSong = new Map<string, number>();
  for (const entry of practiceLedger()) {
    const i = cell.get(entry.date);
    if (i === undefined) continue;
    days[i].minutes += entry.minutes;
    if (entry.songId && entry.minutes > 0) {
      perSong.set(entry.songId, (perSong.get(entry.songId) ?? 0) + entry.minutes);
    }
  }

  // A song deleted since it was practised leaves minutes in the ledger with no
  // title to put on them. They still count towards the week; they just cannot
  // be named, so they drop out of this list rather than appearing untitled.
  const titles = new Map(getSongs().map(song => [song.id, song.title]));
  const songs: WeekSong[] = [...perSong.entries()]
    .flatMap(([id, minutes]) => {
      const title = titles.get(id);
      return title === undefined ? [] : [{ id, title, minutes }];
    })
    .sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title));

  const touched = getChordSkills().filter(skill => skill.updatedAt >= since);

  const log = getTempoLog();
  const fastest = log
    .filter(run => run.at >= since)
    .reduce<TempoRun | null>((best, run) => (best === null || run.to > best.to ? run : best), null);
  const held = log.filter(run => run.at < since).reduce((n, run) => Math.max(n, run.to), 0);

  const stats = practiceStats();
  const minutes = days.reduce((n, day) => n + day.minutes, 0);

  return {
    days,
    minutes,
    played: days.filter(day => day.minutes > 0).length,
    streakDays: stats.streakDays,
    chordsRated: touched.length,
    chordsSolid: touched.filter(skill => skill.comfort === 'solid').length,
    tempo: fastest && {
      bpm: fastest.to,
      seconds: fastest.seconds,
      beatsPerBar: fastest.beatsPerBar,
      previous: held > 0 && fastest.to > held ? held : null
    },
    songs,
    quiet: minutes === 0 && touched.length === 0 && fastest === null,
    totalMinutes: stats.totalMinutes,
    avgConfidence: stats.avgConfidence
  };
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * The week in the few words an eyebrow has room for.
 *
 * Ordered by what someone would actually want confirmed first: that they
 * played, then what they worked on. A week with nothing in it says so and
 * stops — there is no third clause encouraging anybody.
 */
export function weekLine(recap: WeekRecap): string {
  if (recap.quiet) return 'Nothing logged this week';
  const said: string[] = [];
  if (recap.minutes > 0) said.push(`${recap.minutes} min over ${plural(recap.played, 'day')}`);
  if (recap.chordsRated > 0) said.push(`${plural(recap.chordsRated, 'chord')} rated`);
  if (recap.tempo) said.push(`${recap.tempo.bpm} bpm held`);
  return `This week · ${said.join(' · ')}`;
}

/** Hours once minutes stop being readable at a glance. */
export function spanLabel(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
}
