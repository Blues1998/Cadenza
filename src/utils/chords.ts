// Diatonic chord generation + guitar voicing lookup.
//
// Two halves:
//   1. `getScaleChords`, stacks thirds on any SCALE_FORMULAS entry to derive
//      the chords that belong to that scale, spelled with proper letter names
//      (key of F gives Bb, not A#).
//   2. `getVoicings`, finds every way to finger a chord on the neck, sorted
//      easiest first, so a beginner always has a way in.
//
// Related but deliberately separate: GUITAR_CHORD_SHAPES in musicTheory.ts is a
// small fixed set of ids referenced by songCharts data and the Guitar Mode
// keyboard. This module carries finger numbers and movable forms that that
// table has no room for; the two are not kept in sync.

import { GUITAR_STRINGS, NOTE_NAMES } from './musicTheory';
import type { ScaleFormula } from './musicTheory';

// ---------------------------------------------------------------------------
// Note spelling
// ---------------------------------------------------------------------------

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Candidate spellings per pitch class, in order of how usual they are.
const SPELLING_CANDIDATES: string[][] = [
  ['C', 'B#'], ['Db', 'C#'], ['D'], ['Eb', 'D#'], ['E', 'Fb'], ['F', 'E#'],
  ['F#', 'Gb'], ['G'], ['Ab', 'G#'], ['A'], ['Bb', 'A#'], ['B', 'Cb']
];

function pcOfSpelling(name: string): number {
  let pc = LETTER_PC[name[0]];
  for (const ch of name.slice(1)) pc += ch === '#' ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}

// Name the pitch class `pc` using `letter`, e.g. ('B', 10) -> 'Bb'.
// Returns null when that would need more than a double accidental.
function spellOn(letter: string, pc: number): string | null {
  const diff = ((pc - LETTER_PC[letter] + 18) % 12) - 6;
  if (Math.abs(diff) > 2) return null;
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
}

// Spell a 7-note scale so each degree takes the next letter of the alphabet,
// the rule that makes a key signature readable. Null if this root spelling
// forces an unwritable accidental (e.g. a triple sharp).
function spellScale(rootSpelling: string, steps: number[]): string[] | null {
  const li = LETTERS.indexOf(rootSpelling[0]);
  const rootPc = pcOfSpelling(rootSpelling);
  const out: string[] = [];
  for (let d = 0; d < 7; d++) {
    const spelled = spellOn(LETTERS[(li + d) % 7], (rootPc + steps[d]) % 12);
    if (spelled === null) return null;
    out.push(spelled);
  }
  return out;
}

// Of the enharmonic spellings of this root, keep whichever writes the scale
// with the fewest accidentals, so A# major is presented as Bb major.
function bestSpelledScale(rootPc: number, steps: number[]): { root: string; notes: string[] } {
  let best: { root: string; notes: string[]; cost: number } | null = null;
  for (const candidate of SPELLING_CANDIDATES[rootPc]) {
    const notes = spellScale(candidate, steps);
    if (!notes) continue;
    const cost = notes.join('').split('').filter(c => c === '#' || c === 'b').length;
    if (!best || cost < best.cost) best = { root: candidate, notes, cost };
  }
  if (best) return { root: best.root, notes: best.notes };
  // Unspellable (shouldn't happen for the scales we ship), fall back to sharps.
  return {
    root: NOTE_NAMES[rootPc],
    notes: steps.slice(0, 7).map(s => NOTE_NAMES[(rootPc + s) % 12])
  };
}

