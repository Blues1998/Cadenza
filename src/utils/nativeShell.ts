// Behaviour that only exists inside the Android app.
//
// The @capacitor/app plugin takes over the hardware back button, and on its own
// it only steps back through the WebView's history, on the first screen it
// does nothing at all, so Back appears broken. Every Android app's first
// screen sends Back to the launcher, so this does the same: step back while
// there is somewhere to go, otherwise move the app to the background (not
// exit, which would throw away a running metronome or tuner state).

import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

/** True inside the Android app. */
export const IS_NATIVE = Capacitor.isNativePlatform();

/**
 * Accounts and cloud backup exist on the website only. The Android app keeps
 * everything on the phone and makes no requests of its own, so there is no
 * sign-in, no account to delete and nothing to declare beyond the microphone.
 */
export const ACCOUNTS_ENABLED = !IS_NATIVE;

/** Fired before the Android back button navigates; cancel it to consume Back. */
export const BACK_EVENT = 'cadenza:back';

/** While `open`, the Android back button calls `close` instead of navigating. */
export function useBackToClose(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onBack = (e: Event) => { e.preventDefault(); close(); };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, [open, close]);
}

/** Fields that bring up the on-screen keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);
const opensKeyboard = (el: EventTarget | null): boolean =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type)) ||
  (el instanceof HTMLElement && el.isContentEditable);

/**
 * While the keyboard is up, html gets .is-typing, and the phone tab bar steps
 * aside. The page shrinks to the space above the keyboard, so a bar fixed to
 * the bottom rode up with it and covered the very field being typed into.
 *
 * Focus alone is not enough: Back closes the keyboard and leaves the field
 * focused. So it is a text field with focus AND a screen shorter than its
 * full height, by more than any browser toolbar would take.
 */
function watchTyping(): void {
  let full = 0;
  const sync = () => {
    const h = Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity);
    full = Math.max(full, h);
    const up = opensKeyboard(document.activeElement) && h < full - 150;
    document.documentElement.classList.toggle('is-typing', up);
  };
  // After focus has settled, so moving from one field to the next never flickers the bar.
  const later = () => setTimeout(sync, 0);
  document.addEventListener('focusin', later);
  document.addEventListener('focusout', later);
  window.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('resize', sync);
  // A rotation changes what full height means.
  window.addEventListener('orientationchange', () => { full = 0; setTimeout(sync, 300); });
  sync();
}

export async function initNativeShell(): Promise<void> {
  watchTyping();
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    // Anything open on top of the page (a sheet, a dialog, the search panel)
    // closes first: it cancels this event, and Back goes no further.
    if (!window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }))) return;
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
