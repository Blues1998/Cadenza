// What the app shows when something breaks.
//
// Three sizes of the same message. A screen that crashes is replaced by a card
// in its place and everything around it keeps working: the tab bar, the run,
// every other screen. If the shell itself goes, the whole page explains. And a
// failure that never touched rendering (a button's handler, a timer, a sound)
// gets a toast and leaves the screen alone.
//
// Each says what stopped, the likely reason in plain words, that the library
// is safe, and what to do next, with the details one tap away for a report.

import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { BrandMark, Wordmark } from './Brand';
import { feel } from '../utils/haptics';
import { exportLibrary, initLibrary, isoDate } from '../utils/library';
import { saveTextFile } from '../utils/saveFile';
import {
  announce, copyText, crashedRightAfterReload, describe, explainNativeRestart, record, reloadHome, reportText, reportUrl,
  TROUBLE_EVENT, type Explanation, type TroubleNotice
} from '../utils/trouble';

// ---- The boundary ----------------------------------------------------------------

interface BoundaryProps {
  /** Where this is, for the log and the report: "the Tuner screen". */
  where: string;
  /** When this changes, a caught error is forgotten and the children get another go. */
  resetKey?: string;
  /** `retries` counts how many times this same failure has been retried here. */
  fallback: (error: unknown, retry: () => void, retries: number) => ReactNode;
  children: ReactNode;
}

interface BoundaryState {
  error: unknown;
  failed: boolean;
  retries: number;
  resetKey?: string;
}

export class TroubleBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, failed: false, retries: 0, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error, failed: true };
  }

  // Moving somewhere else is the most natural retry there is.
  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { resetKey: props.resetKey, error: null, failed: false, retries: 0 };
    return null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env.DEV) (window as Window & { __sfCrash?: string }).__sfCrash = undefined;
    record(error, this.props.where, info.componentStack ?? undefined);
    feel('error');
  }

  retry = (): void => this.setState(s => ({ error: null, failed: false, retries: s.retries + 1 }));

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.state.error, this.retry, this.state.retries);
    return import.meta.env.DEV ? <>{this.props.children}<CrashProbe where={this.props.where} /></> : this.props.children;
  }
}

/**
 * Development only, and gone from the built app: lets a test break any
 * boundary on purpose. In the console, window.__sfCrash = 'the Tuner screen'
 * (or 'the app'), then cause any re-render, such as changing tabs.
 */
const CrashProbe: React.FC<{ where: string }> = ({ where }) => {
  const w = window as Window & { __sfCrash?: string };
  // Thrown on every render until a boundary has caught it: React retries a
  // failed render once before giving up, and a one-shot throw passes the retry.
  if (w.__sfCrash === where) throw new Error(`Test crash in ${where}`);
  return null;
};

/**
 * For things layered over the page (a sheet, the search panel, the welcome
 * tour). Losing one is better than losing the page under it, so it closes
 * itself and says so in a toast.
 */
export const QuietBoundary: React.FC<{ where: string; children: ReactNode }> = ({ where, children }) => (
  <TroubleBoundary where={where} fallback={error => <Announce error={error} where={where} />}>
    {children}
  </TroubleBoundary>
);