// Display form: real accidental glyphs read better than ASCII in the UI.
export function prettyNote(name: string): string {
  return name.replace(/#/g, '♯').replace(/b/g, '♭');
}

// ---------------------------------------------------------------------------
// Chord types
// ---------------------------------------------------------------------------

// Superset of CHORD_QUALITIES: harmonic minor also throws off a minor-major 7th
// and an augmented major 7th, and voicing lookup needs a stable id + suffix.
export type ChordTypeId =
  | 'maj' | 'min' | 'dim' | 'aug'
  | 'maj7' | 'min7' | 'dom7' | 'm7b5' | 'dim7' | 'mMaj7' | 'augMaj7'
  | 'sus2' | 'sus4'
  | 'add9' | 'madd9' | 'pow5' | 'maj6' | 'min6'
  | 'dom7sus4' | 'dom9' | 'min9' | 'maj9' | 'dom7s9';

export interface ChordType {
  id: ChordTypeId;
  name: string;
  suffix: string;      // appended to the root to make the symbol
  intervals: number[];
  major: boolean;      // drives Roman numeral casing
  mark: string;        // numeral decoration: '', '°', '+', 'ø'
  triadId?: ChordTypeId; // the plainer triad a beginner can substitute
  /**
   * Tones a shape may leave out. Six strings and four fingers cannot hold
   * every note of a ninth chord, and guitarists drop the fifth first: it adds
   * the least to what the chord is.
   */
  optional?: number[];
}

export const CHORD_TYPES: Record<ChordTypeId, ChordType> = {
  maj:     { id: 'maj',     name: 'Major',              suffix: '',      intervals: [0, 4, 7],      major: true,  mark: '' },
  min:     { id: 'min',     name: 'Minor',              suffix: 'm',     intervals: [0, 3, 7],      major: false, mark: '' },
  dim:     { id: 'dim',     name: 'Diminished',         suffix: 'dim',   intervals: [0, 3, 6],      major: false, mark: '°' },
  aug:     { id: 'aug',     name: 'Augmented',          suffix: 'aug',   intervals: [0, 4, 8],      major: true,  mark: '+' },
  maj7:    { id: 'maj7',    name: 'Major 7th',          suffix: 'maj7',  intervals: [0, 4, 7, 11],  major: true,  mark: '',        triadId: 'maj' },
  min7:    { id: 'min7',    name: 'Minor 7th',          suffix: 'm7',    intervals: [0, 3, 7, 10],  major: false, mark: '',        triadId: 'min' },
  dom7:    { id: 'dom7',    name: 'Dominant 7th',       suffix: '7',     intervals: [0, 4, 7, 10],  major: true,  mark: '',        triadId: 'maj' },
  m7b5:    { id: 'm7b5',    name: 'Half-Diminished 7th', suffix: 'm7♭5', intervals: [0, 3, 6, 10], major: false, mark: 'ø', triadId: 'dim' },
  dim7:    { id: 'dim7',    name: 'Diminished 7th',     suffix: 'dim7',  intervals: [0, 3, 6, 9],   major: false, mark: '°',  triadId: 'dim' },
  mMaj7:   { id: 'mMaj7',   name: 'Minor-Major 7th',    suffix: 'mMaj7', intervals: [0, 3, 7, 11],  major: false, mark: '',        triadId: 'min' },
  augMaj7: { id: 'augMaj7', name: 'Augmented Major 7th', suffix: 'augMaj7', intervals: [0, 4, 8, 11], major: true, mark: '+',      triadId: 'aug' },
  sus2:    { id: 'sus2',    name: 'Suspended 2nd',      suffix: 'sus2',  intervals: [0, 2, 7],      major: true,  mark: '',        triadId: 'maj' },
  sus4:    { id: 'sus4',    name: 'Suspended 4th',      suffix: 'sus4',  intervals: [0, 5, 7],      major: true,  mark: '',        triadId: 'maj' },
  add9:    { id: 'add9',    name: 'Added 9th',          suffix: 'add9',  intervals: [0, 2, 4, 7],   major: true,  mark: '',        triadId: 'maj' },
  madd9:   { id: 'madd9',   name: 'Minor added 9th',    suffix: 'madd9', intervals: [0, 2, 3, 7],   major: false, mark: '',        triadId: 'min' },
  pow5:    { id: 'pow5',    name: 'Power chord',        suffix: '5',     intervals: [0, 7],         major: true,  mark: '' },
  maj6:    { id: 'maj6',    name: 'Major 6th',          suffix: '6',     intervals: [0, 4, 7, 9],   major: true,  mark: '',        triadId: 'maj',  optional: [7] },
  min6:    { id: 'min6',    name: 'Minor 6th',          suffix: 'm6',    intervals: [0, 3, 7, 9],   major: false, mark: '',        triadId: 'min',  optional: [7] },
  dom7sus4: { id: 'dom7sus4', name: '7th suspended 4th', suffix: '7sus4', intervals: [0, 5, 7, 10], major: true,  mark: '',        triadId: 'sus4', optional: [7] },
  dom9:    { id: 'dom9',    name: 'Dominant 9th',       suffix: '9',     intervals: [0, 2, 4, 7, 10], major: true, mark: '',       triadId: 'dom7', optional: [7] },
  min9:    { id: 'min9',    name: 'Minor 9th',          suffix: 'm9',    intervals: [0, 2, 3, 7, 10], major: false, mark: '',      triadId: 'min7', optional: [7] },
  maj9:    { id: 'maj9',    name: 'Major 9th',          suffix: 'maj9',  intervals: [0, 2, 4, 7, 11], major: true, mark: '',       triadId: 'maj7', optional: [7] },
  dom7s9:  { id: 'dom7s9',  name: '7th sharp 9',        suffix: '7#9',   intervals: [0, 3, 4, 7, 10], major: true, mark: '',       triadId: 'dom7', optional: [7] }
};

const TYPE_BY_INTERVALS = new Map<string, ChordType>(
  Object.values(CHORD_TYPES).map(t => [t.intervals.join(','), t])
);

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// ---------------------------------------------------------------------------
// Diatonic chords in a scale
// ---------------------------------------------------------------------------

export interface ScaleChord {
  degree: number;         // 0-based scale degree
  numeral: string;        // 'ii', 'V', 'vii°' …
  rootName: string;       // spelled, e.g. 'Bb'
  rootPc: number;
  type: ChordType;
  symbol: string;         // e.g. 'Bbm7'
  noteNames: string[];    // spelled chord tones
}

export interface ScaleChordSet {
  chords: ScaleChord[];
  scaleNotes: string[];
  // Set when the picked scale has too few notes to harmonise on its own and we
  // borrowed a parent scale instead.
  borrowedFrom?: string;
}

// Scales with fewer than 7 notes can't be harmonised in thirds on their own,
// stacking degrees of a pentatonic gives sonorities nobody calls chords. Real
// players reach for the parent scale's chords instead, so that's what we show.
const PARENT_SCALE: Record<string, string> = {
  'Pentatonic Major': 'Major (Ionian)',
  'Pentatonic Minor': 'Natural Minor (Aeolian)',
  'Blues Scale': 'Natural Minor (Aeolian)'
};

export function isSevenNoteScale(scale: ScaleFormula): boolean {
  return scale.steps.length >= 8;
}

// Build the chords that belong to `scale` rooted on `rootPc`.
// `sevenths` stacks a fourth note on each; otherwise plain triads.
export function getScaleChords(
  rootPc: number,
  scale: ScaleFormula,
  sevenths: boolean,
  allScales: ScaleFormula[]
): ScaleChordSet {
  let working = scale;
  let borrowedFrom: string | undefined;

  if (!isSevenNoteScale(scale)) {
    const parentName = PARENT_SCALE[scale.name];
    const parent = allScales.find(s => s.name === parentName);
    if (parent) {
      working = parent;
      borrowedFrom = parent.name;
    } else {
      return { chords: [], scaleNotes: [] };
    }
  }

  const steps = working.steps.slice(0, 7);
  const { notes } = bestSpelledScale(rootPc, steps);

  const size = sevenths ? 4 : 3;
  const chords: ScaleChord[] = [];

  for (let d = 0; d < 7; d++) {
    // Stack thirds: every other degree of the scale, wrapping past the octave.
    const toneIdx = Array.from({ length: size }, (_, k) => d + k * 2);
    const semis = toneIdx.map(i => steps[i % 7] + 12 * Math.floor(i / 7));
    const intervals = semis.map(s => (s - semis[0] + 120) % 12).sort((a, b) => a - b);

    const type = TYPE_BY_INTERVALS.get(intervals.join(','));
    if (!type) continue; // an exotic stack we have no name (or shapes) for

    const numeral = (type.major ? ROMAN[d] : ROMAN[d].toLowerCase()) + type.mark;
    chords.push({
      degree: d,
      numeral,
      rootName: notes[d],
      rootPc: (rootPc + steps[d]) % 12,
      type,
      symbol: notes[d] + type.suffix,
      noteNames: toneIdx.map(i => notes[i % 7])
    });
  }

  return { chords, scaleNotes: notes, borrowedFrom };
}

// ---------------------------------------------------------------------------
// Guitar voicings
// ---------------------------------------------------------------------------

const MAX_FRET = 15;

// Forms and open chords below are written low-to-high (E A D G B e), the order
// guitarists read chord charts in. GUITAR_STRINGS runs the other way, so
// everything is reversed once on the way out.
const toAppOrder = <T,>(lowToHigh: T[]): T[] => [...lowToHigh].reverse();
const APP_STRING_INDEX = (lowToHighIdx: number) => 5 - lowToHighIdx;

interface MovableForm {
  /** Also part of the stored id of a chosen shape, so it never changes. */
  label: string;
  /** What a player reads, when the label is shorthand they would not. */
  name?: string;
  rootString: number;          // 0 = low E … 5 = high e
  offsets: (number | null)[];  // low→high, relative to the root's fret
  fingers: (number | null)[];  // low→high; 1 = index … 4 = pinky
}

// One entry per chord type. Each form is verified against the chord's actual
// pitch classes at placement time, so a typo here drops the shape rather than
// showing a wrong one.
const MOVABLE_FORMS: Record<ChordTypeId, MovableForm[]> = {
  maj: [
    { label: 'Top-3 triad', name: 'Top 3 strings',       rootString: 3, offsets: [null, null, null, 0, 0, -2],  fingers: [null, null, null, 2, 3, 1] },
    { label: 'Middle-3 triad', name: 'Middle 3 strings',    rootString: 2, offsets: [null, null, 0, -1, -2, null], fingers: [null, null, 3, 2, 1, null] },
    { label: 'A-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 2, 2, null],     fingers: [null, 1, 2, 3, 4, null] },
    { label: 'D-shape',           rootString: 2, offsets: [null, null, 0, 2, 3, 2],      fingers: [null, null, 1, 2, 4, 3] },
    { label: 'A-shape barre',     rootString: 1, offsets: [null, 0, 2, 2, 2, 0],         fingers: [null, 1, 3, 3, 3, 1] },
    { label: 'E-shape barre',     rootString: 0, offsets: [0, 2, 2, 1, 0, 0],            fingers: [1, 3, 4, 2, 1, 1] }
  ],
  min: [
    { label: 'Top-3 triad', name: 'Top 3 strings',        rootString: 3, offsets: [null, null, null, 0, -1, -2], fingers: [null, null, null, 3, 2, 1] },
    { label: 'Middle-3 triad', name: 'Middle 3 strings',     rootString: 2, offsets: [null, null, 0, -2, -2, null],  fingers: [null, null, 3, 1, 2, null] },
    { label: 'Am-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 2, 1, null],     fingers: [null, 1, 3, 4, 2, null] },
    { label: 'Dm-shape',           rootString: 2, offsets: [null, null, 0, 2, 3, 1],      fingers: [null, null, 1, 3, 4, 2] },
    { label: 'Am-shape barre',     rootString: 1, offsets: [null, 0, 2, 2, 1, 0],         fingers: [null, 1, 3, 4, 2, 1] },
    { label: 'Em-shape barre',     rootString: 0, offsets: [0, 2, 2, 0, 0, 0],            fingers: [1, 3, 4, 1, 1, 1] }
  ],
  dim: [
    { label: 'Top-3 triad', name: 'Top 3 strings',    rootString: 3, offsets: [null, null, null, 0, -1, -3], fingers: [null, null, null, 4, 3, 1] },
    { label: 'Middle-3 triad', name: 'Middle 3 strings', rootString: 2, offsets: [null, null, 0, -2, -3, null],  fingers: [null, null, 4, 2, 1, null] },
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 1, 2, 1, null],     fingers: [null, 1, 2, 4, 3, null] }
  ],
  aug: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -1, -2, -2, null], fingers: [null, 4, 3, 1, 2, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, -1, -1, -2], fingers: [null, null, 4, 2, 3, 1] }
  ],
  maj7: [
    { label: 'A-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 1, 2, null], fingers: [null, 1, 3, 2, 4, null] },
    { label: 'D-shape',            rootString: 2, offsets: [null, null, 0, 2, 2, 2], fingers: [null, null, 1, 3, 3, 3] },
    { label: 'A-shape barre',      rootString: 1, offsets: [null, 0, 2, 1, 2, 0],    fingers: [null, 1, 3, 2, 4, 1] },
    { label: 'E-shape barre',      rootString: 0, offsets: [0, 2, 1, 1, 0, 0],       fingers: [1, 4, 2, 3, 1, 1] }
  ],
  min7: [
    { label: 'A-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 0, 1, null], fingers: [null, 1, 3, 1, 2, null] },
    { label: 'D-shape',            rootString: 2, offsets: [null, null, 0, 2, 1, 1], fingers: [null, null, 1, 4, 2, 3] },
    { label: 'A-shape barre',      rootString: 1, offsets: [null, 0, 2, 0, 1, 0],    fingers: [null, 1, 3, 1, 2, 1] },
    { label: 'Em-shape barre',     rootString: 0, offsets: [0, 2, 0, 0, 0, 0],       fingers: [1, 3, 1, 1, 1, 1] }
  ],
  dom7: [
    { label: 'A-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 0, 2, null], fingers: [null, 1, 3, 1, 4, null] },
    { label: 'D-shape',            rootString: 2, offsets: [null, null, 0, 2, 1, 2], fingers: [null, null, 1, 4, 2, 3] },
    { label: 'A-shape barre',      rootString: 1, offsets: [null, 0, 2, 0, 2, 0],    fingers: [null, 1, 3, 1, 4, 1] },
    { label: 'E-shape barre',      rootString: 0, offsets: [0, 2, 0, 1, 0, 0],       fingers: [1, 3, 1, 2, 1, 1] }
  ],
  m7b5: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 1, 0, 1, null],  fingers: [null, 2, 3, 1, 4, null] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, 0, 0, -1, null], fingers: [2, null, 3, 4, 1, null] }
  ],
  dim7: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 1, -1, 1, null], fingers: [null, 2, 3, 1, 4, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, 1, 0, 1],  fingers: [null, null, 1, 3, 2, 4] }
  ],
  mMaj7: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 2, 1, 1, null], fingers: [null, 1, 4, 2, 3, null] },
    { label: 'E-string root', rootString: 0, offsets: [0, 2, 1, 0, 0, null],    fingers: [1, 4, 3, 2, 2, null] }
  ],
  augMaj7: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -1, -2, -3, null], fingers: [null, 4, 3, 2, 1, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, -1, -1, -3], fingers: [null, null, 4, 2, 3, 1] }
  ],
  sus2: [
    { label: 'D-shape',       rootString: 2, offsets: [null, null, 0, 2, 3, 0],    fingers: [null, null, 1, 2, 3, 1] },
    { label: 'A-shape barre', rootString: 1, offsets: [null, 0, 2, 2, 0, 0],       fingers: [null, 1, 3, 4, 1, 1] }
  ],
  sus4: [
    { label: 'D-shape',       rootString: 2, offsets: [null, null, 0, 2, 3, 3],    fingers: [null, null, 1, 2, 3, 4] },
    { label: 'A-shape barre', rootString: 1, offsets: [null, 0, 2, 2, 3, 0],       fingers: [null, 1, 2, 3, 4, 1] },
    { label: 'E-shape barre', rootString: 0, offsets: [0, 2, 2, 2, 0, 0],          fingers: [1, 2, 3, 4, 1, 1] }
  ],
  add9: [
    { label: 'C-shape',       rootString: 1, offsets: [null, 0, -1, -3, 0, null],  fingers: [null, 3, 2, 1, 4, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, -1, -2, 0],  fingers: [null, null, 3, 2, 1, 4] },
    { label: 'G-shape',       rootString: 0, offsets: [0, -1, -3, -1, null, null], fingers: [4, 2, 1, 3, null, null] }
  ],
  madd9: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -2, -3, 0, null],  fingers: [null, 3, 2, 1, 4, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, -2, -2, 0],  fingers: [null, null, 3, 1, 2, 4] }
  ],
  pow5: [
    { label: 'E-string root', rootString: 0, offsets: [0, 2, 2, null, null, null], fingers: [1, 3, 4, null, null, null] },
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 2, 2, null, null], fingers: [null, 1, 3, 4, null, null] }
  ],
  maj6: [
    { label: 'A-shape',       rootString: 1, offsets: [null, 0, 2, 2, 2, 2],       fingers: [null, 1, 3, 3, 3, 3] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, 2, 0, 2],    fingers: [null, null, 1, 3, 1, 4] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, -1, 1, 0, null],   fingers: [2, null, 1, 4, 3, null] }
  ],
  min6: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 2, -1, 1, null],   fingers: [null, 2, 4, 1, 3, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, 2, 0, 1],    fingers: [null, null, 1, 3, 1, 2] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, -1, 0, 0, null],   fingers: [2, null, 1, 3, 4, null] }
  ],
  dom7sus4: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, 2, 0, 3, null],    fingers: [null, 1, 3, 1, 4, null] },
    { label: 'D-string root', rootString: 2, offsets: [null, null, 0, 2, 1, 3],    fingers: [null, null, 1, 3, 2, 4] },
    { label: 'A-shape barre', rootString: 1, offsets: [null, 0, 2, 0, 3, 0],       fingers: [null, 1, 3, 1, 4, 1] },
    { label: 'E-shape barre', rootString: 0, offsets: [0, 2, 0, 2, 0, 0],          fingers: [1, 3, 1, 4, 1, 1] }
  ],
  dom9: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -1, 0, 0, 0],      fingers: [null, 2, 1, 3, 3, 3] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, 0, 1, 0, 2],       fingers: [2, null, 1, 3, 1, 4] }
  ],
  min9: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -2, 0, 0, 0],      fingers: [null, 2, 1, 3, 3, 3] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, 0, 0, 0, 2],       fingers: [1, null, 1, 1, 1, 3] }
  ],
  maj9: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -1, 1, 0, null],   fingers: [null, 2, 1, 4, 3, null] },
    { label: 'E-string root', rootString: 0, offsets: [0, null, 1, 1, 0, 2],       fingers: [1, null, 2, 3, 1, 4] }
  ],
  dom7s9: [
    { label: 'A-string root', rootString: 1, offsets: [null, 0, -1, 0, 1, null],   fingers: [null, 2, 1, 3, 4, null] }
  ]
};

