// Haptics: a small vocabulary, used the same way everywhere.
//
//   select     a detent. Toggles, segmented controls, tabs, slider notches.
//   tap        a button giving way. Primary actions, transport, play.
//   success    two rising clicks. A right answer, a string in tune, a song saved.
//   error      a low knock. A wrong answer, something that failed.
//   celebrate  a swell that lands. A milestone: a streak, a finished day.
//
// The motor work is native (android/.../FeelPlugin.java), built from Android's
// tuned primitives. On the web this is silent: a browser can only buzz, and a
// buzz is worse than nothing.
//
// Most controls get theirs from one listener (wireHaptics) rather than from
// each screen, so a new button feels like the old ones without anyone
// remembering to add it. An element can say otherwise with data-feel:
// data-feel="off" when the screen plays its own (an answer button's success
// or error), or data-feel="tap" to ask for a firmer one.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useSyncExternalStore } from 'react';

export type Feel = 'select' | 'tap' | 'success' | 'error' | 'celebrate';

interface FeelPlugin {
  play(options: { kind: Feel }): Promise<void>;
}

const IS_NATIVE = Capacitor.isNativePlatform();
const Native = IS_NATIVE ? registerPlugin<FeelPlugin>('Feel') : null;

// ---- The setting -------------------------------------------------------------

const KEY = 'cadenza-haptics';
const CHANGE = 'cadenza-haptics-change';

const read = (): boolean => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};
let enabled = read();

export function setHaptics(on: boolean): void {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* still applies this session */ }
  window.dispatchEvent(new Event(CHANGE));
  if (on) feel('success');
}

export function useHaptics(): boolean {
  return useSyncExternalStore(
    cb => { window.addEventListener(CHANGE, cb); return () => window.removeEventListener(CHANGE, cb); },
    () => enabled
  );
}

/** Whether there is anything to feel here at all: the Android app. */
export const HAS_HAPTICS = IS_NATIVE;

// ---- Playing -----------------------------------------------------------------

let last = 0;
let lastKind: Feel | null = null;

export function feel(kind: Feel): void {
  if (!Native || !enabled) return;
  const now = performance.now();
  // A burst of ticks (a slider dragged fast) blurs into a hum; keep them apart.
  // And a semantic feel right after a generic one replaces it rather than
  // stacking: the screen knew better what the press meant.
  if (kind === 'select' && now - last < 45) return;
  if (kind === lastKind && kind !== 'select' && now - last < 120) return;
  last = now;
  lastKind = kind;
  void Native.play({ kind }).catch(() => { /* no motor, nothing to do */ });
}

// ---- The listener ------------------------------------------------------------

const TAP = '.dash-run, .btn-primary, .transport-btn, .chordcard-play, .mtab, .practice-card, button.dash-card, .daynode, .songrow, .onb-choice';
const SELECT = '.segmented button, [role="tab"], [aria-pressed], .btn, .chip, .mtop-icon, summary, a.btn';

const ranges = new WeakMap<HTMLInputElement, number>();

/** A slider ticks at its notches: every step when it has a few, every tenth of the way when it has many. */
function onRange(el: HTMLInputElement): void {
  const min = Number(el.min || 0), max = Number(el.max || 100);
  const step = Number(el.step) || 1;
  const span = max - min;
  if (!(span > 0)) return;
  const steps = span / step;
  const notch = steps <= 24 ? step : span / 10;
  const v = Number(el.value);
  const at = Math.round((v - min) / notch);
  const prev = ranges.get(el);
  ranges.set(el, at);
  if (prev === undefined || prev === at) return;
  feel(v <= min || v >= max ? 'tap' : 'select');
}

export function wireHaptics(): void {
  if (!Native) return;
  document.addEventListener('click', e => {
    const target = e.target as Element | null;
    if (!target?.closest) return;
    const marked = target.closest<HTMLElement>('[data-feel]');
    if (marked) {
      const kind = marked.dataset.feel as Feel | 'off';
      if (kind !== 'off') feel(kind);
      return;
    }
    const control = target.closest<HTMLElement>('button, a, summary, input[type="checkbox"], input[type="radio"], [role="tab"]');
    if (!control || (control as HTMLButtonElement).disabled || control.getAttribute('aria-disabled') === 'true') return;
    if (control.matches('input[type="checkbox"], input[type="radio"]')) { feel('select'); return; }
    if (control.closest(TAP)) { feel('tap'); return; }
    if (control.closest(SELECT) || control.tagName === 'BUTTON') feel('select');
  }, true);
  document.addEventListener('input', e => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === 'range') onRange(el);
  }, true);
}
