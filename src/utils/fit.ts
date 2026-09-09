// Fitting a song to the hands you have.
//
// A song is written in the key it is written in, and some keys fall under the
// fingers and some do not. The guitarist's answer to that is a capo: play the
// shapes of an easier key, clamp the neck at the difference, and the song
// comes out at exactly the pitch it went in at. Shapes down three, capo on
// three, and the record still plays along with you.
//
// So this only ever proposes capo positions. Transposing without one is the
// other half of the idea and a different promise — it moves the song into
// another key, which is right when the trouble is your voice and wrong when
// you are playing along with a recording. Everything here keeps the pitch and
// changes the grip, because that is the case where the app can be certain it
// has not broken anything.
//
// The judgement is the chord book's: solid chords are free, shaky ones cost
// something, and a chord that is not in your hands at all is a wall. A capo
// that puts a wall in the way is not an option however tidy the rest of it is,
// which is why the cost is ordered walls first and everything else after.
//
// One thing worth being careful about, because getting it wrong would give
// confident wrong answers. Everything here works in *shapes* — what the hand
// is doing — and never in absolute pitch. The two are not interchangeable in
// this library: a chart is written at sounding pitch and read through a lens,
// while the tracker's own chord line records the grips at whatever capo the
// song already has ("Sitaare, B flat minor, capo 1, A min → F maj"). Those
// disagree about what "Am" means.
//
// Working in shapes needs neither of them to be true in absolute terms. Moving
// the capo from where it is to fret N shifts every grip by exactly the
// difference, because the pitch is being held still — so all this needs is the
// grips you are making now, which is the one thing both sources genuinely
// agree they are describing.

import { timeChart, transposeSymbol } from './chart';
import { comfortOf, chordKey, type ChordComfort } from './chordbook';
import { parseProgressions } from './songText';
import type { Song } from './library';

/** A chord and how many times the song asks for it. */
export interface ChordUse {
  symbol: string;
  count: number;
}

export interface FitChord {
  /** The chord as written, at sounding pitch. */
  from: string;
  /** The shape you would actually finger with this capo on. */
  to: string;
  comfort: ChordComfort;
  count: number;
}

export interface FitOption {
  capo: number;
  /** Semitones every grip moves from where it is now to get here. */
  shift: number;
  chords: FitChord[];
  solid: number;
  shaky: number;
  missing: number;
  /** The shapes you would have to learn to play it this way. */
  missingChords: string[];
  cost: number;
  /** True when every chord in the song is one you have some claim on. */
  playable: boolean;
  /** True when this is what the song is already set to. */
  current: boolean;
}

// Highest capo worth proposing. Past about seven the neck runs short and the
// guitar starts to sound like a mandolin, and every shape has come round to a
// name you have already been offered lower down.
export const MAX_CAPO = 7;

/**
 * Every grip the song asks for as it stands, with how often.
 *
 * The chart is the better source when there is one — it knows a chorus chord
 * is played nine times and the one in the bridge once — and the chord line
 * from the tracker stands in when there is not. The chart is read through its
 * own lens, because that is by definition what it is showing you to play.
 */
export function songChordUses(song: Song): ChordUse[] {
  const counts = new Map<string, number>();
  const add = (symbol: string, n = 1) => {
    const key = chordKey(symbol);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + n);
  };

  if (song.chart && song.chart.lines.length > 0) {
    const parsed = timeChart(song.chart.lines, song.chart.beatsPerBar, song.chart.transpose);
    for (const line of parsed.lines) for (const chord of line.chords) add(chord.symbol);
  }
  if (counts.size === 0) {
    for (const prog of parseProgressions(song.chordsRaw)) for (const symbol of prog) add(symbol);
  }

  return [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
}

/** How this song would sit under the hands with the capo at one position. */
export function fitAt(uses: ChordUse[], capo: number, currentCapo: number): FitOption {
  // Up the neck with the capo, down go the shapes, and the song stays where it
  // was. The difference is all that matters — never the absolute position.
  const shift = currentCapo - capo;
  const chords: FitChord[] = uses.map(use => {
    const to = transposeSymbol(use.symbol, shift);
    return { from: use.symbol, to, comfort: comfortOf(to), count: use.count };
  });

  const solid = chords.filter(c => c.comfort === 'solid').length;
  const shaky = chords.filter(c => c.comfort === 'shaky').length;
  const missingChords = chords.filter(c => c.comfort === 'none').map(c => c.to);
  const current = capo === currentCapo;

  // Ordered, not weighted: a wall beats any amount of tidiness below it, and a
  // shaky chord beats any capo position. The last two terms only break ties —
  // the lower capo, and the setting the song already has, so a song that is
  // already right does not get told to move. They order equal options; they
  // never make one option better than another. See `better` below.
  const cost =
    missingChords.length * 1000 +
    shaky * 20 +
    chords.filter(c => c.comfort === 'shaky').reduce((n, c) => n + Math.min(c.count, 8), 0) * 0.5 +
    capo * 1 +
    (current ? -0.5 : 0);

  return {
    capo,
    shift,
    chords,
    solid,
    shaky,
    missing: missingChords.length,
    missingChords,
    cost,
    playable: missingChords.length === 0,
    current
  };
}

/** Every capo position worth offering, best first. */
export function fitOptions(uses: ChordUse[], currentCapo: number | null): FitOption[] {
  const capo = currentCapo ?? 0;
  const out: FitOption[] = [];
  for (let n = 0; n <= MAX_CAPO; n++) out.push(fitAt(uses, n, capo));
  return out.sort((a, b) => a.cost - b.cost || a.capo - b.capo);
}

/**
 * Is `a` actually a better place to play from than `b`?
 *
 * Only the chords count. The cost used to order the table also carries a mild
 * preference for a low capo, and comparing two costs let that preference alone
 * argue for a move: a song at capo 4 with nothing playable anywhere was told
 * to go to capo 0, which changed every grip and helped with none of them — the
 * suggestion said so itself, in the same sentence. A tie-break may order equal
 * options. It may never make one of them better.
 */
const better = (a: FitOption, b: FitOption): boolean =>
  a.missing < b.missing || (a.missing === b.missing && a.shaky < b.shaky);

export interface FitVerdict {
  /** Where to play it: somewhere better if there is one, otherwise where you are. */
  best: FitOption;
  now: FitOption;
  options: FitOption[];
  /** Worth moving to: it is not where we already are, and it is genuinely better. */
  improves: boolean;
  /** Chords to learn to play the song at that position. */
  learn: string[];
}

export function fitSong(song: Song): FitVerdict | null {
  const uses = songChordUses(song);
  if (uses.length === 0) return null;
  const currentCapo = song.capo ?? 0;
  const options = fitOptions(uses, currentCapo);
  const now = options.find(o => o.capo === currentCapo) ?? options[0];
  const candidate = options[0];
  const improves = candidate.capo !== now.capo && better(candidate, now);
  // With nothing to move to, where you already are is the answer — so the
  // highlighted row, the chords to learn and the offer all talk about the capo
  // the song actually has rather than an arbitrary one that ranked first.
  const best = improves ? candidate : now;
  return { best, now, options, improves, learn: best.missingChords };
}
