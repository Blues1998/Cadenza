// Reading a string rather than a note.
//
// A chromatic detector answers "what pitch is that", which is the wrong
// question while somebody is turning a peg. Let the fifth string go sixty
// cents flat and the honest chromatic answer is "G sharp, forty cents sharp"
//true, and useless, because the reading now points at the wrong peg and
// the needle jumps to the far side of the dial exactly when the string is at
// its worst. What a guitarist needs is the distance to the string they are
// tuning, which stays a smooth line through the whole turn.
//
// So the tuner picks the open string the note is nearest to and measures from
// there. Outside the window it falls back to the chromatic reading, because a
// capo, a dropped D or somebody playing a fretted note are all real and none
// of them should make the screen go blank.

import { midiToFreq, midiToNoteName } from './musicTheory';

/**
 * How far from an open string a note can be and still be that string.
 *
 * The closest two strings in standard guitar tuning are four semitones apart,
 * so at 150 cents there is no ambiguity at all and there is still room for a
 * string a tone and a half flat, which is what a fresh one off the packet is.
 * A re-entrant ukulele has G and A only a tone apart; there the nearest string
 * wins, which is still the right peg until a string is a semitone out.
 */
export const STRING_WINDOW = 150;

export interface StringTarget {
  /** 1 = the string nearest the floor, counting up toward the chin, the way players count them. */
  number: number;
  /** "1st", "6th", the label on the peg. */
  ordinal: string;
  /** "E4", "A2". */
  name: string;
  midi: number;
  hz: number;
}

// The ordinal follows the peg and never the pitch: a guitar's sixth string is
// the lowest whatever it is tuned to, and a ukulele's fourth is the G nearest
// the chin even though, re-entrant, it sits above the C and the E.
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

export type Instrument = 'guitar' | 'ukulele';

export const INSTRUMENTS: { id: Instrument; name: string }[] = [
  { id: 'guitar', name: 'Guitar' },
  { id: 'ukulele', name: 'Ukulele' }
];

export interface Tuning {
  id: string;
  instrument: Instrument;
  name: string;
  /** The open strings, sixth (or fourth) first. */
  strings: string;
  /** What it is, in a few words. */
  note: string;
  /** Midi numbers, top string (highest-numbered) first, the order you tune in. */
  midis: number[];
}

/**
 * The tunings worth offering.
 *
 * Standard, then the four a guitarist meets first: a dropped sixth for
 * anything heavy, a half step down for singing and for most of the blues
 * records, and the two open-ish ones that whole repertoires are written in.
 * Anything past this belongs to somebody who already knows what they want and
 * can turn the pegs themselves.
 */
export const TUNINGS: Tuning[] = [
  { id: 'standard', instrument: 'guitar', name: 'Standard', strings: 'E A D G B E', note: 'E A D G B E', midis: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', instrument: 'guitar', name: 'Drop D', strings: 'D A D G B E', note: 'Low E dropped to D', midis: [38, 45, 50, 55, 59, 64] },
  { id: 'eflat', instrument: 'guitar', name: 'Half step down', strings: 'E♭ A♭ D♭ G♭ B♭ E♭', note: 'Every string a half step down', midis: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', instrument: 'guitar', name: 'DADGAD', strings: 'D A D G A D', note: 'Open, modal sound', midis: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', instrument: 'guitar', name: 'Open G', strings: 'D G D G B D', note: 'Open strings make a G chord', midis: [38, 43, 50, 55, 59, 62] },
  // Ukulele. Standard is re-entrant: the fourth string is a high G, so the
  // strings run G4 C4 E4 A4 and the "lowest" peg is not the lowest note.
  { id: 'uke-standard', instrument: 'ukulele', name: 'Standard', strings: 'G C E A', note: 'High G', midis: [67, 60, 64, 69] },
  { id: 'uke-lowg', instrument: 'ukulele', name: 'Low G', strings: 'G C E A', note: 'Low G', midis: [55, 60, 64, 69] },
  { id: 'uke-d', instrument: 'ukulele', name: 'D tuning', strings: 'A D F♯ B', note: 'A whole step up', midis: [69, 62, 66, 71] },
  { id: 'uke-baritone', instrument: 'ukulele', name: 'Baritone', strings: 'D G B E', note: 'Like a guitar\'s top four strings', midis: [50, 55, 59, 64] }
];

export const tuningsFor = (instrument: Instrument): Tuning[] => TUNINGS.filter(t => t.instrument === instrument);

/** The pegs of a tuning, top string first, the order you tune in. */
export function stringsOf(tuning: Tuning): StringTarget[] {
  const count = tuning.midis.length;
  return tuning.midis.map((midi, i) => {
    const named = midiToNoteName(midi);
    return {
      number: count - i,
      ordinal: ORDINAL[count - i],
      name: `${named.name}${named.octave}`,
      midi,
      hz: midiToFreq(midi)
    };
  });
}

/** Standard tuning, low to high, the order a guitar is tuned in. */
export const STANDARD: StringTarget[] = stringsOf(TUNINGS[0]);

/** Cents from a frequency to a pitch. Positive is sharp. */
export const centsTo = (hz: number, midi: number): number => 1200 * Math.log2(hz / midiToFreq(midi));

/**
 * The open string this note is closest to, and how far off it is, or null if
 * it is not near any of them.
 */
export function nearestString(
  hz: number,
  targets: StringTarget[] = STANDARD
): { target: StringTarget; cents: number } | null {
  if (!(hz > 0)) return null;
  let best: { target: StringTarget; cents: number } | null = null;
  for (const target of targets) {
    const cents = centsTo(hz, target.midi);
    if (best === null || Math.abs(cents) < Math.abs(best.cents)) best = { target, cents };
  }
  return best && Math.abs(best.cents) <= STRING_WINDOW ? best : null;
}

/** Inside this, a string is in tune. Five cents is finer than a peg turns. */
export const IN_TUNE_CENTS = 5;

/**
 * How long it has to stay there.
 *
 * A string crosses in-tune on the way past while you are still turning, and a
 * tick that lit on the way past would be a tick that meant nothing. Most of a
 * second is long enough that you have stopped and let it ring.
 */
export const HOLD_MS = 700;
