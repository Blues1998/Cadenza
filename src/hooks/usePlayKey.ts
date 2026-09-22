import { useEffect, useRef } from 'react';

type Press = () => void;

/**
 * Who the space bar belongs to.
 *
 * A stack rather than a slot. Quick play opens on top of a page that may
 * already own the bar, and closing it has to hand the bar back to whatever had
 * it before rather than leave nobody holding it — so the newest registration
 * wins and unregistering restores the one underneath.
 */
const owners: Press[] = [];

/**
 * Give the space bar to this screen's transport.
 *
 * Space started and stopped the metronome on Rhythm and nowhere else, which
 * made it a fact about one page rather than a thing the app does. Any screen
 * with something to start can hold it; only one holds it at a time.
 *
 * The handler is mirrored on every render so a screen can register once and
 * still press the current closure — otherwise the bar would go on calling
 * whichever `start` existed when the screen mounted.
 */
export function usePlayKey(toggle: Press, enabled = true): void {
  const live = useRef(toggle);
  live.current = toggle;
  useEffect(() => {
    if (!enabled) return;
    const press = () => live.current();
    owners.push(press);
    return () => {
      const i = owners.lastIndexOf(press);
      if (i >= 0) owners.splice(i, 1);
    };
  }, [enabled]);
}

/** Press whatever owns the bar. False when nothing on screen has a transport. */
export function pressPlay(): boolean {
  const top = owners[owners.length - 1];
  if (!top) return false;
  top();
  return true;
}
