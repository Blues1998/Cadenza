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

import { makeSlot, type Slot } from './loop';

export interface LoopLevel {
  level: number;
  name: string;
  /** What this rung puts under your hands. */
  note: string;
}

export interface LoopTemplate {
  id: string;
  name: string;
  level: number;
  /** Why this one is worth the ten minutes. */
  note: string;
  tempo: number;
  beatsPerBar: number;
  /** [chord, bars], in order. */
  chords: [string, number][];
}

export const LOOP_LEVELS: LoopLevel[] = [
  { level: 1, name: 'First changes', note: 'Two open shapes, back and forth, until the change stops being a decision' },
  { level: 2, name: 'Three chords', note: 'The I–IV–V families most songs are still made of' },
  { level: 3, name: 'Four-chord loops', note: 'The turnarounds you already know by ear' },
  { level: 4, name: 'The barre', note: 'F and Bm in company, so the hard shape has somewhere to go' },
  { level: 5, name: 'Sevenths and the blues', note: 'Dominant colour, and changes that arrive on the bar line' },
  { level: 6, name: 'Movement', note: 'Longer shapes, minor keys, and chords that walk' }
];

export const LOOP_TEMPLATES: LoopTemplate[] = [
  // 1 — two shapes. Held two bars each: the point is the change, and you need
  // time to see it coming before you have to make it.
  { id: 't-em-g', name: 'Em and G', level: 1, note: 'One finger apart — the first change worth owning', tempo: 68, beatsPerBar: 4, chords: [['Em', 2], ['G', 2]] },
  { id: 't-am-c', name: 'Am and C', level: 1, note: 'The same hand, one string over', tempo: 68, beatsPerBar: 4, chords: [['Am', 2], ['C', 2]] },
  { id: 't-d-a', name: 'D and A', level: 1, note: 'Two bright shapes the strumming hand likes', tempo: 72, beatsPerBar: 4, chords: [['D', 2], ['A', 2]] },

  // 2 — three chords, the fourth bar bringing you home.
  { id: 't-g-c-d', name: 'G · C · D', level: 2, note: 'The key of every campfire', tempo: 76, beatsPerBar: 4, chords: [['G', 2], ['C', 1], ['D', 1]] },
  { id: 't-a-d-e', name: 'A · D · E', level: 2, note: 'The same three, moved where the blues lives', tempo: 76, beatsPerBar: 4, chords: [['A', 2], ['D', 1], ['E', 1]] },
  { id: 't-em-c-d', name: 'Em · C · D', level: 2, note: 'Starting minor, landing major', tempo: 76, beatsPerBar: 4, chords: [['Em', 2], ['C', 1], ['D', 1]] },

  // 3 — a change every bar, which is where changing has to become automatic.
  { id: 't-g-d-em-c', name: 'G · D · Em · C', level: 3, note: 'The four chords half the charts are built on', tempo: 84, beatsPerBar: 4, chords: [['G', 1], ['D', 1], ['Em', 1], ['C', 1]] },
  { id: 't-em-c-g-d', name: 'Em · C · G · D', level: 3, note: 'The same loop begun from its minor', tempo: 84, beatsPerBar: 4, chords: [['Em', 1], ['C', 1], ['G', 1], ['D', 1]] },
  { id: 't-c-am-dm-g', name: 'C · Am · Dm · G', level: 3, note: 'The fifties turnaround, with no barre in it', tempo: 84, beatsPerBar: 4, chords: [['C', 1], ['Am', 1], ['Dm', 1], ['G', 1]] },

  // 4 — a barre, but never on the first beat you play: each of these gives you
  // a bar of something easy to arrive from.
  { id: 't-c-g-am-f', name: 'C · G · Am · F', level: 4, note: 'Three you have and one you are learning', tempo: 78, beatsPerBar: 4, chords: [['C', 1], ['G', 1], ['Am', 1], ['F', 1]] },
  { id: 't-g-bm-c-d', name: 'G · Bm · C · D', level: 4, note: 'Bm on the way past, not on the downbeat', tempo: 80, beatsPerBar: 4, chords: [['G', 1], ['Bm', 1], ['C', 1], ['D', 1]] },
  { id: 't-am-g-f-e', name: 'Am · G · F · E', level: 4, note: 'The Andalusian walk down', tempo: 78, beatsPerBar: 4, chords: [['Am', 1], ['G', 1], ['F', 1], ['E', 1]] },

  // 5 — twelve bars is long enough that you stop counting and start hearing.
  { id: 't-blues-a', name: 'Twelve-bar in A', level: 5, note: 'The whole form, changes where you expect them', tempo: 88, beatsPerBar: 4, chords: [['A7', 4], ['D7', 2], ['A7', 2], ['E7', 1], ['D7', 1], ['A7', 1], ['E7', 1]] },
  { id: 't-ii-v-i', name: 'Dm7 · G7 · Cmaj7', level: 5, note: 'Two-five-one — the cadence jazz is made of', tempo: 92, beatsPerBar: 4, chords: [['Dm7', 1], ['G7', 1], ['Cmaj7', 2]] },
  { id: 't-e-blues', name: 'E7 · A7 · B7', level: 5, note: 'Dominant sevenths in the shapes that fit open strings', tempo: 88, beatsPerBar: 4, chords: [['E7', 2], ['A7', 1], ['B7', 1]] },

  // 6 — no new shape you have not met by now, only more of them and less time.
  { id: 't-am-dm-e7', name: 'Am · Dm · E7 · Am', level: 6, note: 'A minor cadence that actually closes', tempo: 84, beatsPerBar: 4, chords: [['Am', 1], ['Dm', 1], ['E7', 1], ['Am', 1]] },
  { id: 't-circle', name: 'Cmaj7 · Am7 · Dm7 · G7', level: 6, note: 'Round the circle, one chord a bar', tempo: 92, beatsPerBar: 4, chords: [['Cmaj7', 1], ['Am7', 1], ['Dm7', 1], ['G7', 1]] },
  { id: 't-waltz', name: 'Waltz in G', level: 6, note: 'Three beats to the bar changes where the change falls', tempo: 108, beatsPerBar: 3, chords: [['G', 2], ['C', 1], ['D', 1], ['G', 2], ['D', 1], ['G', 1]] }
];

/** Fresh slots for a template — new ids, so React sees new rows. */
export const templateSlots = (template: LoopTemplate): Slot[] =>
  template.chords.map(([symbol, bars]) => makeSlot(symbol, bars));

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