// Open-position chords, which beat any movable shape for ease but only exist at
// specific roots. Written low→high; finger 0 means an open string.
interface OpenChord {
  rootPc: number;
  type: ChordTypeId;
  label: string;
  frets: (number | null)[];
  fingers: (number | null)[];
}

const OPEN_CHORDS: OpenChord[] = [
  { rootPc: 0,  type: 'maj',  label: 'Open C',     frets: [null, 3, 2, 0, 1, 0],    fingers: [null, 3, 2, 0, 1, 0] },
  { rootPc: 0,  type: 'maj7', label: 'Open Cmaj7', frets: [null, 3, 2, 0, 0, 0],    fingers: [null, 3, 2, 0, 0, 0] },
  { rootPc: 0,  type: 'dom7', label: 'Open C7',    frets: [null, 3, 2, 3, 1, 0],    fingers: [null, 3, 2, 4, 1, 0] },
  { rootPc: 2,  type: 'maj',  label: 'Open D',     frets: [null, null, 0, 2, 3, 2], fingers: [null, null, 0, 1, 3, 2] },
  { rootPc: 2,  type: 'min',  label: 'Open Dm',    frets: [null, null, 0, 2, 3, 1], fingers: [null, null, 0, 2, 3, 1] },
  { rootPc: 2,  type: 'dom7', label: 'Open D7',    frets: [null, null, 0, 2, 1, 2], fingers: [null, null, 0, 2, 1, 3] },
  { rootPc: 2,  type: 'maj7', label: 'Open Dmaj7', frets: [null, null, 0, 2, 2, 2], fingers: [null, null, 0, 1, 1, 1] },
  { rootPc: 2,  type: 'min7', label: 'Open Dm7',   frets: [null, null, 0, 2, 1, 1], fingers: [null, null, 0, 2, 1, 1] },
  { rootPc: 4,  type: 'maj',  label: 'Open E',     frets: [0, 2, 2, 1, 0, 0],       fingers: [0, 2, 3, 1, 0, 0] },
  { rootPc: 4,  type: 'min',  label: 'Open Em',    frets: [0, 2, 2, 0, 0, 0],       fingers: [0, 2, 3, 0, 0, 0] },
  { rootPc: 4,  type: 'dom7', label: 'Open E7',    frets: [0, 2, 0, 1, 0, 0],       fingers: [0, 2, 0, 1, 0, 0] },
  { rootPc: 4,  type: 'min7', label: 'Open Em7',   frets: [0, 2, 0, 0, 0, 0],       fingers: [0, 2, 0, 0, 0, 0] },
  { rootPc: 4,  type: 'maj7', label: 'Open Emaj7', frets: [0, 2, 1, 1, 0, 0],       fingers: [0, 3, 1, 2, 0, 0] },
  { rootPc: 5,  type: 'maj',  label: 'F on 4 strings', frets: [null, null, 3, 2, 1, 1], fingers: [null, null, 3, 2, 1, 1] },
  { rootPc: 5,  type: 'maj7', label: 'Open Fmaj7', frets: [null, null, 3, 2, 1, 0], fingers: [null, null, 3, 2, 1, 0] },
  { rootPc: 7,  type: 'maj',  label: 'Open G',     frets: [3, 2, 0, 0, 0, 3],       fingers: [2, 1, 0, 0, 0, 4] },
  { rootPc: 7,  type: 'dom7', label: 'Open G7',    frets: [3, 2, 0, 0, 0, 1],       fingers: [3, 2, 0, 0, 0, 1] },
  { rootPc: 7,  type: 'maj7', label: 'Open Gmaj7', frets: [3, 2, 0, 0, 0, 2],       fingers: [3, 2, 0, 0, 0, 1] },
  { rootPc: 9,  type: 'maj',  label: 'Open A',     frets: [null, 0, 2, 2, 2, 0],    fingers: [null, 0, 1, 2, 3, 0] },
  { rootPc: 9,  type: 'min',  label: 'Open Am',    frets: [null, 0, 2, 2, 1, 0],    fingers: [null, 0, 2, 3, 1, 0] },
  { rootPc: 9,  type: 'dom7', label: 'Open A7',    frets: [null, 0, 2, 0, 2, 0],    fingers: [null, 0, 2, 0, 3, 0] },
  { rootPc: 9,  type: 'min7', label: 'Open Am7',   frets: [null, 0, 2, 0, 1, 0],    fingers: [null, 0, 2, 0, 1, 0] },
  { rootPc: 9,  type: 'maj7', label: 'Open Amaj7', frets: [null, 0, 2, 1, 2, 0],    fingers: [null, 0, 3, 1, 2, 0] },
  { rootPc: 11, type: 'dom7', label: 'Open B7',    frets: [null, 2, 1, 2, 0, 2],    fingers: [null, 2, 1, 3, 0, 4] },
  { rootPc: 11, type: 'min7', label: 'Easy Bm7',   frets: [null, 2, 0, 2, 0, 2],    fingers: [null, 1, 0, 2, 0, 3] },
  { rootPc: 11, type: 'dim',  label: 'Open Bdim',  frets: [null, 2, 3, 4, 3, null], fingers: [null, 1, 2, 4, 3, null] },
  { rootPc: 0,  type: 'sus2', label: 'Open Csus2', frets: [null, 3, 0, 0, 3, 3],    fingers: [null, 2, 0, 0, 3, 4] },
  { rootPc: 0,  type: 'sus4', label: 'Open Csus4', frets: [null, 3, 3, 0, 1, 1],    fingers: [null, 3, 4, 0, 1, 1] },
  { rootPc: 2,  type: 'sus2', label: 'Open Dsus2', frets: [null, null, 0, 2, 3, 0], fingers: [null, null, 0, 1, 3, 0] },
  { rootPc: 2,  type: 'sus4', label: 'Open Dsus4', frets: [null, null, 0, 2, 3, 3], fingers: [null, null, 0, 1, 2, 3] },
  { rootPc: 4,  type: 'sus4', label: 'Open Esus4', frets: [0, 2, 2, 2, 0, 0],       fingers: [0, 2, 3, 4, 0, 0] },
  { rootPc: 7,  type: 'sus4', label: 'Open Gsus4', frets: [3, 3, 0, 0, 1, 3],       fingers: [2, 3, 0, 0, 1, 4] },
  { rootPc: 9,  type: 'sus2', label: 'Open Asus2', frets: [null, 0, 2, 2, 0, 0],    fingers: [null, 0, 1, 2, 0, 0] },
  { rootPc: 9,  type: 'sus4', label: 'Open Asus4', frets: [null, 0, 2, 2, 3, 0],    fingers: [null, 0, 1, 2, 3, 0] },
  { rootPc: 0,  type: 'add9', label: 'Open Cadd9', frets: [null, 3, 2, 0, 3, 3],    fingers: [null, 2, 1, 0, 3, 4] },
  { rootPc: 7,  type: 'add9', label: 'Open Gadd9', frets: [3, 2, 0, 2, 0, 3],       fingers: [2, 1, 0, 3, 0, 4] },
  { rootPc: 4,  type: 'add9', label: 'Open Eadd9', frets: [0, 2, 4, 1, 0, 0],       fingers: [0, 2, 4, 1, 0, 0] },
  { rootPc: 9,  type: 'add9', label: 'Open Aadd9', frets: [null, 0, 2, 4, 2, 0],    fingers: [null, 0, 1, 4, 2, 0] },
  { rootPc: 2,  type: 'add9', label: 'Open Dadd9', frets: [null, 5, 4, 2, 3, 0],    fingers: [null, 4, 3, 1, 2, 0] },
  { rootPc: 5,  type: 'add9', label: 'Fadd9 on 4 strings', frets: [null, null, 3, 2, 1, 3], fingers: [null, null, 3, 2, 1, 4] },
  { rootPc: 4,  type: 'madd9', label: 'Open Emadd9', frets: [0, 2, 4, 0, 0, 0],     fingers: [0, 1, 3, 0, 0, 0] },
  { rootPc: 9,  type: 'madd9', label: 'Open Amadd9', frets: [null, 0, 2, 4, 1, 0],  fingers: [null, 0, 2, 4, 1, 0] },
  { rootPc: 0,  type: 'maj6', label: 'Open C6',    frets: [null, 3, 2, 2, 1, 0],    fingers: [null, 4, 2, 3, 1, 0] },
  { rootPc: 7,  type: 'maj6', label: 'Open G6',    frets: [3, 2, 0, 0, 0, 0],       fingers: [2, 1, 0, 0, 0, 0] },
  { rootPc: 4,  type: 'maj6', label: 'Open E6',    frets: [0, 2, 2, 1, 2, 0],       fingers: [0, 2, 3, 1, 4, 0] },
  { rootPc: 9,  type: 'min6', label: 'Open Am6',   frets: [null, 0, 2, 2, 1, 2],    fingers: [null, 0, 2, 3, 1, 4] },
  { rootPc: 4,  type: 'min6', label: 'Open Em6',   frets: [0, 2, 2, 0, 2, 0],       fingers: [0, 1, 2, 0, 3, 0] },
  { rootPc: 4,  type: 'dom9', label: 'Open E9',    frets: [0, 2, 0, 1, 0, 2],       fingers: [0, 2, 0, 1, 0, 3] },
  { rootPc: 9,  type: 'min9', label: 'Open Am9',   frets: [null, 0, 5, 5, 0, 0],    fingers: [null, 0, 2, 3, 0, 0] },
  { rootPc: 4,  type: 'min9', label: 'Open Em9',   frets: [0, 2, 0, 0, 0, 2],       fingers: [0, 1, 0, 0, 0, 2] },
  { rootPc: 0,  type: 'maj9', label: 'Open Cmaj9', frets: [null, 3, 2, 4, 3, 0],    fingers: [null, 2, 1, 4, 3, 0] },
  { rootPc: 4,  type: 'dom7s9', label: 'Hendrix E7#9', frets: [0, 7, 6, 7, 8, 0],   fingers: [0, 2, 1, 3, 4, 0] }
];

