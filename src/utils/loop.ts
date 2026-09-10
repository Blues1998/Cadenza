// A chord progression, expressed as something the transport can already run.
//
// Kept out of the component so that the panel is only a panel — the file that
// exports it exports nothing else, which is what Fast Refresh needs and what
// navGroups.tsx was split out for.

import type { ChartLineRecord } from './chart';

/** One chord in the loop, and how long it is held. */
export interface Slot {
  id: string;
  symbol: string;
  bars: number;
}

let counter = 0;

/**
 * Ids come from a counter rather than the chord's name: the same chord can
 * appear twice in one progression — that is most of what a progression is —
 * and two slots that shared a key would be one slot to React.
 */
export const makeSlot = (symbol: string, bars = 1): Slot => ({ id: `q${++counter}`, symbol, bars });

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
