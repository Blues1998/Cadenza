// A practice session, as a thread through the app.
//
// The app has twelve destinations and is about to have more, and the honest
// problem with that is not that any one of them is hard to find — it is that
// deciding what to do is itself work, done at the exact moment somebody has
// picked up a guitar and would rather be playing. A run answers it once: tune,
// two things that are actually in your way, and the song you are on.
//
// Deliberately not a new screen. Every step happens on the page that already
// does it best, and the run is a bar across the top that knows where you are
// up to — so this adds a thread, not a twelfth copy of the tuner.
//
// Held in localStorage rather than the library, because it is not a record of
// anything: it is where you are up to this evening. It expires, because a run
// abandoned on Tuesday should not still be waiting on Friday.

import { comfortOf, getChordSkills, type ChordComfort } from './chordbook';
import { challengeProgress, lastPractised } from './library';
import { drillSlots, nextChords, reasonFor } from './next';
import { loopSignature } from './loopbook';
import { getRecords } from './records';
import { LOOP_LEVELS, LOOP_TEMPLATES, templateChords, templateSlots } from './loopTemplates';
import type { Slot } from './loop';
import type { ActiveTab } from './route';

const KEY = 'cadenza-run';
/** Long enough for an evening, short enough that tomorrow starts fresh. */
const LIFE_MS = 6 * 60 * 60 * 1000;
/** How many drills a run holds. Two is a warm-up; five is homework. */
const DRILLS = 2;

export type StepKind = 'tune' | 'drill' | 'song';

export interface RunStep {
  kind: StepKind;
  /** The screen this step happens on. */
  tab: ActiveTab;
  /** Two or three words — what the bar calls it. */
  title: string;
  /** Why it is in the run. */
  note: string;
  songId?: string;
  /** A drill's loop, handed over on arrival. */
  slots?: Slot[];
  tempo?: number;
  beatsPerBar?: number;
  name?: string;
}

export interface PracticeRun {
  startedAt: number;
  /** Which step is current. Equal to steps.length once the run is finished. */
  at: number;
  steps: RunStep[];
  /** Per step, once it is behind you: whether it was done or waved past. */
  skipped: boolean[];
  /** The library as the run found it, so the end can say what changed. */
  before: { comfort: Record<string, ChordComfort>; bests: Record<string, number> };
}

export interface RunReport {
  minutes: number;
  done: number;
  skipped: number;
  /** Chords that moved up while the run was on. */
  promoted: { symbol: string; to: ChordComfort }[];
  /** Tempo records set while the run was on. */
  records: { chords: string; from: number | null; to: number }[];
}

const RANK: Record<ChordComfort, number> = { none: 0, shaky: 1, solid: 2 };

let run: PracticeRun | null = null;
let report: RunReport | null = null;
let loaded = false;

const listeners = new Set<() => void>();
const announce = () => { for (const l of listeners) l(); };

export function subscribeRun(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const write = () => {
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify(run));
    else localStorage.removeItem(KEY);
  } catch { /* private browsing; the run just does not survive a reload */ }
};

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const held = JSON.parse(raw) as PracticeRun;
    if (!Array.isArray(held?.steps) || held.steps.length === 0) return;
    if (Date.now() - held.startedAt > LIFE_MS) { localStorage.removeItem(KEY); return; }
    run = held;
  } catch { /* unreadable: no run, rather than a broken one */ }
}

export function getRun(): PracticeRun | null {
  load();
  return run;
}

export const getReport = (): RunReport | null => report;

const snapshot = () => ({
  comfort: Object.fromEntries(getChordSkills().map(s => [s.id, s.comfort])),
  bests: Object.fromEntries(getRecords().map(r => [r.id, r.best]))
});

/**
 * What tonight is.
 *
 * Tune first, because everything after it is wasted against a flat B. Then
 * what is actually in the way — the chord book already ranks those by how many
 * of your own songs they finish, which is a better answer than anything a run
 * could invent. Then the song, because that is what the drills were for.
 */