const Announce: React.FC<{ error: unknown; where: string }> = ({ error, where }) => {
  useEffect(() => {
    const explained = describe(error);
    announce({
      title: explained.kind === 'bug' ? `${capital(where)} closed` : explained.title,
      body: explained.kind === 'bug' ? 'It hit a bug, so it was closed to keep the rest of the app working.' : explained.body,
      error,
      where
    });
  }, [error, where]);
  return null;
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- The picture ---------------------------------------------------------------

/** Six strings, one snapped. Drawn, so it takes the theme's colours. */
const SnappedString: React.FC = () => (
  <svg className="trouble-art" viewBox="0 0 168 68" aria-hidden="true">
    <g className="trouble-art-frets">
      {[34, 76, 118].map(x => <line key={x} x1={x} y1="6" x2={x} y2="62" />)}
    </g>
    <g className="trouble-art-strings">
      {[10, 19, 37, 46, 55].map((y, i) => (
        <line key={y} x1="6" y1={y} x2="162" y2={y} strokeWidth={0.9 + i * 0.32} />
      ))}
    </g>
    <g className="trouble-art-snap">
      <path className="trouble-art-end trouble-art-end-l" d="M6 28 H66 c7 0 11 -4 10 -9 c-1 -4 -6 -5 -8 -2" />
      <path className="trouble-art-end trouble-art-end-r" d="M162 28 H102 c-7 0 -11 4 -10 9 c1 4 6 5 8 2" />
    </g>
  </svg>
);

// ---- The message ---------------------------------------------------------------

const SAFE = 'Your songs and progress are safe. They are saved as you go, and this did not touch them.';
const MAYBE_SAFE = 'Everything saved before this is still there. The very last change may not have been saved.';

function Details({ error, where, startOpen = false }: { error: unknown; where: string; startOpen?: boolean }) {
  const box = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (startOpen && box.current) box.current.open = true; }, [startOpen]);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const report = reportText(error, where);
  const copy = async () => setCopied((await copyText(report)) ? 'done' : 'failed');
  return (
    <details className="trouble-details" ref={box}>
      <summary>Details for a bug report</summary>
      <pre className="trouble-pre">{report}</pre>
      <div className="trouble-row">
        <button type="button" className="btn" onClick={copy}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy details'}
        </button>
        <a className="btn" href={reportUrl(error, where)} target="_blank" rel="noreferrer">Report on GitHub</a>
      </div>
      <p className="trouble-fine">Nothing is sent unless you choose to. The details hold the app version, your phone model and what went wrong, and none of your songs.</p>
    </details>
  );
}

interface CardProps {
  eyebrow: string;
  explained: Explanation;
  error: unknown;
  where: string;
  actions: ReactNode;
  note?: ReactNode;
  headingLevel?: 'h1' | 'h2';
}

function TroubleCard({ eyebrow, explained, error, where, actions, note, headingLevel = 'h2' }: CardProps) {
  const Heading = headingLevel;
  const heading = useRef<HTMLHeadingElement>(null);
  // A screen reader lands on the explanation rather than on whatever had focus
  // in the screen that just went away.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className={`trouble trouble-${explained.kind}`} role="alert" aria-live="assertive">
      <SnappedString />
      <p className="trouble-eyebrow">{eyebrow}</p>
      <Heading className="trouble-title" ref={heading} tabIndex={-1}>{explained.title}</Heading>
      <p className="trouble-body">{explained.body}</p>
      <p className="trouble-safe">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
        <span>{explained.kind === 'storage' ? MAYBE_SAFE : SAFE}</span>
      </p>
      {note}
      <div className="trouble-actions">{actions}</div>
      <Details error={error} where={where} />
    </section>
  );
}

// ---- A screen that stopped -----------------------------------------------------

interface ScreenTroubleProps {
  error: unknown;
  retry: () => void;
  /** How many times this screen has already been retried and failed again. */
  retries: number;
  /** The screen's name as the tabs show it, "Tuner". */
  label: string;
  onHome?: () => void;
}

export function ScreenTrouble({ error, retry, retries, label, onHome }: ScreenTroubleProps) {
  const explained = describe(error);
  // Trying again is free the first time. If the same screen falls over twice
  // more, it is not going to work this way and a reload is the honest offer.
  const reloadOnly = explained.retry === 'reload' || retries >= 2;
  return (
    <div className="trouble-screen">
      <TroubleCard
        eyebrow={`${label} stopped`}
        explained={explained}
        error={error}
        where={`the ${label} screen`}
        note={retries >= 1 && explained.retry === 'again'
          ? <p className="trouble-note">{retries >= 2
            ? 'It keeps failing here. Reloading starts the app fresh, which clears most problems like this.'
            : 'It failed again on the retry.'}</p>
          : null}
        actions={<>
          {reloadOnly
            ? <button type="button" className="btn btn-primary" onClick={reloadHome}>Reload the app</button>
            : <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>}
          {onHome && <button type="button" className="btn btn-secondary" onClick={onHome}>Go to Today</button>}
        </>}
      />
    </div>
  );
}

