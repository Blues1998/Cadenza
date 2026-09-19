// A chord progression, expressed as something the transport can already run.
//
// Kept out of the component so that the panel is only a panel — the file that
// exports it exports nothing else, which is what Fast Refresh needs and what
// navGroups.tsx was split out for.

import type { ChartLineRecord } from './chart';
import { namedVoicing, preferredVoicing } from './chordbook';
import type { ChordVoicing } from './chords';

/** One chord in the loop, and how long it is held. */
export interface Slot {
  id: string;
  symbol: string;
  bars: number;
  /**
   * The shape this chord has to be played with, named — "E-shape barre".
   *
   * Almost always absent, and absent is the right default: which shape you
   * play a chord with is a fact about your hands and lives in the chord book.
   * A drill is the exception. "Practise the barre" cannot be honoured by
   * whatever you normally reach for, because what you normally reach for is
   * the thing being avoided.
   */
  shape?: string;
}

let counter = 0;

/**
 * Ids come from a counter rather than the chord's name: the same chord can
 * appear twice in one progression — that is most of what a progression is —
 * and two slots that shared a key would be one slot to React.
 */
export const makeSlot = (symbol: string, bars = 1, shape?: string): Slot =>
  ({ id: `q${++counter}`, symbol, bars, ...(shape ? { shape } : {}) });

/**
 * What to draw and sound for this slot: the shape it asks for, or yours.
 *
 * A pin that names nothing playable falls through to the book rather than
 * going silent — the shape tables can change under a template.
 */
export const slotVoicing = (slot: Slot): ChordVoicing | null =>
  (slot.shape ? namedVoicing(slot.symbol, slot.shape) : null) ?? preferredVoicing(slot.symbol);

/**
 * The shapes a loop pins, by chord, for anything that only knows chord names.
 *
 * Keyed by symbol because that is all the chart carries by the time the
 * transport asks. A loop that used one chord twice with two different shapes
 * would collapse to the last of them — which no drill does, and which would
 * be a strange thing to ask of a progression anyway.
 */
export function slotShapes(slots: Slot[]): Record<string, ChordVoicing> {
  const out: Record<string, ChordVoicing> = {};
  for (const slot of slots) {
    if (!slot.shape) continue;
    const voicing = namedVoicing(slot.symbol, slot.shape);
    if (voicing) out[slot.symbol] = voicing;
  }
  return out;
}

/**
 * The loop, as a chart.
 *
 * A progression is a chart with no words: one line per chord, held for its
 * bars. Writing it this way means the loop is run by the same transport the
 * songs use — one clock, one count-in, one set of timing bugs already found —
 * rather than a second scheduler that would drift away from it.
 *
 * One entry per chord, and no more: how often it is struck while it is held is
 * the strumming pattern's business, and a chart that also had an opinion about
 * it would be two hands fighting over the same arm.
 */
export function loopLines(slots: Slot[]): ChartLineRecord[] {
  return slots.map(slot => ({
    id: slot.id,
    kind: 'lyric' as const,
    bars: slot.bars,
    words: [{ text: '', chord: slot.symbol, beat: 0 }]
  }));
}
