// The loops you have played, and the loops you have kept.
//
// Two lists, because they answer two questions. Recent answers "what was I
// doing yesterday" and writes itself: a loop is recorded the moment it is
// played, nobody decides anything, the list is short and the oldest falls off
// the end. Saved answers "where is that exercise I built" and cannot write
// itself, because the thing that makes a loop worth keeping is that somebody
// thought so and gave it a name.
//
// So the two have opposite lifecycles on purpose. A recent loop is deduped by
// what it is — the same progression played twice is one entry — and expires. A
// saved loop is identified by its name, never expires, and two of them may
// hold the same chords, because "Monday warm-up" and "barre drill, slow" can
// reasonably be the same four chords at two tempos.
//
// Recent is recorded when the count-in ends rather than when play is pressed.
// A loop abandoned during the count-in was not run, and a history full of
// things you changed your mind about is a history nobody reads.

import { STORE_CHANGE_EVENT, clearStore, deleteRecord, putRecords, readAll } from './db';
import { makeSlot, type Slot } from './loop';
import { PLAIN_PATTERN } from './strum';

/** How many are kept. Enough for a week of practice, short enough to scan. */
const MAX_LOOPS = 12;

export interface PlayedLoop {
  id: string;
  /** [chord, bars] — the same shape a template carries, so one card draws both. */
  chords: [string, number][];
  tempo: number;
  beatsPerBar: number;
  /**
   * Shapes the loop pinned, by chord — only ever set by a drill that is about
   * a grip. Without it, replaying a barre exercise off this shelf would hand
   * back whatever you normally play those chords with, which for most of them
   * is a three-string triad, and the exercise would quietly stop being one.
   */
  shapes?: Record<string, string>;
  /** The strumming pattern, as written. */
  pattern?: string;
  /** What the pattern was before patterns: 'bar' or 'beat'. Read, never written. */
  strum?: 'bar' | 'beat';
  playedAt: number;
  /** How many times it has been run. A loop you keep returning to says so. */
  runs: number;
}

let loops: PlayedLoop[] = [];
let loaded = false;

const announce = () => window.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT));

const byRecent = (a: PlayedLoop, b: PlayedLoop) => b.playedAt - a.playedAt;

/** Loaded by initLibrary, alongside the songs and the chord book. */
export async function loadLoopBook(): Promise<void> {
  if (loaded) return;
  const records = await readAll<PlayedLoop>('loops');
  loops = records.filter(r => Array.isArray(r.chords) && r.chords.length > 0).sort(byRecent);
  loaded = true;
}

export const getPlayedLoops = (): PlayedLoop[] => loops;

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

