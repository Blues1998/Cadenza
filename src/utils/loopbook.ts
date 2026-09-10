// The loops you have actually played.
//
// Quick play is meant to be thrown together in four presses, which makes
// everything built in it disposable — and the good ones are exactly the ones
// worth coming back to tomorrow. So a loop is kept the moment it is played,
// without anybody having to decide to save it. Nothing here is a document: the
// list is short, the oldest falls off the end, and anything on it can be
// thrown away by hand.
//
// Kept when the count-in ends rather than when play is pressed. A loop
// abandoned during the count-in was not run, and a history full of things you
// changed your mind about is a history nobody reads.

import { STORE_CHANGE_EVENT, clearStore, deleteRecord, putRecords, readAll } from './db';
import { makeSlot, type LoopStrum, type Slot } from './loop';

/** How many are kept. Enough for a week of practice, short enough to scan. */
const MAX_LOOPS = 12;

export interface SavedLoop {
  id: string;
  /** [chord, bars] — the same shape a template carries, so one card draws both. */
  chords: [string, number][];
  tempo: number;
  beatsPerBar: number;
  strum: LoopStrum;
  playedAt: number;
  /** How many times it has been run. A loop you keep returning to says so. */
  runs: number;
}

let loops: SavedLoop[] = [];
let loaded = false;

const announce = () => window.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT));

const byRecent = (a: SavedLoop, b: SavedLoop) => b.playedAt - a.playedAt;

/** Loaded by initLibrary, alongside the songs and the chord book. */
export async function loadLoopBook(): Promise<void> {
  if (loaded) return;
  const records = await readAll<SavedLoop>('loops');
  loops = records.filter(r => Array.isArray(r.chords) && r.chords.length > 0).sort(byRecent);
  loaded = true;
}

export const getSavedLoops = (): SavedLoop[] => loops;

/**
 * What makes two loops the same loop.
 *
 * The chords and the metre, not the tempo. Running the same progression again
 * a little faster is the same practice, and a history that recorded it twice
 * would fill up with one progression at eleven tempos. The tempo of the most
 * recent run is what the record keeps, because that is the one you settled on.
 */
export const loopSignature = (chords: [string, number][], beatsPerBar: number): string =>
  `${beatsPerBar}|${chords.map(([symbol, bars]) => `${symbol}:${bars}`).join('>')}`;

export const slotChords = (slots: Slot[]): [string, number][] =>
  slots.map(slot => [slot.symbol, slot.bars] as [string, number]);

/** Fresh slots from a saved loop — new ids, so React sees new rows. */
export const loopSlots = (loop: SavedLoop): Slot[] =>
  loop.chords.map(([symbol, bars]) => makeSlot(symbol, bars));

export interface RememberInput {
  chords: [string, number][];
  tempo: number;
  beatsPerBar: number;
  strum: LoopStrum;
}

/** Records a run: a new entry, or a bump to the one that is already this loop. */
export async function rememberLoop(input: RememberInput): Promise<void> {
  if (input.chords.length === 0) return;
  const signature = loopSignature(input.chords, input.beatsPerBar);
  const existing = loops.find(l => loopSignature(l.chords, l.beatsPerBar) === signature);
  const record: SavedLoop = {
    id: existing?.id ?? `loop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    chords: input.chords,
    tempo: input.tempo,
    beatsPerBar: input.beatsPerBar,
    strum: input.strum,
    playedAt: Date.now(),
    runs: (existing?.runs ?? 0) + 1
  };
  loops = [record, ...loops.filter(l => l.id !== record.id)].sort(byRecent);
  const dropped = loops.slice(MAX_LOOPS);
  loops = loops.slice(0, MAX_LOOPS);
  await putRecords('loops', [record]);
  await Promise.all(dropped.map(l => deleteRecord('loops', l.id)));
  announce();
}

export async function forgetLoop(id: string): Promise<void> {
  if (!loops.some(l => l.id === id)) return;
  loops = loops.filter(l => l.id !== id);
  await deleteRecord('loops', id);
  announce();
}

export async function clearLoopBook(): Promise<void> {
  loops = [];
  await clearStore('loops');
  announce();
}

/** "just now", "20m ago", "yesterday" — precise enough to find one by. */
export function whenLabel(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const exportSavedLoops = (): SavedLoop[] => loops;

export async function importSavedLoops(records: unknown): Promise<number> {
  const list = (Array.isArray(records) ? records : []).filter(
    (r): r is SavedLoop =>
      !!r && typeof (r as SavedLoop).id === 'string' && Array.isArray((r as SavedLoop).chords) &&
      (r as SavedLoop).chords.length > 0
  ).slice(0, MAX_LOOPS);
  await clearStore('loops');
  loops = list.sort(byRecent);
  if (list.length > 0) await putRecords('loops', list);
  announce();
  return list.length;
}
