// A song, turned into something to practise.
//
// The song page already knows which chords are in the way. It says so, in
// words, at the top of the chord panel — "2 of 5 in your hands" — and then
// offers nothing to do about it. Quick Play, the shelf and the shape picker
// are all one press away and none of them are linked to the sentence that
// describes exactly what they are for. This is the loop that sentence is
// asking for.
//
// Everything here works in grips, the way fit.ts does: the symbols a song
// records are the shapes the hand is making at whatever capo the song already
// has, and a drill is about the hand. Nothing is transposed on the way out.

import { comfortOf, skillFor, voicingsFor, type ChordComfort } from './chordbook';
import { TEMPO_MIN } from './chart';
import { songChordUses } from './fit';
import { makeSlot, type Slot } from './loop';
import { loopSignature } from './loopbook';
import { bestFor } from './records';
import { parseProgressions } from './songText';
import type { Song } from './library';

/**
 * The most changes one loop should ask you to hold.
 *
 * Longer than this and it stops being a drill and becomes a section of a song
 * played badly — the thing you were already doing before you came here.
 */
const WINDOW = 4;

const RANK: Record<ChordComfort, number> = { solid: 0, shaky: 1, none: 2 };

/**
 * How this chord sits, or nothing if you have never said.
 *
 * The chord book returns "not yet" for a chord it has simply never been asked
 * about, which is the right default for a ranking and the wrong one for a
 * sentence: telling someone three chords are in their way when they have not
 * been through the book yet is the app inventing an obstacle. Everything that
 * reads out loud goes through here; only the ordering uses the raw answer.
 */
const opinionOf = (chord: string): ChordComfort | null =>
  skillFor(chord) === undefined ? null : comfortOf(chord);

export interface SongDrill {
  slots: Slot[];
  tempo: number;
  beatsPerBar: number;
  /** What to call it where it lands, which is the save field on the chord page. */
  name: string;
  /** The chords the loop puts in front of you that are not yet solid, worst first. */
  trouble: string[];
  /** The ones in it you have never had an opinion about. */
  unrated: string[];
  /** The loop's chords in order, for saying what is about to happen. */
  chords: string[];
  /** The tempo is one you have already held here, not a guess at a slow one. */
  held: boolean;
}

/**
 * How long each chord is held.
 *
 * Every drill comes out four bars whatever it holds, so the loop turns over in
 * the same stretch of time and the ear learns where the top of it is. Two
 * chords get two bars each — the change is the exercise, and you need to see
 * it coming before you have to make it. Three or four get a bar apiece, with
 * the first of three held double so the loop still lands square.
 */
const barsAt = (i: number, n: number): number => (n <= 2 ? 2 : n === 3 && i === 0 ? 2 : 1);

/** How much of this run is not yet solid — walls counting double a wobble. */
const troubleScore = (chords: string[]): number =>
  chords.reduce((n, chord) => n + RANK[comfortOf(chord)], 0);

/** The chords here you have said are not solid yet, the walls first. */
const troubleIn = (chords: string[]): string[] =>
  [...new Set(chords)]
    .filter(chord => {
      const comfort = opinionOf(chord);
      return comfort !== null && comfort !== 'solid';
    })
    .sort((a, b) => RANK[comfortOf(b)] - RANK[comfortOf(a)] || chords.indexOf(a) - chords.indexOf(b));

/** Chords in this loop you have never had an opinion about. */
const unrated = (chords: string[]): string[] => [...new Set(chords)].filter(chord => opinionOf(chord) === null);

/**
 * The stretch of a long progression worth looping.
 *
 * A verse written out as eight changes is a piece of music, not an exercise.
 * The four consecutive chords carrying the most trouble are where the song is
 * actually breaking, and keeping them consecutive keeps the changes the ones
 * the song really asks for rather than a set of chords in a bag.
 */
function hardestWindow(chords: string[]): string[] {
  if (chords.length <= WINDOW) return chords;
  let bestAt = 0;
  let bestScore = -1;
  for (let i = 0; i + WINDOW <= chords.length; i++) {
    const score = troubleScore(chords.slice(i, i + WINDOW));
    if (score > bestScore) {
      bestScore = score;
      bestAt = i;
    }
  }
  return chords.slice(bestAt, bestAt + WINDOW);
}

