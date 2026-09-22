import type { Slot } from './loop';

/**
 * A loop handed to the chord page from somewhere else in the app.
 *
 * An intention, not a place — the same shape as the draft day the dashboard
 * hands the song library. It is spent the moment the page picks it up, because
 * an address you could return to would keep re-loading a drill over whatever
 * you had since built.
 *
 * Carries the tempo and metre as well as the chords, because the tempo a
 * progression was written for is part of what it is: handing over "Up the
 * neck" without its 74 hands over a different exercise.
 */
export interface Handoff {
  /** Fresh per handover, so two of the same drill in a row both land. */
  id: number;
  slots: Slot[];
  tempo: number;
  beatsPerBar: number;
  pattern?: string;
  /** What it was called where it came from, for the save field. */
  name?: string;
}

const EVENT = 'cadenza-loop-handoff';

let pending: Handoff | null = null;
let n = 0;

/** Put a loop on the chord page. Works whether or not the page is mounted. */
export function handLoop(loop: Omit<Handoff, 'id'>): void {
  pending = { ...loop, id: ++n };
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Take it, once. */
export function takeLoop(): Handoff | null {
  const held = pending;
  pending = null;
  return held;
}

export function onHandoff(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
