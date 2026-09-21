// Progressions to practise, in the order a pair of hands can take them.
//
// The levels are about the hand rather than the theory. What makes a loop hard
// on a guitar is how many shapes it asks for, whether any of them is a barre,
// and how often you have to change — not how interesting the harmony is. So
// a two-chord vamp with a seventh in it sits below a four-chord loop of plain
// open shapes, and the Andalusian cadence, which every beginner can hear, is
// near the bottom because one of its four chords is an F.
//
// Every template is a real progression that songs are actually built out of.
// A ladder of exercises invented to be progressively harder gets abandoned at
// step three; a ladder of things you recognise gets climbed.
//
// The barre rungs name their shapes, and have to. Ask for Bm and the chord
// book hands back the easiest way to play it, which is a three-string triad —
// a perfectly good Bm and the exact thing a barre drill exists to stop you
// reaching for. `shapes` says which grip the exercise is about, and only the
// exercises that are about a grip say anything.

import { namedVoicing, preferredVoicing } from './chordbook';
import { isBarre } from './chords';
import { makeSlot, type Slot } from './loop';

export interface LoopLevel {
  level: number;
  name: string;
  /** What this rung puts under your hands. */
  note: string;
}

export interface LoopTemplate {
  id: string;
  /** Two or three words, and never a list of its own chords — the chips
   *  beside it already say those, and a card that says them twice is a card
   *  nobody finishes reading. */
  name: string;
  level: number;
  /** Why this one is worth the ten minutes. Shown on hover, not on the card. */
  note: string;
  tempo: number;
  beatsPerBar: number;
  /** [chord, bars], in order. */
  chords: [string, number][];
  /**
   * The shape a chord must be played with here, by name — "E-shape barre".
   *
   * Absent for everything that is about the progression rather than the grip,
   * which is most of them: what you play a chord with is yours, and a loop
   * has no business overruling it without a reason.
   */
  shapes?: Record<string, string>;
}

export const LOOP_LEVELS: LoopLevel[] = [
  { level: 1, name: 'First changes', note: 'Two open shapes, back and forth, until the change stops being a decision' },
  { level: 2, name: 'Three chords', note: 'The I–IV–V families most songs are still made of' },
  { level: 3, name: 'Four-chord loops', note: 'The turnarounds you already know by ear' },
  { level: 4, name: 'First barres', note: 'One shape you already make, laid on the index and moved two frets — every chord barred' },
  { level: 5, name: 'Barres in a loop', note: 'The same bar, now with a progression running past it' },
  { level: 6, name: 'Sevenths and the blues', note: 'Dominant colour, and changes that arrive on the bar line' },
  { level: 7, name: 'Movement', note: 'Longer shapes, minor keys, and chords that walk' },
  { level: 8, name: 'Every chord a barre', note: 'Keys with nothing open in them, where the hand never gets to rest' }
];

