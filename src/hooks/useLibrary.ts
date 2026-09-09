import { useEffect, useState } from 'react';
import { initLibrary, isReady, subscribeLibrary } from '../utils/library';

/**
 * Re-render this component whenever the library changes.
 *
 * The store itself is the source of truth and is read synchronously during
 * render — this only supplies the nudge. It returns readiness rather than data
 * so that a screen can say "loading" for the one frame before IndexedDB has
 * answered, instead of flashing an empty library at someone who has thirty
 * songs in it.
 */
export function useLibrary(): boolean {
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(isReady);

  useEffect(() => {
    const unsubscribe = subscribeLibrary(() => {
      setTick(t => t + 1);
      setReady(isReady());
    });
    void initLibrary().then(() => setReady(true));
    return unsubscribe;
  }, []);

  return ready;
}
