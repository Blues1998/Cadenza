// What the player can do, as distinct from what the songs are.
//
// The library can say a song uses Bm. It cannot say whether Bm is a chord you
// drop into without thinking, one you brace for, or one you have never made
// with your hand. That is a fact about the person rather than the music, so it
// lives in its own store, keyed by the chord itself and shared by every song
// that happens to use it. Learn F once and every song that needs F knows.
//
// Three states, and the absence of a record is the third. A finer scale
// (never seen / met it / getting there / solid / automatic) sounds more
// precise and is unanswerable in the two seconds anyone will spend on it, and
// a scale nobody can answer honestly is worse than a coarse one they can. The
// same three run everywhere the app asks: solid, shaky, not yet.
//
// The chosen fingering lives here too, next to the comfort, because they are
// the same fact. "I can play B" is not true of B in general — it is true of
// one shape. Everything that draws or sounds a chord asks here first.

import { STORE_CHANGE_EVENT, putRecords, readAll, clearStore, deleteRecord } from './db';
import { getVoicings, type ChordVoicing } from './chords';
import { chordShape, normalizeChordSymbol } from './songText';

export type ChordComfort = 'solid' | 'shaky' | 'none';

export const COMFORT_ORDER: ChordComfort[] = ['solid', 'shaky', 'none'];

export const COMFORT_LABEL: Record<ChordComfort, string> = {
  solid: 'Solid',
  shaky: 'Shaky',
  none: 'Not yet'
};

/** What each state means, in the words someone would use about their own hands. */
export const COMFORT_HINT: Record<ChordComfort, string> = {
  solid: 'You change into it without thinking',
  shaky: 'You can get there, but it costs you',
  none: 'Not in your hands yet'
};

export interface ChordSkill {
  /** The normalised symbol — "Am", "F", "Bm7". This is the key. */
  id: string;
  comfort: ChordComfort;
  /** id of the voicing you actually play, or null for whichever is easiest. */
  voicingId: string | null;
  updatedAt: number;
}

let skills = new Map<string, ChordSkill>();
let loaded = false;

const announce = () => window.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT));

/** Loaded by initLibrary, so a screen only ever waits on one store being ready. */
export async function loadChordBook(): Promise<void> {
  if (loaded) return;
  const records = await readAll<ChordSkill>('chords');
  skills = new Map(records.map(r => [r.id, r]));
  loaded = true;
}

export const chordKey = (symbol: string): string => normalizeChordSymbol(symbol);

export const getChordSkills = (): ChordSkill[] => [...skills.values()];

export const skillFor = (symbol: string): ChordSkill | undefined => skills.get(chordKey(symbol));

/** A chord nobody has said anything about is one you cannot play. */
export const comfortOf = (symbol: string): ChordComfort => skillFor(symbol)?.comfort ?? 'none';

/** Solid or shaky — everything you have some claim on. */
export const isKnown = (symbol: string): boolean => comfortOf(symbol) !== 'none';

export const knownChords = (): string[] =>
  getChordSkills().filter(s => s.comfort !== 'none').map(s => s.id);

// getVoicings walks the whole shape table and is called for every chord on
// every render of a chart. The answer only depends on the symbol.
const voicingCache = new Map<string, ChordVoicing[]>();

/** Every way to play this symbol, easiest first. Empty when we cannot place it. */
export function voicingsFor(symbol: string): ChordVoicing[] {
  const key = chordKey(symbol);
  const hit = voicingCache.get(key);
  if (hit) return hit;
  const shape = chordShape(key);
  const list = shape ? getVoicings(shape.rootPc, shape.typeId, shape.rootName) : [];
  voicingCache.set(key, list);
  return list;
}

/**
 * The shape to draw and to sound: the one that was chosen, or the easiest.
 *
 * A stored id that no longer matches anything falls back rather than showing
 * nothing — the shape tables can change under a saved preference.
 */
export function preferredVoicing(symbol: string): ChordVoicing | null {
  const list = voicingsFor(symbol);
  if (list.length === 0) return null;
  const wanted = skillFor(symbol)?.voicingId;
  return (wanted ? list.find(v => v.id === wanted) : null) ?? list[0];
}

const write = async (skill: ChordSkill): Promise<void> => {
  skills.set(skill.id, skill);
  await putRecords('chords', [skill]);
  announce();
};

export async function setComfort(symbol: string, comfort: ChordComfort): Promise<void> {
  const id = chordKey(symbol);
  if (!id) return;
  const existing = skills.get(id);
  await write({
    id,
    comfort,
    voicingId: existing?.voicingId ?? null,
    updatedAt: Date.now()
  });
}

export async function setPreferredVoicing(symbol: string, voicingId: string | null): Promise<void> {
  const id = chordKey(symbol);
  if (!id) return;
  const existing = skills.get(id);
  await write({
    id,
    comfort: existing?.comfort ?? 'none',
    voicingId,
    updatedAt: Date.now()
  });
}

/** Removes a chord from the book entirely — not the same as marking it "not yet". */
export async function forgetChord(symbol: string): Promise<void> {
  const id = chordKey(symbol);
  if (!skills.has(id)) return;
  skills.delete(id);
  await deleteRecord('chords', id);
  announce();
}

export interface ComfortTally {
  solid: number;
  shaky: number;
  none: number;
}

/** How a set of chords stands against the book. Distinct chords, not occurrences. */
export function tally(symbols: string[]): ComfortTally {
  const out: ComfortTally = { solid: 0, shaky: 0, none: 0 };
  for (const symbol of new Set(symbols.map(chordKey))) out[comfortOf(symbol)] += 1;
  return out;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const exportChordSkills = (): ChordSkill[] => getChordSkills();

export async function importChordSkills(records: unknown): Promise<number> {
  const list = (Array.isArray(records) ? records : []).filter(
    (r): r is ChordSkill =>
      !!r && typeof (r as ChordSkill).id === 'string' &&
      COMFORT_ORDER.includes((r as ChordSkill).comfort)
  );
  await clearStore('chords');
  skills = new Map(list.map(r => [r.id, r]));
  if (list.length > 0) await putRecords('chords', list);
  announce();
  return list.length;
}

export async function clearChordBook(): Promise<void> {
  await clearStore('chords');
  skills = new Map();
  announce();
}
