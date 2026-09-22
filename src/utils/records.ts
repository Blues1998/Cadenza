// The fastest you have held each loop.
//
// Everything else the app counts is a position: 2 of 10 chords marked, 0 of 15
// journey steps, 860 minutes logged. A position tells you where you stand and
// never that you moved, which is the one thing practice is for — so this is
// the other kind of number, and it is the only one in the app that can go up.
//
// Keyed by the loop's signature, which is the chords and the metre and
// deliberately not the tempo: running the same progression a little faster is
// the same practice, and the whole point here is to be able to say that it was
// faster. See loopSignature in loopbook, which is the same key the recent
// shelf dedupes by.
//
// Banked rather than measured. Quick play has no ear — it is playing the
// chords to you, so a "record" it set by itself would only prove that the
// slider can be dragged. The run's numbers are measured and shown whatever
// happens; it becomes a record when you say it held together, which is a fact
// only the person holding the guitar has. One press, and the number means
// something.

import { STORE_CHANGE_EVENT, clearStore, putRecords, readAll } from './db';

export interface LoopRecord {
  /** The loop's signature. Chords and metre — see loopSignature. */
  id: string;
  /** Kept so a record can name the loop it belongs to without one to hand. */
  chords: [string, number][];
  beatsPerBar: number;
  /** The fastest tempo banked clean. */
  best: number;
  /** What it was before that, so a card can say what the gain was. */
  previous: number | null;
  /** When the best was set. */
  setAt: number;
  /** How many clean runs have been banked here, records or not. */
  runs: number;
}

let records = new Map<string, LoopRecord>();
let loaded = false;

const announce = () => window.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT));

/** Loaded by initLibrary, alongside the songs, the chord book and the loops. */
export async function loadRecords(): Promise<void> {
  if (loaded) return;
  const rows = await readAll<LoopRecord>('records');
  records = new Map(
    rows
      .filter(r => typeof r.id === 'string' && typeof r.best === 'number' && r.best > 0)
      .map(r => [r.id, r])
  );
  loaded = true;
}

export const getRecords = (): LoopRecord[] => [...records.values()];

/** The record for one loop, or undefined if it has never been banked. */
export const recordFor = (signature: string): LoopRecord | undefined => records.get(signature);

/** Just the number, for the places that only want to print it. */
export const bestFor = (signature: string): number | null => records.get(signature)?.best ?? null;

export interface BankInput {
  signature: string;
  chords: [string, number][];
  beatsPerBar: number;
  tempo: number;
}

export interface Banked {
  best: number;
  /**
   * Whether this run set the best.
   *
   * Not derivable from `gained`, which is 0 for the very first run banked on a
   * loop — there was no old number for it to be faster than, and that run is
   * still the record.
   */
  isBest: boolean;
  /** The best before this run, or null if this is the first one banked. */
  previous: number | null;
  /** How much faster than the old best. 0 when there was nothing to beat. */
  gained: number;
  /** How many clean runs have been banked on this loop, including this one. */
  runs: number;
}

/**
 * Keeps a run.
 *
 * A run slower than the record still counts as a run — playing it clean again
 * is the practice, and a counter that only moved on records would sit still
 * through most of a week's work. What it does not do is lower the best:
 * `previous` is only rewritten when there is actually a new number to have
 * come from, so "up from 68" stays true however many 70s are banked after it.
 */
export async function bankRun(input: BankInput): Promise<Banked> {
  const existing = records.get(input.signature);
  const beat = !existing || input.tempo > existing.best;
  const record: LoopRecord = {
    id: input.signature,
    chords: input.chords,
    beatsPerBar: input.beatsPerBar,
    best: beat ? input.tempo : (existing as LoopRecord).best,
    previous: beat ? existing?.best ?? null : existing?.previous ?? null,
    setAt: beat ? Date.now() : (existing as LoopRecord).setAt,
    runs: (existing?.runs ?? 0) + 1
  };
  records.set(record.id, record);
  await putRecords('records', [record]);
  announce();
  return {
    best: record.best,
    isBest: beat,
    previous: record.previous,
    gained: beat && existing ? input.tempo - existing.best : 0,
    runs: record.runs
  };
}

export async function clearRecords(): Promise<void> {
  records = new Map();
  await clearStore('records');
  announce();
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const exportRecords = (): LoopRecord[] => getRecords();

export async function importRecords(rows: unknown): Promise<number> {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (r): r is LoopRecord =>
      !!r && typeof (r as LoopRecord).id === 'string' && typeof (r as LoopRecord).best === 'number' &&
      (r as LoopRecord).best > 0
  );
  await clearStore('records');
  records = new Map(list.map(r => [r.id, r]));
  if (list.length > 0) await putRecords('records', list);
  announce();
  return list.length;
}
