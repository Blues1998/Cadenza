import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../utils/audio';
import { noteNameToMidi, chordShapeMidis } from '../utils/musicTheory';
import { reportProgress } from '../utils/progress';
import type { SongChart } from '../data/songCharts';

export type SongPhase = 'idle' | 'countin' | 'playing' | 'finished';
export type EventRating = 'perfect' | 'good' | 'imprecise' | 'miss';

interface JudgedPianoEvent {
  kind: 'piano';
  index: number;
  audioTime: number; // absolute audio-clock time this note is due
  midi: number;
  durationBeats: number;
  rating: EventRating | null;
}
interface JudgedGuitarEvent {
  kind: 'guitar';
  index: number;
  audioTime: number;
  chordId: string;
  direction: 'down' | 'up';
  rating: EventRating | null;
}
export type JudgedEvent = JudgedPianoEvent | JudgedGuitarEvent;

export type PlayInput =
  | { kind: 'piano'; midi: number }
  | { kind: 'guitar'; chordId: string | null };

export interface SongSummary {
  perfect: number;
  good: number;
  imprecise: number;
  miss: number;
  accuracyPct: number;
  bestStreak: number;
}

// Same four-tier grading RhythmLab uses for its metronome tap game; guitar's
// window is widened since a six-string strum can't land on one exact
// instant the way a single piano key can.
const PIANO_THRESHOLDS = { perfect: 45, good: 90, imprecise: 160 };
const GUITAR_THRESHOLDS = { perfect: 60, good: 120, imprecise: 200 };

const LEAD_IN_SEC = 0.15; // buffer before the count-in itself starts

