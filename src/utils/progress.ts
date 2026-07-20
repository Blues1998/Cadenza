// Cross-lab progress store backing the dashboard's Guided Journey.
// Labs report achievement events; the journey levels check event counts.
// Persisted in localStorage, broadcast via a window event so any mounted
// component (e.g. the dashboard) updates live.

const STORAGE_KEY = 'cadenza-progress-v1';
const CHANGE_EVENT = 'cadenza-progress-change';

interface ProgressData {
  counts: Record<string, number>;
}

const load = (): ProgressData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.counts === 'object') return parsed;
    }
  } catch { /* corrupted or unavailable — start fresh */ }
  return { counts: {} };
};

let cache: ProgressData = load();

// Record that an achievement happened (labs call this at the moment of success)
export function reportProgress(eventId: string, increment = 1): void {
  cache.counts[eventId] = (cache.counts[eventId] ?? 0) + increment;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch { /* private browsing — in-memory only */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getProgressCount(eventId: string): number {
  return cache.counts[eventId] ?? 0;
}

// Re-render hook plumbing: subscribe to any progress change
export function subscribeProgress(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  // Also react to changes from other tabs
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = load();
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}
