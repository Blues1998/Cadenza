// Where the click has actually been.
//
// Not a record and never a claim about anybody's playing: a metronome has no
// ear, so the only honest thing this page can say is which tempos you ran it
// at and for how long. That turns out to be the question you have when you
// sit down with the guitar — "what was I at last night?" — and it is one the
// app could already answer and did not.
//
// Kept in localStorage rather than in the library. It is a convenience, it is
// worthless to anybody else, and it has no business in an export of your
// songs alongside the chord book and the tempo records, which are claims.

const KEY = 'cadenza-tempos';
const KEEP = 8;

/**
 * Under this it was a slider being dragged, not a tempo being practised.
 *
 * Fifteen seconds is about six bars at a hundred — long enough that you meant
 * it, short enough that a genuine "that is too fast, back it off" still gets
 * recorded, because knowing where you gave up is worth as much as knowing
 * where you stayed.
 */
export const MIN_HELD_MS = 15_000;

/** Two runs this close together at the same setting are one run. */
const SAME_SITTING_MS = 30 * 60 * 1000;

export interface TempoRun {
  /** Where the run began. */
  from: number;
  /** Where it ended — the same number unless the ramp was on. */
  to: number;
  beatsPerBar: number;
  /** When it finished. */
  at: number;
  seconds: number;
}

const read = (): TempoRun[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (run): run is TempoRun =>
        typeof run === 'object' && run !== null &&
        typeof (run as TempoRun).from === 'number' &&
        typeof (run as TempoRun).to === 'number' &&
        typeof (run as TempoRun).seconds === 'number'
    );
  } catch {
    return [];
  }
};

const write = (runs: TempoRun[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    // A full or blocked store is not worth failing a metronome over.
  }
};

export const getTempoLog = (): TempoRun[] => read();

/**
 * Remember a run, newest first.
 *
 * Stopping to change the time signature and starting again is one piece of
 * practice, not two entries, so a run at the same setting in the same sitting
 * adds its seconds to the one already there rather than pushing it down.
 */
export function logTempo(run: Omit<TempoRun, 'at'>): TempoRun[] {
  if (run.seconds * 1000 < MIN_HELD_MS) return read();
  const runs = read();
  const head = runs[0];
  if (
    head &&
    head.from === run.from &&
    head.to === run.to &&
    head.beatsPerBar === run.beatsPerBar &&
    Date.now() - head.at < SAME_SITTING_MS
  ) {
    runs[0] = { ...head, at: Date.now(), seconds: head.seconds + run.seconds };
  } else {
    runs.unshift({ ...run, at: Date.now() });
  }
  const kept = runs.slice(0, KEEP);
  write(kept);
  return kept;
}

export function clearTempoLog(): TempoRun[] {
  write([]);
  return [];
}

/**
 * "4 min", "40 sec" — the shape a practice log is read in.
 *
 * Rounded down once it reaches minutes, and not reaching them until two are
 * genuinely there. Rounding to the nearest minute reported a minute and a half
 * as "2 min", which is a quarter more than was actually held; a figure this
 * app puts on the front page should err towards saying you did slightly less
 * than you did, never slightly more.
 */
export const heldLabel = (seconds: number): string =>
  seconds < 120 ? `${Math.round(seconds)} sec` : `${Math.floor(seconds / 60)} min`;

/** "just now", "earlier today", "yesterday", "3 days ago". */
export function whenHeld(at: number): string {
  const day = 24 * 60 * 60 * 1000;
  const age = Date.now() - at;
  if (age < 10 * 60 * 1000) return 'just now';
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  if (at >= startOfToday) return 'earlier today';
  if (at >= startOfToday - day) return 'yesterday';
  return `${Math.round((startOfToday - at) / day) + 1} days ago`;
}