// Drives a Song Hero session: schedules a count-in, then (Listen mode)
// plays the whole chart through the synth, or (Play mode) grades keyboard
// input against it in real time. A chart is fully known up front — unlike
// RhythmLab's metronome, which schedules indefinitely because future beats
// aren't knowable, this schedules the entire song in one pass.
export function useSongChart(chart: SongChart) {
  const [phase, setPhase] = useState<SongPhase>('idle');
  const [mode, setMode] = useState<'listen' | 'play'>('play');
  const [events, setEvents] = useState<JudgedEvent[]>([]);
  const [summary, setSummary] = useState<SongSummary | null>(null);

  const eventsRef = useRef<JudgedEvent[]>([]);
  const songStartTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<'listen' | 'play'>('play');
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const countInTimeoutRef = useRef<number | null>(null);

  const secPerBeat = 60 / chart.bpm;
  const thresholds = chart.instrument === 'guitar' ? GUITAR_THRESHOLDS : PIANO_THRESHOLDS;
  const missToleranceSec = thresholds.imprecise / 1000;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    // Listen is a passive preview with zero grading — ending one should
    // never surface a score (every event would otherwise read as "miss",
    // which is just wrong: the player was never trying to hit anything).
    if (modeRef.current !== 'play') {
      setPhase('idle');
      stopLoop();
      return;
    }

    const evs = eventsRef.current;
    const counts = { perfect: 0, good: 0, imprecise: 0, miss: 0 };
    evs.forEach(e => {
      const rating = e.rating ?? 'miss'; // safety net — the sweep should have graded everything by now
      counts[rating]++;
    });
    const scored = counts.perfect * 100 + counts.good * 75 + counts.imprecise * 40;
    const accuracyPct = evs.length ? Math.round(scored / evs.length) : 0;
    setSummary({ ...counts, accuracyPct, bestStreak: bestStreakRef.current });
    setPhase('finished');
    reportProgress('songhero-song-completed');
    reportProgress(`songhero-song-completed:${chart.id}`);
    stopLoop();
  }, [chart.id, stopLoop]);

  const tick = useCallback(() => {
    const now = audio.getCurrentTime();
    const evs = eventsRef.current;
    let changed = false;
    // Only auto-miss in Play mode — Listen is a passive preview, so notes
    // scrolling past shouldn't flip red as if the player whiffed them.
    if (modeRef.current === 'play') {
      for (const e of evs) {
        if (e.rating === null && now > e.audioTime + missToleranceSec) {
          e.rating = 'miss';
          streakRef.current = 0;
          changed = true;
        }
      }
    }
    if (changed) setEvents([...evs]);

    const last = evs[evs.length - 1];
    if (last && now > last.audioTime + missToleranceSec + 0.5) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [finish, missToleranceSec]);

  const start = useCallback((mode: 'listen' | 'play') => {
    stopLoop();
    audio.init();
    modeRef.current = mode;
    setMode(mode);

    const now = audio.getCurrentTime();
    const countInSec = chart.countInBars * chart.timeSignature * secPerBeat;
    songStartTimeRef.current = now + LEAD_IN_SEC + countInSec;

    for (let i = 0; i < chart.countInBars * chart.timeSignature; i++) {
      audio.playClick(now + LEAD_IN_SEC + i * secPerBeat, i % chart.timeSignature === 0);
    }

    const built: JudgedEvent[] =
      chart.instrument === 'piano'
        ? chart.notes.map((n, index) => ({
            kind: 'piano' as const,
            index,
            audioTime: songStartTimeRef.current + n.beat * secPerBeat,
            midi: noteNameToMidi(n.noteName, n.octave),
            durationBeats: n.durationBeats,
            rating: null,
          }))
        : chart.strums.map((s, index) => ({
            kind: 'guitar' as const,
            index,
            audioTime: songStartTimeRef.current + s.beat * secPerBeat,
            chordId: s.chordId,
            direction: s.direction,
            rating: null,
          }));

    eventsRef.current = built;
    setEvents(built);
    streakRef.current = 0;
    bestStreakRef.current = 0;
    setSummary(null);
    setPhase('countin');

    if (mode === 'listen') {
      for (const e of built) {
        if (e.kind === 'piano') {
          audio.playMidi(e.midi, Math.max(0.3, e.durationBeats * secPerBeat), e.audioTime);
        } else {
          audio.playChord(chordShapeMidis(e.chordId), 1.2, e.audioTime);
        }
      }
    }

    const msUntilStart = Math.max(0, (songStartTimeRef.current - audio.getCurrentTime()) * 1000);
    countInTimeoutRef.current = window.setTimeout(() => {
      setPhase(p => (p === 'countin' ? 'playing' : p));
    }, msUntilStart);

    rafRef.current = requestAnimationFrame(tick);
  }, [chart, secPerBeat, stopLoop, tick]);

  const stop = useCallback(() => {
    stopLoop();
    eventsRef.current = [];
    setEvents([]);
    setSummary(null);
    setPhase('idle');
  }, [stopLoop]);

  // Grades a keypress against the nearest ungraded, pitch/chord-matching
  // event within the timing window. A wrong note (or a note with nothing
  // nearby to match) simply doesn't score — it never consumes an event, so
  // a genuinely upcoming correct note is still fully hittable afterward.
  const reportInput = useCallback((input: PlayInput) => {
    if (modeRef.current !== 'play') return;
    if (phase !== 'countin' && phase !== 'playing') return;

    const perceived = audio.getCurrentTime() - audio.getOutputLatency();
    const evs = eventsRef.current;

    // Search a little wider than the actual scoring cutoff so the closest
    // candidate is found even right at the edge of the imprecise tier, but
    // the cutoff for actually counting as a hit is thresholds.imprecise —
    // anything looser than that must NOT be force-graded, or a wild-timed
    // press would get rewarded just for being the "closest" match around.
    const searchWindowSec = (thresholds.imprecise + 60) / 1000;

    let best: JudgedEvent | null = null;
    let bestDiff = Infinity;
    for (const e of evs) {
      if (e.rating !== null) continue;
      const matches = e.kind === 'piano'
        ? input.kind === 'piano' && input.midi === e.midi
        : input.kind === 'guitar' && input.chordId === e.chordId;
      if (!matches) continue;
      const diff = Math.abs(perceived - e.audioTime);
      if (diff < searchWindowSec && diff < bestDiff) {
        bestDiff = diff;
        best = e;
      }
    }
    if (!best) return;

    const diffMs = Math.round(bestDiff * 1000);
    if (diffMs > thresholds.imprecise) return; // closest candidate was still too far off to count

    const rating: EventRating =
      diffMs <= thresholds.perfect ? 'perfect' : diffMs <= thresholds.good ? 'good' : 'imprecise';

    best.rating = rating;
    setEvents([...evs]);
    streakRef.current++;
    bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
  }, [phase, thresholds]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  return { phase, mode, events, summary, start, stop, reportInput };
}
