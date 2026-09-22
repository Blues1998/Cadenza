import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { IconBest, IconCheck, IconX } from './Icons';
import { go } from '../hooks/useRoute';
import { handLoop } from '../utils/handoff';
import { COMFORT_LABEL } from '../utils/chordbook';
import {
  abandon,
  advance,
  dismissReport,
  finish,
  getReport,
  getRun,
  step,
  stepLoop,
  subscribeRun
} from '../utils/practiceRun';

/**
 * Two snapshots, one subscription.
 *
 * useSyncExternalStore wants a value it can compare, and both of these are
 * objects rebuilt on every change — so the comparison is done on a version
 * counter and the objects are read afterwards. Bumping it on every announce is
 * what makes "the run changed" and "the report arrived" the same event.
 */
let version = 0;
const bump = () => { version += 1; };
subscribeRun(bump);

/** Whether a bar is on screen, for the shell that has to make room for it. */
export function useRunning(): boolean {
  useSyncExternalStore(subscribeRun, () => version, () => 0);
  return getRun() !== null || getReport() !== null;
}

export const RunBar: React.FC = () => {
  useSyncExternalStore(subscribeRun, () => version, () => 0);
  const run = getRun();
  const report = getReport();

  // Where the run has sent us, so that wandering off mid-step is allowed.
  // Navigating on every render would pin you to the tuner until you pressed a
  // button; navigating when the step changes is the run doing its one job.
  const sent = useRef(-1);
  useEffect(() => {
    if (!run) { sent.current = -1; return; }
    if (sent.current === run.at) return;
    sent.current = run.at;
    const now = run.steps[run.at];
    if (!now) return;
    const loop = stepLoop(now);
    if (loop) handLoop(loop);
    go({ tab: now.tab, songId: now.songId ?? null });
  }, [run]);

  if (report) {
    const nothing = report.promoted.length === 0 && report.records.length === 0;
    return (
      <div className="runbar is-report" role="status">
        <span className="runbar-label readout">that session</span>
        <dl className="runbar-nums">
          <div><dt>{report.done === 1 ? 'thing' : 'things'}</dt><dd className="readout">{report.done}</dd></div>
          <div><dt>min</dt><dd className="readout">{report.minutes}</dd></div>
        </dl>
        <p className="runbar-said">
          {nothing
            ? report.skipped > 0
              ? `${report.skipped} skipped. Nothing moved — which happens, and the next one is easier for it.`
              : 'Nothing moved on paper. The hands still did the work.'
            : [
                ...report.records.map(r => `${r.chords} at ${r.to}${r.from === null ? '' : `, up from ${r.from}`}`),
                ...report.promoted.map(p => `${p.symbol} is ${COMFORT_LABEL[p.to].toLocaleLowerCase()} now`)
              ].join(' · ')}
        </p>
        {report.records.length > 0 && <span className="runbar-mark"><IconBest size={14} /></span>}
        <button type="button" className="btn btn-primary runbar-go" onClick={dismissReport}>Done</button>
      </div>
    );
  }

  if (!run) return null;

  const now = run.steps[run.at];
  const last = run.at === run.steps.length - 1;

  return (
    <div className="runbar" role="region" aria-label="Today's run">
      <span className="runbar-label readout">today</span>

      {/* The steps, as steps. Pressable, because a run is a suggestion — if
          the tuner is the only part you wanted, you should be able to say so
          without walking through the rest. */}
      <ol className="runbar-pips">
        {run.steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              className={`runbar-pip${i === run.at ? ' is-at' : ''}${i < run.at ? (run.skipped[i] ? ' is-skipped' : ' is-done') : ''}`}
              onClick={() => step(i)}
              aria-current={i === run.at ? 'step' : undefined}
              title={s.title}
            >
              {i < run.at && !run.skipped[i] ? <IconCheck size={11} /> : <span className="readout">{i + 1}</span>}
            </button>
          </li>
        ))}
      </ol>

      <div className="runbar-said">
        <span className="runbar-title">{now.title}</span>
        <span className="runbar-note">{now.note}</span>
      </div>

      <div className="runbar-acts">
        <button type="button" className="btn runbar-skip" onClick={() => advance(true)}>Skip</button>
        {/* advance() finishes the run by itself once it walks off the end,
            so the last step needs a different word and nothing else. */}
        <button type="button" className="btn btn-primary runbar-go" onClick={() => advance(false)}>
          {last ? 'Finish' : 'Done'}
        </button>
      </div>

      <button type="button" className="runbar-shut" onClick={run.at > 0 ? finish : abandon} aria-label="End the run" title="End the run">
        <IconX size={13} />
      </button>
    </div>
  );
};

export default RunBar;
