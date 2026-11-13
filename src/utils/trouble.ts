// When something goes wrong: what it was, in words a player can act on.
//
// Errors reach the app by several roads, and each one is caught where it
// arrives:
//
//   a screen's render or effects    ScreenBoundary, the rest of the app stays up
//   the shell itself                AppBoundary, a full-page explanation
//   event handlers, timers, loops   window 'error'           → a toast
//   a promise nobody awaited        'unhandledrejection'     → a toast
//   a screen that would not load    the screen boundary, as a download problem
//   the bundle never starting       the boot guard in index.html
//   Android killing the WebView     MainActivity reloads, and the app says why
//
// Everything caught goes through describe(), so the same failure reads the
// same way wherever it lands, and into a short log kept on the device, so a
// report written after a reload still carries what happened before it.

import { registerPlugin } from '@capacitor/core';
import { IS_NATIVE } from './nativeShell';

export type TroubleKind = 'download' | 'storage' | 'audio' | 'mic' | 'memory' | 'bug';

export interface Explanation {
  kind: TroubleKind;
  /** A headline: what stopped. */
  title: string;
  /** Why, as best we can tell, and what to do about it. */
  body: string;
  /** Whether trying the same thing again can help, or only a reload will. */
  retry: 'again' | 'reload';
}

const text = (e: unknown): string => {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
};

/** Read an error for what it most likely means to the person holding the phone. */
export function describe(error: unknown): Explanation {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  const said = text(error);

  // A screen's code arrives in its own file. A failed import surfaces with a
  // different wording in every engine.
  if (/dynamically imported module|Importing a module script failed|error loading dynamically|Unable to preload|ChunkLoadError|Loading chunk/i.test(said)) {
    return IS_NATIVE
      ? {
          kind: 'download', retry: 'reload',
          title: 'Part of the app could not be opened',
          body: 'This screen is stored on your phone, but it could not be read. Reloading usually fixes it. If it keeps happening, update or reinstall the app from the Play Store; your songs are kept if you update.'
        }
      : {
          kind: 'download', retry: 'reload',
          title: 'This screen did not finish loading',
          body: 'Either the connection dropped, or a new version went live since you opened the page. Reloading fetches the current version.'
        };
  }

  if (name === 'QuotaExceededError' || /quota|IndexedDB|IDBDatabase|IDBTransaction|IDBRequest|storage is full/i.test(said)) {
    return {
      kind: 'storage', retry: 'again',
      title: 'The app could not reach its storage',
      body: IS_NATIVE
        ? 'Your songs and progress live in the app\'s storage on your phone. Saving or reading them just failed, which usually means the phone is nearly full. Free up some space and try again.'
        : 'Your songs and progress live in this browser\'s storage. Saving or reading them just failed. A private window, a nearly full disk or a blocked site-data setting can all cause it.'
    };
  }

  if (/getUserMedia|microphone|Permission denied|Requested device not found|Could not start audio source|NotReadableError|OverconstrainedError/i.test(said)) {
    return {
      kind: 'mic', retry: 'again',
      title: 'The microphone is not available',
      body: IS_NATIVE
        ? 'The tuner and the listening games need the microphone. Check that Sharps&Flats is allowed to use it (Android Settings, Apps, Sharps&Flats, Permissions) and that no other app, like a call, is using it right now.'
        : 'The tuner and the listening games need the microphone. Allow it in the browser\'s site settings, and close any other tab or app that is using it.'
    };
  }

  if (/AudioContext|AudioWorklet|decodeAudioData|Unable to decode audio|EncodingError/i.test(said)) {
    return {
      kind: 'audio', retry: 'again',
      title: 'The sound stopped working',
      body: 'Something else may have taken over the audio, like a call, a video or another music app. Close it, then try again. Turning the volume up and back down can wake a stuck speaker.'
    };
  }

  if (/out of memory|allocation failed|Maximum call stack|Array buffer allocation/i.test(said)) {
    return {
      kind: 'memory', retry: 'reload',
      title: 'Your phone ran short of memory',
      body: 'Android needed the memory back for something else. Closing apps you are not using and reloading should sort it out.'
    };
  }

  return {
    kind: 'bug', retry: 'again',
    title: 'This hit a bug',
    body: 'Nothing you did caused this; it is a mistake in the app. It usually works on a second try. If it keeps happening, sending the details below helps get it fixed.'
  };
}

// ---- What happened, kept for the report --------------------------------------

export interface LoggedTrouble {
  at: string;
  where: string;
  message: string;
  stack?: string;
}

const LOG_KEY = 'cadenza-trouble-log';
const LOG_SIZE = 8;

function readLog(): LoggedTrouble[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as LoggedTrouble[]) : [];
  } catch {
    return [];
  }
}

