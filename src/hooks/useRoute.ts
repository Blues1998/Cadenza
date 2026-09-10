import { useMemo, useSyncExternalStore } from 'react';
import { parseHash, toHash, type Route } from '../utils/route';

// Three ways the address can change, and all of them have to reach the app:
// the Back and Forward buttons (popstate), someone editing the bar or
// following an in-page anchor (hashchange), and go() below, which uses the
// history API directly and so fires neither.
const listeners = new Set<() => void>();
const announce = (): void => {
  for (const listener of listeners) listener();
};

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

// The address itself is the snapshot. It is a string, so React compares it by
// value and a notification that changed nothing re-renders nothing — which is
// what saves us when go() and the browser both report the same move.
const readHash = (): string => window.location.hash;

/**
 * Go somewhere.
 *
 * `replace` rewrites the current entry instead of adding one, for a move that
 * is a correction rather than a destination — tidying a bare or misspelled
 * address on arrival, which nobody should be able to press Back into.
 *
 * Not a hook: navigating is something handlers do, and half the callers are
 * not components.
 */
export function go(route: Route, replace = false): void {
  const next = toHash(route);
  if (next === window.location.hash) return;
  // Assigning location.hash would push unconditionally, and there is no
  // version of it that replaces.
  window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
  announce();
}

/** Where the address says we are. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, readHash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

export default useRoute;