export type DifficultyTier = 'easy' | 'medium' | 'hard';

export interface ChordVoicing {
  id: string;
  label: string;
  frets: (number | null)[];    // GUITAR_STRINGS order (0 = high e), null = muted
  fingers: (number | null)[];  // same order; 0 = open string
  midis: number[];
  difficulty: number;   // purely how hard it is to fret, drives the badge
  sortKey: number;      // difficulty, nudged toward fuller-sounding shapes
  tier: DifficultyTier;
  // Set when this shape is a simplification of the requested chord rather than
  // the chord itself, e.g. playing G instead of Gmaj7.
  substituteFor?: string;
}

function voicingMidis(frets: (number | null)[]): number[] {
  return frets
    .map((f, i) => (f === null ? null : GUITAR_STRINGS[i].midi + f))
    .filter((m): m is number => m !== null);
}

// Guard against typos in the tables above: the sounding notes must be exactly
// the chord's pitch classes, with the root present somewhere.
//
// A tone the type marks optional may be missing, never wrong: nothing outside
// the chord sounds. A slash chord's bass is the one note allowed in from
// outside, the G under Am/G.
function soundsLike(frets: (number | null)[], rootPc: number, type: ChordType, bassPc?: number): boolean {
  const want = new Set(type.intervals.map(i => (rootPc + i) % 12));
  const optional = new Set((type.optional ?? []).map(i => (rootPc + i) % 12));
  const got = new Set(voicingMidis(frets).map(m => m % 12));
  for (const pc of got) if (!want.has(pc) && pc !== bassPc) return false;
  for (const pc of want) if (!got.has(pc) && !optional.has(pc)) return false;
  return got.has(rootPc);
}

