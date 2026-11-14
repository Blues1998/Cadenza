// The Sunburst finish: a reward for practising seven days in a row.
//
// Nothing in the app mentions it. Once a seven-day run happens, the ♯♭ mark
// in the header turns gold. Tapping it says why and offers the finish, which
// from then on sits in Me beside the theme switch: warm amber on tobacco
// brown, like the sunburst lacquer on an old guitar.
//
// Earning it is permanent. A streak breaks; the week that was played does not.

import { useSyncExternalStore } from 'react';
import { isReady, practiceStats, subscribeLibrary, today } from './library';

const KEY = 'cadenza-sunburst';
const STREAK = 7;

interface SunburstState {
  /** ISO date the seventh day was reached, or null while it has not been. */
  earned: string | null;
  /** The gold mark has been tapped and the finish explained. */
  revealed: boolean;
  /** The finish is on. */
  on: boolean;
}

const EMPTY: SunburstState = { earned: null, revealed: false, on: false };

function load(): SunburstState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    const p = parsed as Partial<SunburstState>;
    return {
      earned: typeof p.earned === 'string' ? p.earned : null,
      revealed: p.revealed === true,
      on: p.on === true && typeof p.earned === 'string'
    };
  } catch {
    return EMPTY;
  }
}

let state = load();
const listeners = new Set<() => void>();

function apply(): void {
  if (state.on) document.documentElement.setAttribute('data-finish', 'sunburst');
  else document.documentElement.removeAttribute('data-finish');
}

function save(next: SunburstState): void {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* the reward just will not stick */ }
  apply();
  listeners.forEach(l => l());
}

// Before the first paint: a finish that is on should never flash orange first.
apply();

/** Gold mark tapped: the finish has been explained. */
export function revealSunburst(): void {
  if (state.earned && !state.revealed) save({ ...state, revealed: true });
}

export function setSunburst(on: boolean): void {
  if (state.earned) save({ ...state, revealed: true, on });
}

function check(): void {
  if (state.earned || !isReady()) return;
  if (practiceStats().streakDays >= STREAK) {
    save({ ...state, earned: today() });
  }
}

let watching = false;

/** Start noticing streaks. Called once by the shell. */
export function watchSunburst(): void {
  if (watching) return;
  watching = true;
  subscribeLibrary(check);
  check();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useSunburst = (): SunburstState => useSyncExternalStore(subscribe, () => state);

/** The event the gold mark sends, for the shell to show the reveal. */
export const SUNBURST_REVEAL_EVENT = 'cadenza:sunburst';