// ---- The whole app stopped -----------------------------------------------------

export function AppTrouble({ error }: { error: unknown }) {
  const explained = describe(error);
  const again = crashedRightAfterReload();
  const [saved, setSaved] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  // The library is plain data in storage, read without any of the screens that
  // just failed, so a copy can still be taken even when nothing else works.
  const saveCopy = async () => {
    setSaved('working');
    try {
      await initLibrary();
      const result = await saveTextFile(
        `sharps-and-flats-library-${isoDate()}.json`,
        JSON.stringify(exportLibrary(), null, 2),
        'application/json'
      );
      setSaved(result === 'failed' ? 'failed' : result === 'cancelled' ? 'idle' : 'done');
    } catch (e) {
      record(e, 'saving a copy after a crash');
      setSaved('failed');
    }
  };

  return (
    <div className="trouble-page">
      <header className="trouble-brand">
        <span className="trouble-brand-mark"><BrandMark /></span>
        <Wordmark />
      </header>
      <TroubleCard
        headingLevel="h1"
        eyebrow="Sharps&Flats stopped"
        explained={explained}
        error={error}
        where="the app"
        note={<>
          {again && (
            <p className="trouble-note">
              It stopped again right after reloading. Save a copy of your songs first, to be safe. Then close the app completely (swipe it away from recent apps) and open it again.
            </p>
          )}
          {saved === 'done' && <p className="trouble-note trouble-note-ok">Copy saved. To bring it back, open Songs and tap the import button next to Add song.</p>}
          {saved === 'failed' && <p className="trouble-note">The copy could not be saved. Your songs are still on this device; the app could not read them just now.</p>}
        </>}
        actions={<>
          <button type="button" className="btn btn-primary" onClick={reloadHome}>Reload</button>
          <button type="button" className="btn btn-secondary" onClick={saveCopy} disabled={saved === 'working'}>
            {saved === 'working' ? 'Saving…' : 'Save a copy of my songs'}
          </button>
        </>}
      />
    </div>
  );
}

// ---- Trouble that did not break the screen -------------------------------------

/** Shows the toasts that trouble.ts announces. One at a time, newest wins. */
export function TroubleToast() {
  const [notice, setNotice] = useState<(TroubleNotice & { id: number }) | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let id = 0;
    const onTrouble = (e: Event) => {
      const detail = (e as CustomEvent<TroubleNotice>).detail;
      setNotice({ ...detail, id: ++id });
      setOpen(false);
      feel('error');
    };
    window.addEventListener(TROUBLE_EVENT, onTrouble);
    void explainNativeRestart();
    return () => window.removeEventListener(TROUBLE_EVENT, onTrouble);
  }, []);

  // Long enough to read twice, and held while the details are open.
  useEffect(() => {
    clearTimeout(timer.current);
    if (notice && !open) timer.current = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(timer.current);
  }, [notice, open]);

  if (!notice) return null;
  return (
    <div className="trouble-toast" role="status" key={notice.id}>
      <span className="trouble-toast-icon" aria-hidden="true">!</span>
      <div className="trouble-toast-text">
        <strong>{notice.title}</strong>
        <p>{notice.body}</p>
        {notice.error !== undefined && notice.where && (
          open
            ? <Details error={notice.error} where={notice.where} startOpen />
            : <button type="button" className="trouble-toast-more" onClick={() => setOpen(true)}>Details</button>
        )}
      </div>
      <button type="button" className="trouble-toast-close" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
    </div>
  );
}
