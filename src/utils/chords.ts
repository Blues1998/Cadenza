// Diatonic chord generation + guitar voicing lookup.
//
// Two halves:
//   1. `getScaleChords` — stacks thirds on any SCALE_FORMULAS entry to derive
//      the chords that belong to that scale, spelled with proper letter names
//      (key of F gives Bb, not A#).
//   2. `getVoicings` — finds every way to finger a chord on the neck, sorted
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

// Spell a 7-note scale so each degree takes the next letter of the alphabet —
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
// with the fewest accidentals — so A# major is presented as Bb major.
function bestSpelledScale(rootPc: number, steps: number[]): { root: string; notes: string[] } {
  let best: { root: string; notes: string[]; cost: number } | null = null;
  for (const candidate of SPELLING_CANDIDATES[rootPc]) {
    const notes = spellScale(candidate, steps);
    if (!notes) continue;
    const cost = notes.join('').split('').filter(c => c === '#' || c === 'b').length;
    if (!best || cost < best.cost) best = { root: candidate, notes, cost };
  }
  if (best) return { root: best.root, notes: best.notes };
  // Unspellable (shouldn't happen for the scales we ship) — fall back to sharps.
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
  | 'maj7' | 'min7' | 'dom7' | 'm7b5' | 'dim7' | 'mMaj7' | 'augMaj7';

export interface ChordType {
  id: ChordTypeId;
  name: string;
  suffix: string;      // appended to the root to make the symbol
  intervals: number[];
  major: boolean;      // drives Roman numeral casing
  mark: string;        // numeral decoration: '', '°', '+', 'ø'
  triadId?: ChordTypeId; // the plainer triad a beginner can substitute
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
  augMaj7: { id: 'augMaj7', name: 'Augmented Major 7th', suffix: 'augMaj7', intervals: [0, 4, 8, 11], major: true, mark: '+',      triadId: 'aug' }
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

// Scales with fewer than 7 notes can't be harmonised in thirds on their own —
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

// Forms and open chords below are written low-to-high (E A D G B e) — the order
// guitarists read chord charts in. GUITAR_STRINGS runs the other way, so
// everything is reversed once on the way out.
const toAppOrder = <T,>(lowToHigh: T[]): T[] => [...lowToHigh].reverse();
const APP_STRING_INDEX = (lowToHighIdx: number) => 5 - lowToHighIdx;

interface MovableForm {
  label: string;
  rootString: number;          // 0 = low E … 5 = high e
  offsets: (number | null)[];  // low→high, relative to the root's fret
  fingers: (number | null)[];  // low→high; 1 = index … 4 = pinky
}

// One entry per chord type. Each form is verified against the chord's actual
// pitch classes at placement time, so a typo here drops the shape rather than
// showing a wrong one.
const MOVABLE_FORMS: Record<ChordTypeId, MovableForm[]> = {
  maj: [
    { label: 'Top-3 triad',       rootString: 3, offsets: [null, null, null, 0, 0, -2],  fingers: [null, null, null, 2, 3, 1] },
    { label: 'Middle-3 triad',    rootString: 2, offsets: [null, null, 0, -1, -2, null], fingers: [null, null, 3, 2, 1, null] },
    { label: 'A-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 2, 2, null],     fingers: [null, 1, 2, 3, 4, null] },
    { label: 'D-shape',           rootString: 2, offsets: [null, null, 0, 2, 3, 2],      fingers: [null, null, 1, 2, 4, 3] },
    { label: 'A-shape barre',     rootString: 1, offsets: [null, 0, 2, 2, 2, 0],         fingers: [null, 1, 3, 3, 3, 1] },
    { label: 'E-shape barre',     rootString: 0, offsets: [0, 2, 2, 1, 0, 0],            fingers: [1, 3, 4, 2, 1, 1] }
  ],
  min: [
    { label: 'Top-3 triad',        rootString: 3, offsets: [null, null, null, 0, -1, -2], fingers: [null, null, null, 3, 2, 1] },
    { label: 'Middle-3 triad',     rootString: 2, offsets: [null, null, 0, -2, -2, null],  fingers: [null, null, 3, 1, 2, null] },
    { label: 'Am-shape, 4 strings', rootString: 1, offsets: [null, 0, 2, 2, 1, null],     fingers: [null, 1, 3, 4, 2, null] },
    { label: 'Dm-shape',           rootString: 2, offsets: [null, null, 0, 2, 3, 1],      fingers: [null, null, 1, 3, 4, 2] },
    { label: 'Am-shape barre',     rootString: 1, offsets: [null, 0, 2, 2, 1, 0],         fingers: [null, 1, 3, 4, 2, 1] },
    { label: 'Em-shape barre',     rootString: 0, offsets: [0, 2, 2, 0, 0, 0],            fingers: [1, 3, 4, 1, 1, 1] }
  ],
  dim: [
    { label: 'Top-3 triad',    rootString: 3, offsets: [null, null, null, 0, -1, -3], fingers: [null, null, null, 4, 3, 1] },
    { label: 'Middle-3 triad', rootString: 2, offsets: [null, null, 0, -2, -3, null],  fingers: [null, null, 4, 2, 1, null] },
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
  { rootPc: 11, type: 'dim',  label: 'Open Bdim',  frets: [null, 2, 3, 4, 3, null], fingers: [null, 1, 2, 4, 3, null] }
];

export type DifficultyTier = 'easy' | 'medium' | 'hard';

export interface ChordVoicing {
  id: string;
  label: string;
  frets: (number | null)[];    // GUITAR_STRINGS order (0 = high e), null = muted
  fingers: (number | null)[];  // same order; 0 = open string
  midis: number[];
  difficulty: number;   // purely how hard it is to fret — drives the badge
  sortKey: number;      // difficulty, nudged toward fuller-sounding shapes
  tier: DifficultyTier;
  // Set when this shape is a simplification of the requested chord rather than
  // the chord itself — e.g. playing G instead of Gmaj7.
  substituteFor?: string;
}

function voicingMidis(frets: (number | null)[]): number[] {
  return frets
    .map((f, i) => (f === null ? null : GUITAR_STRINGS[i].midi + f))
    .filter((m): m is number => m !== null);
}

// Guard against typos in the tables above: the sounding notes must be exactly
// the chord's pitch classes, with the root present somewhere.
function soundsLike(frets: (number | null)[], rootPc: number, type: ChordType): boolean {
  const want = new Set(type.intervals.map(i => (rootPc + i) % 12));
  const got = new Set(voicingMidis(frets).map(m => m % 12));
  if (got.size !== want.size) return false;
  for (const pc of got) if (!want.has(pc)) return false;
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
function placeForm(form: MovableForm, rootPc: number, type: ChordType): ChordVoicing | null {
  const rootStringApp = APP_STRING_INDEX(form.rootString);
  const openPc = GUITAR_STRINGS[rootStringApp].midi % 12;

  for (let rootFret = 0; rootFret <= MAX_FRET; rootFret++) {
    if ((openPc + rootFret) % 12 !== rootPc) continue;

    const lowToHigh = form.offsets.map(o => (o === null ? null : rootFret + o));
    if (lowToHigh.some(f => f !== null && (f < 0 || f > MAX_FRET))) continue;

    const frets = toAppOrder(lowToHigh);
    if (!soundsLike(frets, rootPc, type)) continue;

    return finish(`${type.id}-${form.label}`, form.label, frets, toAppOrder(form.fingers));
  }
  return null;
}

/**
 * Every way to play this chord, easiest first.
 *
 * For seventh chords the list also carries the plain triad underneath it,
 * marked as a substitute — dropping the 7th is what a beginner actually does
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
      .filter(v => v.tier === 'easy')
      .slice(0, 2)
      .map(v => ({ ...v, id: `sub-${v.id}`, substituteFor: label }));
    unique.push(...simpler);
  }

  return unique;
}

// Lowest fret the diagram needs to show (1 when the shape uses open strings).
export function voicingBaseFret(frets: (number | null)[]): number {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return 1;
  const min = Math.min(...fretted);
  const max = Math.max(...fretted);
  // Keep the nut in view for anything playable in first position, and for any
  // shape using an open string — its "o" marker only means anything at the nut.
  const hasOpen = frets.some(f => f === 0);
  if (max <= 4 || (hasOpen && max <= 5)) return 1;
  return min;
}