// How hard is this to actually fret? Counts fingers, barres, stretch, and the
// awkwardness of muting a string in the middle of the chord.
function scoreDifficulty(frets: (number | null)[], fingers: (number | null)[]): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return 0;

  const used = new Set(fingers.filter((f): f is number => f !== null && f > 0));
  const span = Math.max(...fretted) - Math.min(...fretted);

  // A finger covering several strings at once is a barre; wider is harder.
  let widestBarre = 0;
  for (const finger of used) {
    const count = fingers.filter(f => f === finger).length;
    if (count > widestBarre) widestBarre = count;
  }
  const barre = widestBarre >= 5 ? 3.5 : widestBarre >= 3 ? 2.5 : widestBarre === 2 ? 1 : 0;

  // Muted strings between two sounding ones must be damped mid-strum.
  const sounding = frets.map(f => f !== null);
  const first = sounding.indexOf(true);
  const last = sounding.lastIndexOf(true);
  const innerMute = sounding.slice(first, last + 1).includes(false) ? 1.5 : 0;

  const high = Math.min(...fretted) >= 7 ? 1 : 0;

  return used.size + barre + Math.max(0, span - 2) * 1.5 + innerMute + high;
}

const tierOf = (score: number): DifficultyTier =>
  score <= 3.5 ? 'easy' : score <= 6 ? 'medium' : 'hard';