/** Write it down. Never throws: a failing error log would be the worst kind of irony. */
export function record(error: unknown, where: string, extraStack?: string): void {
  try {
    const entry: LoggedTrouble = {
      at: new Date().toISOString(),
      where,
      message: text(error).slice(0, 500),
      stack: ((error instanceof Error ? error.stack ?? '' : '') + (extraStack ? `\nComponents:${extraStack}` : '')).slice(0, 2500) || undefined
    };
    const log = [...readLog(), entry].slice(-LOG_SIZE);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch { /* storage itself may be what failed */ }
  if (import.meta.env.DEV) console.error(`[${where}]`, error);
}

/** Everything a report needs, as plain text a person can read before sending. */
export function reportText(error: unknown, where: string): string {
  const lines = [
    `Sharps&Flats ${__APP_VERSION__} (${IS_NATIVE ? 'Android app' : 'web'})`,
    `Where: ${where}`,
    `Screen: ${window.location.hash || '#/'}`,
    `When: ${new Date().toISOString()}`,
    `Device: ${navigator.userAgent}`,
    '',
    text(error),
    error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 12).join('\n') : ''
  ];
  const earlier = readLog().slice(0, -1).slice(-4);
  if (earlier.length) {
    lines.push('', 'Earlier:');
    for (const e of earlier) lines.push(`${e.at}  ${e.where}  ${e.message}`);
  }
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n').trim();
}

const ISSUES = 'https://github.com/Blues1998/sharps-and-flats/issues/new';

/** A new issue with the details filled in, short enough for any browser's address bar. */
export function reportUrl(error: unknown, where: string): string {
  const title = `Crash: ${text(error).slice(0, 80)}`;
  const body = `What were you doing when it happened?\n\n\n---\n\`\`\`\n${reportText(error, where).slice(0, 5000)}\n\`\`\``;
  return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/** Clipboard, with the old-fashioned fallback for WebViews that refuse it. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Start over from Home: the address may be what keeps failing. */
export function reloadHome(): void {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* fine */ }
  window.location.replace(window.location.pathname + window.location.search);
}

const RELOAD_KEY = 'cadenza-trouble-reload';

/** True when this page was opened by a crash reload a few seconds ago, and has crashed again. */
export function crashedRightAfterReload(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return at > 0 && Date.now() - at < 20_000;
  } catch {
    return false;
  }
}

// ---- Errors outside React -------------------------------------------------------

/** A toast's worth of trouble, for the shell to show. */
export const TROUBLE_EVENT = 'cadenza:trouble';

export interface TroubleNotice {
  title: string;
  body: string;
  /** Present when the report link is worth offering. */
  error?: unknown;
  where?: string;
}

export function announce(notice: TroubleNotice): void {
  window.dispatchEvent(new CustomEvent<TroubleNotice>(TROUBLE_EVENT, { detail: notice }));
}

// Things browsers throw that mean nothing to anyone: a layout pass that took
// two frames, a sound stopped before it started, a cross-origin script that
// will not say what went wrong.
const NOISE = /ResizeObserver loop|The play\(\) request was interrupted|AbortError|The operation was aborted|^Script error\.?$|\bcancell?ed\b/i;

let lastShown = '';
let lastShownAt = 0;

function fromOutsideReact(error: unknown, where: string): void {
  const said = text(error);
  if (NOISE.test(said) || NOISE.test(error instanceof Error ? error.name : '')) return;
  record(error, where);
  const explained = describe(error);
  // One toast per kind of trouble at a time. A broken animation loop can throw
  // sixty times a second, and one message says it as well as sixty.
  const now = Date.now();
  if (explained.kind === lastShown && now - lastShownAt < 15_000) return;
  lastShown = explained.kind;
  lastShownAt = now;
  announce({
    title: explained.kind === 'bug' ? 'Something did not work' : explained.title,
    body: explained.kind === 'bug'
      ? 'That last action hit a bug. Try it again. If it keeps failing, closing and reopening the app clears it.'
      : explained.body,
    error,
    where
  });
}

let installed = false;

/** The safety net under everything React cannot see: handlers, timers, animation frames, loose promises. */
export function installTroubleHandlers(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', event => {
    // A resource that failed to load (an image, a sample) arrives here with no
    // error at all; whoever asked for it handles that.
    if (!(event instanceof ErrorEvent) || (!event.error && !event.message)) return;
    fromOutsideReact(event.error ?? event.message, 'a background task');
  });
  window.addEventListener('unhandledrejection', event => {
    fromOutsideReact(event.reason, 'an unfinished task');
  });
}

// ---- Android rebuilt the page ------------------------------------------------

interface ShellPlugin {
  takeRestart(): Promise<{ reason: 'crashed' | 'memory' | null }>;
}

let restartChecked = false;

/**
 * When Android stopped the page's process and the app rebuilt it
 * (MainActivity), the page that comes back has no memory of the old one. Say
 * so once, so a screen that jumped back to Today is explained rather than
 * mysterious. Called by whatever shows the toasts, once it is listening.
 */
export async function explainNativeRestart(): Promise<void> {
  if (!IS_NATIVE || restartChecked) return;
  restartChecked = true;
  try {
    const { reason } = await registerPlugin<ShellPlugin>('Shell').takeRestart();
    if (!reason) return;
    record(new Error(`Android ${reason === 'memory' ? 'stopped' : 'lost'} the page's process`), 'the Android shell');
    announce(reason === 'memory'
      ? {
          title: 'The app restarted',
          body: 'Android needed memory for another app and closed this one in the background, so it opened again from Today. Your songs and progress are all here.'
        }
      : {
          title: 'The app restarted after a problem',
          body: 'The part of Android that draws the app stopped unexpectedly, so the app reopened from Today. Your songs and progress are all here.'
        });
  } catch { /* an older build without the plugin: nothing to say */ }
}
