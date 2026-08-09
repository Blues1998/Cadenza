// Music Theory Data and Utilities

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Maps every enharmonic spelling (sharp and flat) to its pitch-class index,
// so flat-spelled keys like Db/Ab/Eb/Bb resolve just like their sharp twins.
const NOTE_NAME_TO_INDEX: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'E#': 5, 'F': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

// Convert MIDI note number to frequency
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Convert MIDI note number to note name and octave
export function midiToNoteName(midi: number): { name: string; octave: number } {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { name: NOTE_NAMES[noteIndex], octave };
}

// Convert note name and octave to MIDI number
export function noteNameToMidi(name: string, octave: number): number {
  const noteIndex = NOTE_NAME_TO_INDEX[name];
  if (noteIndex === undefined) throw new Error(`Invalid note name: ${name}`);
  return (octave + 1) * 12 + noteIndex;
}

// Canonicalize any enharmonic spelling (flat or sharp) to the sharp/natural
// spelling used by NOTE_NAMES, so flat-spelled keys (Db, Ab, Eb, Bb, Gb...)
// still match dropdowns and lookups built off NOTE_NAMES.
export function normalizeNoteName(name: string): string {
  const noteIndex = NOTE_NAME_TO_INDEX[name];
  if (noteIndex === undefined) throw new Error(`Invalid note name: ${name}`);
  return NOTE_NAMES[noteIndex];
}

// Interface for intervals
export interface IntervalInfo {
  name: string;
  semitones: number;
  shortName: string;
  songClue: string;
}

export const INTERVALS: IntervalInfo[] = [
  { name: 'Unison', semitones: 0, shortName: 'P1', songClue: 'Same exact pitch' },
  { name: 'Minor 2nd', semitones: 1, shortName: 'm2', songClue: 'Jaws Theme ("dum-dum...")' },
  { name: 'Major 2nd', semitones: 2, shortName: 'M2', songClue: 'Happy Birthday ("Hap-py")' },
  { name: 'Minor 3rd', semitones: 3, shortName: 'm3', songClue: 'Lullaby / Greensleeves' },
  { name: 'Major 3rd', semitones: 4, shortName: 'M3', songClue: 'Oh When the Saints ("Oh when...")' },
  { name: 'Perfect 4th', semitones: 5, shortName: 'P4', songClue: 'Here Comes the Bride ("Here comes...")' },
  { name: 'Tritone', semitones: 6, shortName: 'd5', songClue: 'The Simpsons Theme ("The Simp-...")' },
  { name: 'Perfect 5th', semitones: 7, shortName: 'P5', songClue: 'Star Wars Theme ("Star Wars...")' },
  { name: 'Minor 6th', semitones: 8, shortName: 'm6', songClue: 'The Entertainer / Love Story' },
  { name: 'Major 6th', semitones: 9, shortName: 'M6', songClue: 'NBC Chimes / Bonnie Lies Over Ocean' },
  { name: 'Minor 7th', semitones: 10, shortName: 'm7', songClue: 'Star Trek Theme ("Star Trek...")' },
  { name: 'Major 7th', semitones: 11, shortName: 'M7', songClue: 'Take On Me ("Take on...")' },
  { name: 'Octave', semitones: 12, shortName: 'P8', songClue: 'Somewhere Over the Rainbow' }
];

// Scale formulas as semitone offsets from the root
export interface ScaleFormula {
  name: string;
  steps: number[];
}

export const SCALE_FORMULAS: ScaleFormula[] = [
  { name: 'Major (Ionian)', steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  { name: 'Natural Minor (Aeolian)', steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  { name: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11, 12] },
  { name: 'Pentatonic Major', steps: [0, 2, 4, 7, 9, 12] },
  { name: 'Pentatonic Minor', steps: [0, 3, 5, 7, 10, 12] },
  { name: 'Blues Scale', steps: [0, 3, 5, 6, 7, 10, 12] }
];

// Interface for chord qualities
export interface ChordQualityInfo {
  name: string;
  intervals: number[]; // Semitones relative to root
  symbols: string[];
}

export const CHORD_QUALITIES: ChordQualityInfo[] = [
  { name: 'Major Triad', intervals: [0, 4, 7], symbols: ['maj', 'M', ''] },
  { name: 'Minor Triad', intervals: [0, 3, 7], symbols: ['min', 'm', '-'] },
  { name: 'Diminished Triad', intervals: [0, 3, 6], symbols: ['dim', 'o', '°'] },
  { name: 'Augmented Triad', intervals: [0, 4, 8], symbols: ['aug', '+'] },
  { name: 'Major 7th', intervals: [0, 4, 7, 11], symbols: ['maj7', 'M7', 'Δ7'] },
  { name: 'Minor 7th', intervals: [0, 3, 7, 10], symbols: ['min7', 'm7', '-7'] },
  { name: 'Dominant 7th', intervals: [0, 4, 7, 10], symbols: ['7', 'dom7'] },
  { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10], symbols: ['m7b5', 'ø7'] },
  { name: 'Diminished 7th', intervals: [0, 3, 6, 9], symbols: ['dim7', 'o7'] }
];