function finish(
  id: string,
  label: string,
  frets: (number | null)[],
  fingers: (number | null)[],
  substituteFor?: string
): ChordVoicing {
  // An offset landing on fret 0 is an open string, whatever the table said.
  const normalised = fingers.map((f, i) => (frets[i] === 0 ? 0 : f));
  const difficulty = scoreDifficulty(frets, normalised);
  // A three-string grip needs fewer fingers than open Em but is a thinner,
  // less useful chord, so ordering leans toward whatever sounds fullest. This
  // stays out of `difficulty` so the badge keeps telling the physical truth.
  const silent = frets.filter(f => f === null).length;
  return {
    id,
    label,
    frets,
    fingers: normalised,
    midis: voicingMidis(frets),
    difficulty,
    sortKey: difficulty + silent * 0.6,
    tier: tierOf(difficulty),
    substituteFor
  };
}

// Slide a movable form up the neck until its root lands on `rootPc` and every
// fret fits on the instrument. Lowest workable position wins.
//
// A barre form never starts at fret 0, because a bar at fret 0 is not a bar,
// the nut is already holding those strings down, and what you get is the open
// chord the form was named after. Placed there it was dropped anyway, as a
// duplicate of that open chord, which quietly meant E, A, Em and Am had no
// barre shape at all: the one place on the neck the form fits them is the
// twelfth fret, an octave above the nut, and the search had already stopped.
function placeForm(form: MovableForm, rootPc: number, type: ChordType): ChordVoicing | null {
  const rootStringApp = APP_STRING_INDEX(form.rootString);
  const openPc = GUITAR_STRINGS[rootStringApp].midi % 12;
  const lowest = /barre/i.test(form.label) ? 1 : 0;

  for (let rootFret = lowest; rootFret <= MAX_FRET; rootFret++) {
    if ((openPc + rootFret) % 12 !== rootPc) continue;

    const lowToHigh = form.offsets.map(o => (o === null ? null : rootFret + o));
    if (lowToHigh.some(f => f !== null && (f < 0 || f > MAX_FRET))) continue;

    const frets = toAppOrder(lowToHigh);
    if (!soundsLike(frets, rootPc, type)) continue;

    return finish(`${type.id}-${form.label}`, form.name ?? form.label, frets, toAppOrder(form.fingers));
  }
  return null;
}

/**
 * Every way to play this chord, easiest first.
 *
 * For seventh chords the list also carries the plain triad underneath it,
 * marked as a substitute, dropping the 7th is what a beginner actually does
 * when the full shape is out of reach.
 */