/** The shapes a loop pinned, by chord — undefined when it pinned none. */
export function slotShapeNames(slots: Slot[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const slot of slots) if (slot.shape) out[slot.symbol] = slot.shape;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The pattern a saved loop was played with.
 *
 * Loops recorded before patterns existed carry the two-way switch they were
 * played with instead, which said the same thing in fewer words: once a bar,
 * or once a beat. They are read as the patterns they always were rather than
 * migrated, because a record of what you played is not ours to rewrite.
 */
export const loopPattern = (loop: PlayedLoop): string =>
  loop.pattern ?? (loop.strum === 'beat' ? PLAIN_PATTERN : 'D');

/** Fresh slots from a saved loop — new ids, so React sees new rows. */
export const loopSlots = (loop: PlayedLoop): Slot[] =>
  loop.chords.map(([symbol, bars]) => makeSlot(symbol, bars, loop.shapes?.[symbol]));

export interface RememberInput {
  chords: [string, number][];
  tempo: number;
  beatsPerBar: number;
  pattern: string;
  shapes?: Record<string, string>;
}

/** Records a run: a new entry, or a bump to the one that is already this loop. */
export async function rememberLoop(input: RememberInput): Promise<void> {
  if (input.chords.length === 0) return;
  const signature = loopSignature(input.chords, input.beatsPerBar);
  const existing = loops.find(l => loopSignature(l.chords, l.beatsPerBar) === signature);
  const record: PlayedLoop = {
    id: existing?.id ?? `loop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    chords: input.chords,
    tempo: input.tempo,
    beatsPerBar: input.beatsPerBar,
    // Not part of the signature: the same progression barred and open is the
    // same progression, and the run you kept last is the one it remembers —
    // as with the tempo, and for the same reason.
    ...(input.shapes && Object.keys(input.shapes).length > 0 ? { shapes: input.shapes } : {}),
    pattern: input.pattern,
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
// The ones you kept
// ---------------------------------------------------------------------------

export interface SavedLoop {
  id: string;
  /** What you called it. The name is the identity here, not the chords. */
  name: string;
  /** [chord, bars] — the same shape a template and a recent loop carry. */
  chords: [string, number][];
  /** Shapes the loop pins, by chord. See PlayedLoop for why these travel. */
  shapes?: Record<string, string>;
  tempo: number;
  beatsPerBar: number;
  /** The strumming pattern, as written. */
  pattern?: string;
  savedAt: number;
}

let keeps: SavedLoop[] = [];
let keepsLoaded = false;

// By name, because that is what you will be looking for. A saved list is read
// the way a shelf is read — you know what you called it — where the recent
// list is read the way a diary is, newest first.
const byName = (a: SavedLoop, b: SavedLoop) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Loaded by initLibrary, alongside the songs, the chord book and the recents. */
export async function loadSavedLoops(): Promise<void> {
  if (keepsLoaded) return;
  const records = await readAll<SavedLoop>('keeps');
  keeps = records.filter(r => typeof r.name === 'string' && Array.isArray(r.chords) && r.chords.length > 0).sort(byName);
  keepsLoaded = true;
}

export const getSavedLoops = (): SavedLoop[] => keeps;

/** Fresh slots from a saved loop — new ids, so React sees new rows. */
export const savedSlots = (loop: SavedLoop): Slot[] =>
  loop.chords.map(([symbol, bars]) => makeSlot(symbol, bars, loop.shapes?.[symbol]));

export const savedPattern = (loop: SavedLoop): string => loop.pattern ?? 'D';

export interface SaveInput {
  name: string;
  chords: [string, number][];
  shapes?: Record<string, string>;
  tempo: number;
  beatsPerBar: number;
  pattern: string;
}

/**
 * Keeps a loop under a name, or replaces the one already using that name.
 *
 * Saving over a name rather than making a second entry with it, because "save
 * as my warm-up" twice means one warm-up — and without this there would be no
 * way to correct a saved loop at all except to delete it and retype the name.
 * Case and surrounding space are ignored for the match and the name is stored
 * as it was typed, so fixing the capitalisation of a name is an edit rather
 * than a duplicate.
 *
 * Deliberately uncapped. This is the list somebody is told is permanent, and a
 * silent cap that quietly drops the oldest would make that a lie; a loop is a
 * couple of hundred bytes, so a lifetime of them is smaller than one song.
 */
export async function saveLoop(input: SaveInput): Promise<void> {
  const name = input.name.trim();
  if (name === '' || input.chords.length === 0) return;
  const key = name.toLocaleLowerCase();
  const existing = keeps.find(l => l.name.trim().toLocaleLowerCase() === key);
  const record: SavedLoop = {
    id: existing?.id ?? `keep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    chords: input.chords,
    ...(input.shapes && Object.keys(input.shapes).length > 0 ? { shapes: input.shapes } : {}),
    tempo: input.tempo,
    beatsPerBar: input.beatsPerBar,
    pattern: input.pattern,
    savedAt: Date.now()
  };
  keeps = [...keeps.filter(l => l.id !== record.id), record].sort(byName);
  await putRecords('keeps', [record]);
  announce();
}

/** Whether this name is already in use — what tells the button to say Replace. */
export const savedNamed = (name: string): SavedLoop | undefined => {
  const key = name.trim().toLocaleLowerCase();
  return key === '' ? undefined : keeps.find(l => l.name.trim().toLocaleLowerCase() === key);
};

export async function deleteSavedLoop(id: string): Promise<void> {
  if (!keeps.some(l => l.id === id)) return;
  keeps = keeps.filter(l => l.id !== id);
  await deleteRecord('keeps', id);
  announce();
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const exportPlayedLoops = (): PlayedLoop[] => loops;

export const exportSavedLoops = (): SavedLoop[] => keeps;

export async function importSavedLoops(records: unknown): Promise<number> {
  const list = (Array.isArray(records) ? records : []).filter(
    (r): r is SavedLoop =>
      !!r && typeof (r as SavedLoop).id === 'string' && typeof (r as SavedLoop).name === 'string' &&
      Array.isArray((r as SavedLoop).chords) && (r as SavedLoop).chords.length > 0
  );
  await clearStore('keeps');
  keeps = list.sort(byName);
  if (list.length > 0) await putRecords('keeps', list);
  announce();
  return list.length;
}

export async function importPlayedLoops(records: unknown): Promise<number> {
  const list = (Array.isArray(records) ? records : []).filter(
    (r): r is PlayedLoop =>
      !!r && typeof (r as PlayedLoop).id === 'string' && Array.isArray((r as PlayedLoop).chords) &&
      (r as PlayedLoop).chords.length > 0
  ).slice(0, MAX_LOOPS);
  await clearStore('loops');
  loops = list.sort(byRecent);
  if (list.length > 0) await putRecords('loops', list);
  announce();
  return list.length;
}
