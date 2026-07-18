// Music Theory Data and Utilities

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
  const noteIndex = NOTE_NAMES.indexOf(name);
  if (noteIndex === -1) throw new Error(`Invalid note name: ${name}`);
  return (octave + 1) * 12 + noteIndex;
}

// Interface for intervals
export interface IntervalInfo {
  name: string;
  semitones: number;
  shortName: string;
}

export const INTERVALS: IntervalInfo[] = [
  { name: 'Unison', semitones: 0, shortName: 'P1' },
  { name: 'Minor 2nd', semitones: 1, shortName: 'm2' },
  { name: 'Major 2nd', semitones: 2, shortName: 'M2' },
  { name: 'Minor 3rd', semitones: 3, shortName: 'm3' },
  { name: 'Major 3rd', semitones: 4, shortName: 'M3' },
  { name: 'Perfect 4th', semitones: 5, shortName: 'P4' },
  { name: 'Tritone', semitones: 6, shortName: 'd5' },
  { name: 'Perfect 5th', semitones: 7, shortName: 'P5' },
  { name: 'Minor 6th', semitones: 8, shortName: 'm6' },
  { name: 'Major 6th', semitones: 9, shortName: 'M6' },
  { name: 'Minor 7th', semitones: 10, shortName: 'm7' },
  { name: 'Major 7th', semitones: 11, shortName: 'M7' },
  { name: 'Octave', semitones: 12, shortName: 'P8' }
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