export function planRun(): RunStep[] {
  const steps: RunStep[] = [
    { kind: 'tune', tab: 'tuner', title: 'Tune up', note: 'One string at a time — everything after this is wasted against a flat B' }
  ];

  for (const chord of nextChords(DRILLS)) {
    steps.push({
      kind: 'drill',
      tab: 'chordbook',
      title: `${chord.symbol}, and the changes into it`,
      note: reasonFor(chord),
      slots: drillSlots(chord),
      tempo: 70,
      beatsPerBar: 4,
      name: `${chord.symbol} drill`
    });
  }

  // Nothing marked "not yet" is a good problem and still needs a middle to the
  // evening: the lowest rung holding a chord that is not yet solid is where
  // the work is, which is the same rule the drill shelf opens itself on.
  if (steps.length < DRILLS + 1) {
    const rung = LOOP_LEVELS.find(level =>
      LOOP_TEMPLATES.some(t => t.level === level.level && templateChords(t).some(s => comfortOf(s) !== 'solid'))
    ) ?? LOOP_LEVELS[0];
    for (const template of LOOP_TEMPLATES.filter(t => t.level === rung.level).slice(0, DRILLS + 1 - steps.length)) {
      steps.push({
        kind: 'drill',
        tab: 'chordbook',
        title: template.name,
        note: rung.name,
        slots: templateSlots(template),
        tempo: template.tempo,
        beatsPerBar: template.beatsPerBar,
        name: template.name
      });
    }
  }

  // Today's song, or the last one you touched — a run with nothing to play at
  // the end of it is a warm-up, and warm-ups are for something.
  const song = challengeProgress().todaySong ?? lastPractised(null)?.song ?? null;
  if (song) {
    steps.push({
      kind: 'song',
      tab: 'library',
      songId: song.id,
      title: song.title,
      note: song.artist || 'The one you are on'
    });
  }

  return steps;
}

export function startRun(): PracticeRun {
  load();
  report = null;
  run = { startedAt: Date.now(), at: 0, steps: planRun(), skipped: [], before: snapshot() };
  write();
  announce();
  return run;
}

/**
 * Finish the step you are on and move to the next.
 *
 * A new object rather than a bumped index. The bar has an effect that steers
 * the browser when the step changes, and an object mutated in place is the
 * same object as far as React is concerned — so the run would advance on
 * screen while leaving you standing on the tuner.
 */
export function advance(skip = false): void {
  if (!run) return;
  const skipped = [...run.skipped];
  skipped[run.at] = skip;
  const at = run.at + 1;
  run = { ...run, at, skipped };
  if (at >= run.steps.length) finish();
  else { write(); announce(); }
}

export function step(to: number): void {
  if (!run || to < 0 || to >= run.steps.length) return;
  run = { ...run, at: to };
  write();
  announce();
}

/** The run is over — either walked to the end, or stopped early. */
export function finish(): void {
  const held = run;
  if (!held) { announce(); return; }

  // The whole point of the snapshot taken at the start: what moved while the
  // run was on. A level says where you stand; this is the other kind.
  const promoted: RunReport['promoted'] = [];
  for (const skill of getChordSkills()) {
    const was = held.before.comfort[skill.id] ?? 'none';
    if (RANK[skill.comfort] > RANK[was]) promoted.push({ symbol: skill.label ?? skill.id, to: skill.comfort });
  }
  const records: RunReport['records'] = [];
  for (const record of getRecords()) {
    const was = held.before.bests[record.id] ?? null;
    if (was === null || record.best > was) {
      records.push({ chords: record.chords.map(([s]) => s).join(' '), from: was, to: record.best });
    }
  }
  report = {
    minutes: Math.max(1, Math.round((Date.now() - held.startedAt) / 60000)),
    done: held.steps.filter((_, i) => i < held.at && !held.skipped[i]).length,
    skipped: held.skipped.filter(Boolean).length,
    promoted,
    records
  };
  run = null;
  write();
  announce();
}

/** Throw the run away without a report — the × on the bar. */
export function abandon(): void {
  run = null;
  report = null;
  write();
  announce();
}

export function dismissReport(): void {
  report = null;
  announce();
}

/** What a run's loop looks like to the handoff. */
export const stepLoop = (s: RunStep) =>
  s.slots && s.slots.length > 0
    ? { slots: s.slots, tempo: s.tempo ?? 70, beatsPerBar: s.beatsPerBar ?? 4, name: s.name }
    : null;

/** Only used to key a drill's record lookup. */
export const stepSignature = (s: RunStep): string | null =>
  s.slots && s.slots.length > 0
    ? loopSignature(s.slots.map(slot => [slot.symbol, slot.bars] as [string, number]), s.beatsPerBar ?? 4)
    : null;
