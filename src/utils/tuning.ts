// Reading a string rather than a note.
//
// A chromatic detector answers "what pitch is that", which is the wrong
// question while somebody is turning a peg. Let the fifth string go sixty
// cents flat and the honest chromatic answer is "G sharp, forty cents sharp"
// — true, and useless, because the reading now points at the wrong peg and
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
 * The closest two strings in standard tuning are four semitones apart, so at
 * 150 cents there is no ambiguity at all and there is still room for a string
 * a tone and a half flat — which is what a fresh one off the packet is.
 */
export const STRING_WINDOW = 150;

export interface StringTarget {
  /** 1 = high E, 6 = low E, the way a guitarist counts them. */
  number: number;
  /** "1st", "6th" — the label on the peg. */
  ordinal: string;
  /** "E4", "A2". */
  name: string;
  midi: number;
  hz: number;
}

// The sixth string is the lowest one whatever it is tuned to, so the ordinal
// follows the peg and never the pitch.
const ORDINALS = ['6th', '5th', '4th', '3rd', '2nd', '1st'];

export interface Tuning {
  id: string;
  name: string;
  /** What it is for, in the few words a hint has room for. */
  note: string;
  /** Six midi numbers, sixth string first. */
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
  { id: 'standard', name: 'Standard', note: 'E A D G B E', midis: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', name: 'Drop D', note: 'D A D G B E — the sixth down a tone', midis: [38, 45, 50, 55, 59, 64] },
  { id: 'eflat', name: 'Half step down', note: 'E♭ A♭ D♭ G♭ B♭ E♭ — easier on the voice', midis: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', name: 'DADGAD', note: 'D A D G A D — modal, and it rings', midis: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', name: 'Open G', note: 'D G D G B D — strum it and it is a G', midis: [38, 43, 50, 55, 59, 62] }
];

/** The six pegs of a tuning, sixth string first — the order you tune in. */
export function stringsOf(tuning: Tuning): StringTarget[] {
  return tuning.midis.map((midi, i) => {
    const named = midiToNoteName(midi);
    return {
      number: 6 - i,
      ordinal: ORDINALS[i],
      name: `${named.name}${named.octave}`,
      midi,
      hz: midiToFreq(midi)
    };
  });
}

/** Standard tuning, low to high — the order a guitar is tuned in. */
export const STANDARD: StringTarget[] = stringsOf(TUNINGS[0]);

/** Cents from a frequency to a pitch. Positive is sharp. */
export const centsTo = (hz: number, midi: number): number => 1200 * Math.log2(hz / midiToFreq(midi));

/**
 * The open string this note is closest to, and how far off it is — or null if
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