// Guitar configuration (E2 standard)
export const GUITAR_STRINGS = [
  { note: 'E', octave: 4, midi: 64 }, // String 1 (highest pitch)
  { note: 'B', octave: 3, midi: 59 }, // String 2
  { note: 'G', octave: 3, midi: 55 }, // String 3
  { note: 'D', octave: 3, midi: 50 }, // String 4
  { note: 'A', octave: 2, midi: 45 }, // String 5
  { note: 'E', octave: 2, midi: 40 }  // String 6 (lowest pitch)
];

// Standard open-position chord shapes ("campfire chords"), for keyboard-driven
// guitar playing. `frets` has one entry per GUITAR_STRINGS index (0 = high E
// ... 5 = low E): a fret number (0 = open) or null for a muted/unplayed string.
export interface GuitarChordShape {
  id: string;
  label: string;
  root: string; // pitch class, matches an entry in NOTE_NAMES
  frets: (number | null)[];
}

export const GUITAR_CHORD_SHAPES: GuitarChordShape[] = [
  { id: 'C',  label: 'C major', root: 'C', frets: [0, 1, 0, 2, 3, null] },
  { id: 'G',  label: 'G major', root: 'G', frets: [3, 0, 0, 0, 2, 3] },
  { id: 'D',  label: 'D major', root: 'D', frets: [2, 3, 2, 0, null, null] },
  { id: 'A',  label: 'A major', root: 'A', frets: [0, 2, 2, 2, 0, null] },
  { id: 'E',  label: 'E major', root: 'E', frets: [0, 0, 1, 2, 2, 0] },
  { id: 'Am', label: 'A minor', root: 'A', frets: [0, 1, 2, 2, 0, null] },
  { id: 'Em', label: 'E minor', root: 'E', frets: [0, 0, 0, 2, 2, 0] },
  { id: 'Dm', label: 'D minor', root: 'D', frets: [1, 3, 2, 0, null, null] },
];

// MIDI notes sounded by a chord shape (skipping muted strings) — shared by
// useGuitarChordKeyboard (live play) and useSongChart (Listen-mode playback).
export function chordShapeMidis(chordId: string): number[] {
  const shape = GUITAR_CHORD_SHAPES.find(s => s.id === chordId);
  if (!shape) return [];
  return shape.frets
    .map((fret, i) => (fret === null ? null : GUITAR_STRINGS[i].midi + fret))
    .filter((m): m is number => m !== null);
}

// Keyboard configuration
export const PIANO_START_MIDI = 48; // C3
export const PIANO_END_MIDI = 84;   // C6 (3 Octaves + 1 note)

// Circle of Fifths data structure
export interface CircleKeyInfo {
  name: string;
  relativeMinor: string;
  sharps: number; // Positive for sharps, negative for flats
  chords: string[]; // Roman numeral scale chords: I, ii, iii, IV, V, vi, vii°
}

export const CIRCLE_OF_FIFTHS: CircleKeyInfo[] = [
  { name: 'C', relativeMinor: 'Am', sharps: 0, chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'] },
  { name: 'G', relativeMinor: 'Em', sharps: 1, chords: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'] },
  { name: 'D', relativeMinor: 'Bm', sharps: 2, chords: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'] },
  { name: 'A', relativeMinor: 'F#m', sharps: 3, chords: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'] },
  { name: 'E', relativeMinor: 'C#m', sharps: 4, chords: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'] },
  { name: 'B', relativeMinor: 'G#m', sharps: 5, chords: ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#dim'] },
  { name: 'F#', relativeMinor: 'D#m', sharps: 6, chords: ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim'] },
  { name: 'Db', relativeMinor: 'Bbm', sharps: -5, chords: ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim'] },
  { name: 'Ab', relativeMinor: 'Fm', sharps: -4, chords: ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim'] },
  { name: 'Eb', relativeMinor: 'Cm', sharps: -3, chords: ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'] },
  { name: 'Bb', relativeMinor: 'Gm', sharps: -2, chords: ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'] },
  { name: 'F', relativeMinor: 'Dm', sharps: -1, chords: ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'] }
];