export const LOOP_TEMPLATES: LoopTemplate[] = [
  // 1 — two shapes. Held two bars each: the point is the change, and you need
  // time to see it coming before you have to make it.
  { id: 't-em-g', name: 'One finger apart', level: 1, note: 'One finger apart — the first change worth owning', tempo: 68, beatsPerBar: 4, chords: [['Em', 2], ['G', 2]] },
  { id: 't-am-c', name: 'One string over', level: 1, note: 'The same hand, one string over', tempo: 68, beatsPerBar: 4, chords: [['Am', 2], ['C', 2]] },
  { id: 't-d-a', name: 'Bright pair', level: 1, note: 'Two bright shapes the strumming hand likes', tempo: 72, beatsPerBar: 4, chords: [['D', 2], ['A', 2]] },

  // 2 — three chords, the fourth bar bringing you home.
  { id: 't-g-c-d', name: 'Campfire', level: 2, note: 'The key of every campfire', tempo: 76, beatsPerBar: 4, chords: [['G', 2], ['C', 1], ['D', 1]] },
  { id: 't-a-d-e', name: 'Blues key', level: 2, note: 'The same three, moved where the blues lives', tempo: 76, beatsPerBar: 4, chords: [['A', 2], ['D', 1], ['E', 1]] },
  { id: 't-em-c-d', name: 'Minor start', level: 2, note: 'Starting minor, landing major', tempo: 76, beatsPerBar: 4, chords: [['Em', 2], ['C', 1], ['D', 1]] },

  // 3 — a change every bar, which is where changing has to become automatic.
  { id: 't-g-d-em-c', name: 'The pop loop', level: 3, note: 'The four chords half the charts are built on', tempo: 84, beatsPerBar: 4, chords: [['G', 1], ['D', 1], ['Em', 1], ['C', 1]] },
  { id: 't-em-c-g-d', name: 'From the minor', level: 3, note: 'The same loop begun from its minor', tempo: 84, beatsPerBar: 4, chords: [['Em', 1], ['C', 1], ['G', 1], ['D', 1]] },
  { id: 't-c-am-dm-g', name: 'Fifties turnaround', level: 3, note: 'The fifties turnaround, with no barre in it', tempo: 84, beatsPerBar: 4, chords: [['C', 1], ['Am', 1], ['Dm', 1], ['G', 1]] },
  // The four-string F is pinned rather than left to the book, because this is
  // the rung where it is the point: one finger over two strings, which is the
  // stepping stone and not yet the barre a level above asks for.
  { id: 't-c-g-am-f', name: 'First F', level: 3, note: 'Three you have and one you are learning, on four strings', tempo: 78, beatsPerBar: 4, chords: [['C', 1], ['G', 1], ['Am', 1], ['F', 1]], shapes: { F: 'F on 4 strings' } },

  // 4 — the barre, met one shape at a time, and met in the middle of the neck:
  // a bar at the fifth fret takes about half the squeeze a bar at the first
  // does, so the grip is learned where it can be held before it is asked for
  // where it cannot. Every chord on this rung is the same shape barred, two
  // frets apart, because what is hard about a barre is not making it once —
  // it is letting it go and making it again somewhere else.
  //
  // Both chords are pinned, and have to be. Ask the chord book for Bm and it
  // hands back a three-string triad: a perfectly good Bm, and the exact thing
  // this rung exists to stop you reaching for.
  { id: 't-barre-em', name: 'Em shape, moved', level: 4, note: 'The Em grip barred twice — the Am you know, then the Bm you cannot play open', tempo: 64, beatsPerBar: 4, chords: [['Am', 2], ['Bm', 2]], shapes: { Am: 'Em-shape barre', Bm: 'Em-shape barre' } },
  { id: 't-barre-e', name: 'E shape, moved', level: 4, note: 'The same two frets with the full E under it — the grip every F is made of', tempo: 64, beatsPerBar: 4, chords: [['A', 2], ['B', 2]], shapes: { A: 'E-shape barre', B: 'E-shape barre' } },
  { id: 't-barre-am', name: 'Am shape, moved', level: 4, note: 'Over to the A string, where the bar carries five strings instead of six', tempo: 66, beatsPerBar: 4, chords: [['Dm', 2], ['Em', 2]], shapes: { Dm: 'Am-shape barre', Em: 'Am-shape barre' } },
  { id: 't-barre-a', name: 'A shape, moved', level: 4, note: 'The one where the ring finger has to bar three strings for itself', tempo: 66, beatsPerBar: 4, chords: [['D', 2], ['E', 2]], shapes: { D: 'A-shape barre', E: 'A-shape barre' } },
  { id: 't-barre-f', name: 'Down to the F', level: 4, note: 'The E shape carried back to the first fret, where the strings fight hardest', tempo: 60, beatsPerBar: 4, chords: [['F', 2], ['G', 2]], shapes: { F: 'E-shape barre', G: 'E-shape barre' } },

  // 5 — one bar inside something moving. Two bars to arrive becomes one, and
  // the chord either side is open, so the hand has to make the shape and let
  // it go again rather than settling into it.
  { id: 't-g-bm-c-d', name: 'Bm in passing', level: 5, note: 'Bm on the way past, not on the downbeat', tempo: 80, beatsPerBar: 4, chords: [['G', 1], ['Bm', 1], ['C', 1], ['D', 1]], shapes: { Bm: 'Am-shape barre' } },
  { id: 't-barre-fsm', name: 'The other pop loop', level: 5, note: 'The pop loop in A, which starts on a barre and gives you no run-up', tempo: 80, beatsPerBar: 4, chords: [['F#m', 1], ['D', 1], ['A', 1], ['E', 1]], shapes: { 'F#m': 'Em-shape barre' } },
  { id: 't-am-g-f-e', name: 'Andalusian', level: 5, note: 'The Andalusian walk down, with the F barred on its way through', tempo: 78, beatsPerBar: 4, chords: [['Am', 1], ['G', 1], ['F', 1], ['E', 1]], shapes: { F: 'E-shape barre' } },
  { id: 't-barre-two', name: 'Two a lap', level: 5, note: 'Two barres a lap, two frets and two shapes apart', tempo: 76, beatsPerBar: 4, chords: [['E', 1], ['B', 1], ['C#m', 1], ['A', 1]], shapes: { B: 'A-shape barre', 'C#m': 'Am-shape barre' } },

  // 6 — twelve bars is long enough that you stop counting and start hearing.
  { id: 't-blues-a', name: 'Twelve-bar in A', level: 6, note: 'The whole form, changes where you expect them', tempo: 88, beatsPerBar: 4, chords: [['A7', 4], ['D7', 2], ['A7', 2], ['E7', 1], ['D7', 1], ['A7', 1], ['E7', 1]] },
  { id: 't-ii-v-i', name: 'Two-five-one', level: 6, note: 'Two-five-one — the cadence jazz is made of', tempo: 92, beatsPerBar: 4, chords: [['Dm7', 1], ['G7', 1], ['Cmaj7', 2]] },
  { id: 't-e-blues', name: 'Open sevenths', level: 6, note: 'Dominant sevenths in the shapes that fit open strings', tempo: 88, beatsPerBar: 4, chords: [['E7', 2], ['A7', 1], ['B7', 1]] },

  // 7 — no new shape you have not met by now, only more of them and less time.
  { id: 't-am-dm-e7', name: 'Minor cadence', level: 7, note: 'A minor cadence that actually closes', tempo: 84, beatsPerBar: 4, chords: [['Am', 1], ['Dm', 1], ['E7', 1], ['Am', 1]] },
  { id: 't-circle', name: 'Round the circle', level: 7, note: 'Round the circle, one chord a bar', tempo: 92, beatsPerBar: 4, chords: [['Cmaj7', 1], ['Am7', 1], ['Dm7', 1], ['G7', 1]] },
  { id: 't-waltz', name: 'Waltz in G', level: 7, note: 'Three beats to the bar changes where the change falls', tempo: 108, beatsPerBar: 3, chords: [['G', 2], ['C', 1], ['D', 1], ['G', 2], ['D', 1], ['G', 1]] },

  // 8 — keys a guitar has no open chords in, which is why horn players like
  // them and why every one of these turns up on records. Nothing here is a new
  // shape: it is the four from level 4, with nowhere to put the hand down.
  { id: 't-barre-bb', name: 'Nothing open', level: 8, note: 'The pop loop in B flat, where not one of the four rings open', tempo: 74, beatsPerBar: 4, chords: [['Bb', 1], ['F', 1], ['Gm', 1], ['Eb', 1]], shapes: { Bb: 'A-shape barre', F: 'E-shape barre', Gm: 'Em-shape barre', Eb: 'A-shape barre' } },
  { id: 't-barre-blues', name: 'Barred blues', level: 8, note: 'The twelve bars you know open, played where nothing rings for you', tempo: 84, beatsPerBar: 4, chords: [['A7', 4], ['D7', 2], ['A7', 2], ['E7', 1], ['D7', 1], ['A7', 1], ['E7', 1]], shapes: { A7: 'E-shape barre', D7: 'A-shape barre', E7: 'A-shape barre' } },
  { id: 't-barre-fm', name: 'Minor, barred', level: 8, note: 'Both shapes alternating, low on the neck, in a minor key', tempo: 72, beatsPerBar: 4, chords: [['Fm', 1], ['Db', 1], ['Ab', 1], ['Eb', 1]], shapes: { Fm: 'Em-shape barre', Db: 'A-shape barre', Ab: 'E-shape barre', Eb: 'A-shape barre' } },
  { id: 't-barre-neck', name: 'All the way up', level: 8, note: 'Four barres at four positions — the hand never gets to settle', tempo: 70, beatsPerBar: 4, chords: [['C#m', 1], ['A', 1], ['E', 1], ['B', 1]], shapes: { 'C#m': 'Am-shape barre', A: 'E-shape barre', E: 'A-shape barre', B: 'A-shape barre' } }
];

/** Fresh slots for a template — new ids, so React sees new rows. */
export const templateSlots = (template: LoopTemplate): Slot[] =>
  template.chords.map(([symbol, bars]) => makeSlot(symbol, bars, template.shapes?.[symbol]));

export const templateBars = (template: LoopTemplate): number =>
  template.chords.reduce((n, [, bars]) => n + bars, 0);

/** Distinct chords, in order of first appearance — what the card lists. */
export function templateChords(template: LoopTemplate): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [symbol] of template.chords) {
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

/**
 * Whether playing this as written lays the index across the neck.
 *
 * Asked of the shapes it will actually be played with, not of its chord names.
 * Bm is not a barre chord — the Bm you happen to play may or may not be one,
 * and on this shelf that is decided by the template or by your chord book.
 * Which makes this the one honest way to put the word on a card.
 */
export const templateHasBarre = (template: LoopTemplate): boolean =>
  templateChords(template).some(symbol => {
    const named = template.shapes?.[symbol];
    const voicing = (named ? namedVoicing(symbol, named) : null) ?? preferredVoicing(symbol);
    return voicing !== null && isBarre(voicing);
  });
