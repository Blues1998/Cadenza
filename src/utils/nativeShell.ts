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

export async function initNativeShell(): Promise<void> {
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