/**
 * Where to start it.
 *
 * A tempo you have already held on this exact loop is not a guess, so it wins
 * — offering 60 to someone who kept this progression at 104 last week is the
 * app forgetting. Otherwise slow, and how slow is set by the worst chord in
 * it: a shape you cannot make yet needs the bar to arrive late enough that
 * you can build it. Never faster than the song itself, because a drill that
 * outruns the record is not practising the song.
 */
function tempoFor(chords: string[], song: Song, signature: string): { tempo: number; held: boolean } {
  const held = bestFor(signature);
  if (held !== null) return { tempo: held, held: true };
  // Only what you have actually said. A book that has never been opened would
  // otherwise put every drill at the tempo reserved for a shape nobody can
  // make yet, which is slow enough to be insulting to someone who can play it.
  const worst = chords.reduce((n, chord) => {
    const comfort = opinionOf(chord);
    return comfort === null ? n : Math.max(n, RANK[comfort]);
  }, -1);
  const slow = worst === 2 ? 60 : worst <= 0 ? 80 : 70;
  const own = song.chart?.tempo;
  return { tempo: own ? Math.max(TEMPO_MIN, Math.min(slow, own)) : slow, held: false };
}

/** A loop out of these chords, in this order, or null if none of them can be played. */
export function drillFrom(song: Song, chords: string[]): SongDrill | null {
  // A song can ask for something the shape tables cannot draw — a chord with a
  // performance note stuck to it, a symbol nobody parsed. A slot like that is
  // silent when the loop comes round to it, which is a worse drill than one
  // chord shorter.
  const playable = chords.filter(chord => voicingsFor(chord).length > 0);
  if (playable.length === 0) return null;

  const run = hardestWindow(playable);
  const slots: Slot[] = run.map((chord, i) => makeSlot(chord, barsAt(i, run.length)));
  const beatsPerBar = song.chart?.beatsPerBar ?? 4;
  const signature = loopSignature(slots.map(s => [s.symbol, s.bars] as [string, number]), beatsPerBar);
  const { tempo, held } = tempoFor(run, song, signature);

  return {
    slots,
    tempo,
    beatsPerBar,
    name: song.title,
    trouble: troubleIn(run),
    unrated: unrated(run),
    chords: run,
    held
  };
}

/**
 * The one loop to hand over when all someone pressed was "drill this song".
 *
 * The progression carrying the most trouble, because that is the one the song
 * is stuck on; ties go to the one written first, which is nearly always the
 * verse. With nothing written down, the chords the song leans on hardest —
 * taken by weight rather than in chart order, since a chart's order is a
 * section of a song and this is meant to come round.
 */
export function songDrill(song: Song): SongDrill | null {
  const progressions = parseProgressions(song.chordsRaw);
  if (progressions.length > 0) {
    const ranked = progressions
      .map((chords, i) => ({ chords, i, score: troubleScore(chords) }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    for (const { chords } of ranked) {
      const drill = drillFrom(song, chords);
      if (drill) return drill;
    }
  }
  return drillFrom(song, songChordUses(song).slice(0, WINDOW).map(use => use.symbol));
}

/**
 * The sentence under the button: why this loop and not another.
 *
 * Names the chords when there are one or two of them, because "F" is a reason
 * and "2 chords" is a statistic. Everything solid is not nothing to say — it
 * is the case where the work left is the changing rather than the shapes.
 */
export function drillReason(drill: SongDrill): string {
  const [first, second] = drill.trouble;
  if (drill.trouble.length === 1) return `${first} is the one getting in the way.`;
  if (drill.trouble.length === 2) return `${first} and ${second} are what keep breaking.`;
  if (drill.trouble.length > 2) return `${drill.trouble.length} of these still want work.`;
  // Nothing marked not-solid. Either they are all solid, in which case the
  // work left is the changing, or nobody has said — and a loop is a perfectly
  // good way to find out which.
  if (drill.unrated.length === drill.chords.length) {
    return 'Nothing marked here yet — run it and find out which change breaks.';
  }
  if (drill.unrated.length > 0) return 'The ones you have marked are solid. Run the rest and see.';
  return 'Every shape here is one you have. The work left is the changing.';
}
