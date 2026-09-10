// What to learn next, and why.
//
// The chord book can say you cannot play F. The library can say six of your
// songs use it. Neither on its own is a reason to practise anything — but put
// together they are: F is the one chord standing between you and two songs you
// have already chosen to learn.
//
// So the ranking is by songs unlocked, not by how common the chord is or how
// easy it is. A chord that finishes a song is worth an evening; a chord that
// leaves you with two more to learn before anything sounds different is worth
// one later. Ease breaks ties, because between two chords that unlock nothing
// yet, the cheaper one is the one to meet first.

import { comfortOf, skillFor, voicingsFor } from './chordbook';
import { songChordUses } from './fit';
import { getSongs } from './library';
import { makeSlot, type Slot } from './loop';

export interface NextChord {
  /** Canonical key — what the chord book files it under. */
  key: string;
  /** How to write it, in the spelling it was marked with. */
  symbol: string;
  /** How many of your songs ask for it. */
  songs: number;
  /** Songs where it is the only chord you cannot play. */
  unlocks: string[];
  /** The easiest shape's cost, for tie-breaking. */
  difficulty: number;
  /**
   * Chords you can already play that turn up in the same songs.
   *
   * A new chord is not learned on its own — it is learned as a change into and
   * out of the chords around it, and the ones around it are these.
   */
  partners: string[];
}

/**
 * The chords worth learning next, best first.
 *
 * Only chords you have marked "not yet". An unrated chord is one you have not
 * had an opinion about, and telling someone to go and learn a chord they might
 * already play is how a suggestion stops being believed — the quick pass owns
 * those until they are rated.
 */
export function nextChords(limit = 4): NextChord[] {
  const found = new Map<string, { songs: number; unlocks: string[]; partners: Map<string, number> }>();

  for (const song of getSongs()) {
    const uses = songChordUses(song);
    if (uses.length === 0) continue;
    const missing = uses.filter(use => comfortOf(use.symbol) === 'none');
    const playable = uses.filter(use => comfortOf(use.symbol) !== 'none');
    for (const use of missing) {
      const entry = found.get(use.symbol) ?? { songs: 0, unlocks: [], partners: new Map<string, number>() };
      entry.songs += 1;
      // The only thing in the way: learning this one makes the whole song
      // playable, which is a different kind of fact from "it appears here".
      if (missing.length === 1) entry.unlocks.push(song.title);
      for (const near of playable) entry.partners.set(near.symbol, (entry.partners.get(near.symbol) ?? 0) + near.count);
      found.set(use.symbol, entry);
    }
  }

  return [...found.entries()]
    // Rated, and something we can actually draw. A song can ask for
    // "G (single strum)", which is a G with a performance note attached and
    // not a chord anybody needs to go away and learn.
    .filter(([key]) => skillFor(key) !== undefined && voicingsFor(key).length > 0)
    .map(([key, entry]) => ({
      key,
      symbol: skillFor(key)?.label ?? key,
      songs: entry.songs,
      unlocks: entry.unlocks,
      difficulty: voicingsFor(key)[0]?.difficulty ?? 99,
      partners: [...entry.partners.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 2)
        .map(([symbol]) => symbol)
    }))
    .sort((a, b) =>
      b.unlocks.length - a.unlocks.length ||
      b.songs - a.songs ||
      a.difficulty - b.difficulty ||
      a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

/**
 * The one line under the diagram that says why this chord is on the list.
 *
 * Named where the name fits on a card, counted where it does not — a title cut
 * off mid-word says less than "1 song" does.
 */
export function reasonFor(chord: NextChord): string {
  if (chord.unlocks.length === 1) {
    return chord.unlocks[0].length <= 16 ? `finishes ${chord.unlocks[0]}` : 'finishes a song';
  }
  if (chord.unlocks.length > 1) return `finishes ${chord.unlocks.length} songs`;
  return `in ${chord.songs} song${chord.songs === 1 ? '' : 's'}`;
}

/**
 * A loop for learning one chord: the new shape, and the changes into it.
 *
 * Two bars each, alternating, because what is hard about a chord is never the
 * chord — it is arriving on it in time from the one before. With nobody to
 * alternate with, it is the shape on its own, which is still a metronome and a
 * chord to keep landing on.
 */
export function drillSlots(chord: NextChord): Slot[] {
  if (chord.partners.length === 0) return [makeSlot(chord.symbol, 2), makeSlot(chord.symbol, 2)];
  return chord.partners.flatMap(partner => [makeSlot(chord.symbol, 2), makeSlot(partner, 2)]);
}