export function getVoicings(rootPc: number, typeId: ChordTypeId, rootName?: string): ChordVoicing[] {
  const type = CHORD_TYPES[typeId];
  const out: ChordVoicing[] = [];

  for (const open of OPEN_CHORDS) {
    if (open.rootPc !== rootPc || open.type !== typeId) continue;
    if (!soundsLike(toAppOrder(open.frets), rootPc, type)) continue;
    out.push(finish(`open-${open.label}`, open.label, toAppOrder(open.frets), toAppOrder(open.fingers)));
  }

  for (const form of MOVABLE_FORMS[typeId]) {
    const placed = placeForm(form, rootPc, type);
    if (placed) out.push(placed);
  }

  // Drop shapes that came out identical (an open chord often equals a form
  // placed at fret 0).
  const seen = new Set<string>();
  const unique = out.filter(v => {
    const key = v.frets.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.sortKey - b.sortKey);

  if (type.triadId) {
    const label = (rootName ?? NOTE_NAMES[rootPc]) + CHORD_TYPES[type.triadId].suffix;
    const simpler = getVoicings(rootPc, type.triadId, rootName)
      .filter(v => v.tier === 'easy' && !v.substituteFor)
      .slice(0, 2)
      .map(v => ({ ...v, id: `sub-${v.id}`, substituteFor: label }));
    unique.push(...simpler);
  }

  return unique;
}

// ---------------------------------------------------------------------------
// Slash chords: a chord over a chosen bass note, D/F#, G/B, Am/G
// ---------------------------------------------------------------------------

interface SlashShape {
  rootPc: number;
  type: ChordTypeId;
  bassPc: number;
  label: string;
  frets: (number | null)[];   // low→high
  fingers: (number | null)[]; // low→high
}

// The ones everybody plays the same way. Anything not here is built from the
// plain chord's shapes below.
const SLASH_SHAPES: SlashShape[] = [
  { rootPc: 2, type: 'maj', bassPc: 6,  label: 'Open D/F#',  frets: [2, 0, 0, 2, 3, 2],       fingers: [1, 0, 0, 2, 4, 3] },
  { rootPc: 2, type: 'maj', bassPc: 9,  label: 'Open D/A',   frets: [null, 0, 0, 2, 3, 2],    fingers: [null, 0, 0, 1, 3, 2] },
  { rootPc: 2, type: 'maj', bassPc: 0,  label: 'Open D/C',   frets: [null, 3, 0, 2, 3, 2],    fingers: [null, 3, 0, 1, 4, 2] },
  { rootPc: 7, type: 'maj', bassPc: 11, label: 'Open G/B',   frets: [null, 2, 0, 0, 0, 3],    fingers: [null, 1, 0, 0, 0, 3] },
  { rootPc: 7, type: 'maj', bassPc: 6,  label: 'Open G/F#',  frets: [2, null, 0, 0, 0, 3],    fingers: [1, null, 0, 0, 0, 3] },
  { rootPc: 7, type: 'maj', bassPc: 2,  label: 'Open G/D',   frets: [null, null, 0, 0, 0, 3], fingers: [null, null, 0, 0, 0, 3] },
  { rootPc: 0, type: 'maj', bassPc: 7,  label: 'Open C/G',   frets: [3, 3, 2, 0, 1, 0],       fingers: [3, 4, 2, 0, 1, 0] },
  { rootPc: 0, type: 'maj', bassPc: 4,  label: 'Open C/E',   frets: [0, 3, 2, 0, 1, 0],       fingers: [0, 3, 2, 0, 1, 0] },
  { rootPc: 0, type: 'maj', bassPc: 11, label: 'Open C/B',   frets: [null, 2, 2, 0, 1, 0],    fingers: [null, 2, 3, 0, 1, 0] },
  { rootPc: 9, type: 'min', bassPc: 7,  label: 'Open Am/G',  frets: [3, 0, 2, 2, 1, 0],       fingers: [4, 0, 2, 3, 1, 0] },
  { rootPc: 9, type: 'min', bassPc: 4,  label: 'Open Am/E',  frets: [0, 0, 2, 2, 1, 0],       fingers: [0, 0, 2, 3, 1, 0] },
  { rootPc: 9, type: 'min', bassPc: 6,  label: 'Open Am/F#', frets: [2, 0, 2, 2, 1, 0],       fingers: [1, 0, 3, 4, 2, 0] },
  { rootPc: 5, type: 'maj', bassPc: 0,  label: 'F/C',        frets: [null, 3, 3, 2, 1, 1],    fingers: [null, 3, 4, 2, 1, 1] },
  { rootPc: 5, type: 'maj', bassPc: 7,  label: 'F/G',        frets: [3, null, 3, 2, 1, 1],    fingers: [3, null, 4, 2, 1, 1] },
  { rootPc: 4, type: 'min', bassPc: 2,  label: 'Open Em/D',  frets: [null, null, 0, 0, 0, 0], fingers: [null, null, 0, 0, 0, 0] },
  { rootPc: 9, type: 'maj', bassPc: 1,  label: 'A/C#',       frets: [null, 4, 2, 2, 2, null], fingers: [null, 4, 1, 1, 1, null] },
  { rootPc: 4, type: 'maj', bassPc: 11, label: 'Open E/B',   frets: [null, 2, 2, 1, 0, 0],    fingers: [null, 2, 3, 1, 0, 0] }
];

/** The bass is the lowest note sounding, and the chord is all there above or with it. */
function slashSoundsRight(frets: (number | null)[], rootPc: number, type: ChordType, bassPc: number): boolean {
  if (!soundsLike(frets, rootPc, type, bassPc)) return false;
  const midis = voicingMidis(frets);
  const lowest = Math.min(...midis);
  return lowest % 12 === bassPc && midis.filter(m => m === lowest).length === 1;
}

// Which finger goes on the new bass note: a free one, in the order the frets
// ask for, so a lower fret never gets a higher finger than a note above it.
// None when no free finger fits that order.
function fingerFor(fret: number, frets: (number | null)[], fingers: (number | null)[]): number | null {
  if (fret === 0) return 0;
  const used = new Set(fingers.filter((f): f is number => f !== null && f > 0));
  let best: number | null = null;
  let bestClash = Infinity;
  for (const candidate of [1, 2, 3, 4]) {
    if (used.has(candidate)) continue;
    let clash = 0;
    frets.forEach((f, i) => {
      const other = fingers[i];
      if (f === null || f === 0 || other === null || other === 0) return;
      if ((f < fret && other > candidate) || (f > fret && other < candidate)) clash++;
    });
    if (clash < bestClash) { best = candidate; bestClash = clash; }
  }
  // Fingers crossed over each other is not a grip anyone would use.
  return bestClash === 0 ? best : null;
}

// Finger a grip from nothing, low→high: the index takes the lowest fret, as a
// bar when several strings share it and nothing between them is left open or
// muted, and every other note gets the finger its distance from the index
// asks for. Null when that takes more than four fingers.
function fingerFresh(frets: (number | null)[]): (number | null)[] | null {
  const fingers: (number | null)[] = frets.map(f => (f === null ? null : f === 0 ? 0 : -1));
  const fretted = frets.map((f, i) => [f, i] as const).filter(([f]) => f !== null && f > 0) as [number, number][];
  if (!fretted.length) return fingers;
  const minFret = Math.min(...fretted.map(([f]) => f));
  let next = 1;
  for (const fret of [...new Set(fretted.map(([f]) => f))].sort((a, b) => a - b)) {
    const strings = fretted.filter(([f]) => f === fret).map(([, i]) => i);
    const first = Math.max(next, 1 + fret - minFret);
    const lo = Math.min(...strings);
    const hi = Math.max(...strings);
    const barrable = fret === minFret && strings.length >= 2 &&
      frets.slice(lo, hi + 1).every(f => f !== null && f >= fret);
    if (barrable) {
      strings.forEach(i => { fingers[i] = first; });
      next = first + 1;
    } else {
      strings.forEach((i, k) => { fingers[i] = first + k; });
      next = first + strings.length;
    }
    if (next - 1 > 4) return null;
  }
  return fingers;
}

/**
 * Every way to play a chord over a given bass note, easiest first.
 *
 * Built from the plain chord's own shapes: the bass goes on the low E or A
 * string, anything below it is muted, and a string left between them rings
 * open when its note belongs to the chord. A shape whose new note is out of
 * the hand's reach, or lands above the chord, is dropped. When nothing fits,
 * the plain chord is offered instead, marked as standing in.
 */
export function getSlashVoicings(rootPc: number, typeId: ChordTypeId, bassPc: number, rootName?: string, bassName?: string): ChordVoicing[] {
  const type = CHORD_TYPES[typeId];
  const root = rootName ?? NOTE_NAMES[rootPc];
  const bass = bassName ?? NOTE_NAMES[bassPc];
  const out: ChordVoicing[] = [];

  for (const shape of SLASH_SHAPES) {
    if (shape.rootPc !== rootPc || shape.type !== typeId || shape.bassPc !== bassPc) continue;
    const frets = toAppOrder(shape.frets);
    if (!slashSoundsRight(frets, rootPc, type, bassPc)) continue;
    out.push(finish(`slash-${shape.label}`, shape.label, frets, toAppOrder(shape.fingers)));
  }

  const plain = getVoicings(rootPc, typeId, rootName).filter(v => !v.substituteFor);
  for (const base of plain) {
    const baseFrets = toAppOrder(base.frets);     // back to low→high
    const baseFingers = toAppOrder(base.fingers);
    const firstSounding = baseFrets.findIndex(f => f !== null);
    for (const string of [0, 1]) {
      const openPc = GUITAR_STRINGS[APP_STRING_INDEX(string)].midi % 12;
      const low = (bassPc - openPc + 12) % 12;
      for (const fret of [low, low + 12]) {
        if (fret > MAX_FRET) continue;
        const frets = baseFrets.map((f, i) => (i < string ? null : f));
        const fingers = baseFingers.map((f, i) => (i <= string ? null : f));
        frets[string] = fret;
        // A string between the bass and the chord rings open if it can.
        const chordPcs = new Set(type.intervals.map(iv => (rootPc + iv) % 12));
        for (let i = string + 1; i < firstSounding; i++) {
          const pc = GUITAR_STRINGS[APP_STRING_INDEX(i)].midi % 12;
          if (chordPcs.has(pc) || pc === bassPc) { frets[i] = 0; fingers[i] = 0; }
        }
        const fretted = frets.filter((f): f is number => f !== null && f > 0);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 3) continue;
        // Open strings under a shape high on the neck only sound wrong.
        if (frets.some(f => f === 0) && fretted.length && Math.max(...fretted) > 5) continue;
        const finger = fingerFor(fret, frets, fingers);
        let grip: (number | null)[] | null = fingers;
        if (finger === null) grip = fingerFresh(frets);
        else fingers[string] = finger;
        if (!grip) continue;
        const app = toAppOrder(frets);
        if (!slashSoundsRight(app, rootPc, type, bassPc)) continue;
        out.push(finish(`slash-${bassPc}-${string}-${base.id}`, `${base.label}, ${bass} in the bass`, app, toAppOrder(grip)));
      }
    }
  }

  const seen = new Set<string>();
  const unique = out.filter(v => {
    const key = v.frets.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.sortKey - b.sortKey);
  if (unique.length) return unique;

  const symbol = root + type.suffix;
  return getVoicings(rootPc, typeId, rootName)
    .filter(v => !v.substituteFor)
    .slice(0, 2)
    .map(v => ({ ...v, id: `sub-${v.id}`, substituteFor: symbol }));
}

/** How many strings one finger is asked to cover at once. */
export function barreWidth(fingers: (number | null)[]): number {
  let widest = 0;
  for (const finger of new Set(fingers.filter((f): f is number => f !== null && f > 0))) {
    const count = fingers.filter(f => f === finger).length;
    if (count > widest) widest = count;
  }
  return widest;
}

/**
 * Whether this shape lays the index across the neck.
 *
 * The finger numbers alone do not settle it. An Am-shape barre is written
 * with finger 1 at each end of the grip and three fingers over the middle:
 * two entries in the table, one bar under the hand, and exactly the thing an
 * F asks for. So the name is what is read, the shape tables call every
 * movable form what it is, with the finger count as a backstop for anything
 * added later that does not say so in its label.
 */
export const isBarre = (v: ChordVoicing): boolean =>
  /barre/i.test(v.label) || barreWidth(v.fingers) >= 3;

// Lowest fret the diagram needs to show (1 when the shape uses open strings).
export function voicingBaseFret(frets: (number | null)[]): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return 1;
  const min = Math.min(...fretted);
  const max = Math.max(...fretted);
  // Keep the nut in view for anything playable in first position, and for any
  // shape using an open string, its "o" marker only means anything at the nut.
  const hasOpen = frets.some(f => f === 0);
  if (max <= 4 || (hasOpen && max <= 5)) return 1;
  return min;
}
