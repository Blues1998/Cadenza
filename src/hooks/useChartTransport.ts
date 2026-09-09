import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../utils/audio';
import { chartChords, type ChartSettings, type ParsedChart } from '../utils/chart';
import { preferredVoicing } from '../utils/chordbook';

export type ChartPhase = 'idle' | 'countin' | 'playing' | 'paused' | 'done';

const LEAD_SEC = 0.2;      // breathing room before the count-in's first click
const AHEAD_SEC = 0.15;    // how far ahead of the clock we schedule
const TICK_MS = 25;

/**
 * Runs a chart in time: a count-in, then a click on every beat while the
 * position advances.
 *
 * Scheduled in a rolling window rather than all at once. The whole song could
 * be scheduled up front — it is completely known — but then stopping would mean
 * chasing down every oscillator already queued, and stopping is the button
 * people press most while practising.
 *
 * Position is reported once per beat, not once per frame. Everything watching
 * it moves on beats — the line, the chord, the pulse — so a value that changed
 * sixty times a second would only be re-rendering the same chart to say the
 * same thing.
 */
export function useChartTransport(
  chart: ParsedChart,
  settings: ChartSettings,
  options: { playChords?: boolean } = {}
) {
  const { tempo, beatsPerBar, countInBars } = settings;
  const countInBeats = countInBars * beatsPerBar;

  const [phase, setPhase] = useState<ChartPhase>('idle');
  const [beat, setBeat] = useState(-1);

  // The phase as the buttons see it. Play, pause and resume all have to look
  // at where we are before they act, and they cannot do it inside a setState
  // updater: React runs those twice in development, which would start two
  // schedulers on one press. Mirrored on render, like everything else here
  // that the loops read.
  const phaseRef = useRef<ChartPhase>('idle');
  phaseRef.current = phase;

  const startTime = useRef(0);
  const pausedAt = useRef(0);
  const nextBeat = useRef(0);
  const nextChord = useRef(0);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  // The tempo and metre this run was started at. Held apart from the settings
  // so a resume lands on the same timeline the pause left, whatever the panel
  // has re-rendered with in between.
  const plan = useRef({ spb: 0.5, bpb: 4, lead: 0 });
  // Read inside the scheduler, which must not be rebuilt every time the chart
  // text changes under it.
  const live = useRef({ chart, tempo, beatsPerBar, countInBeats, playChords: options.playChords ?? false });
  live.current = { chart, tempo, beatsPerBar, countInBeats, playChords: options.playChords ?? false };

  const timeOf = (b: number) => startTime.current + (b + plan.current.lead) * plan.current.spb;

  // Silence without forgetting where we are: both loops down, the anchor and
  // the two scheduling cursors left exactly as they were.
  const halt = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }, []);

  const stop = useCallback(() => {
    halt();
    setPhase('idle');
    setBeat(-1);
  }, [halt]);

  useEffect(() => stop, [stop]);

  // The two loops: one scheduling audio a little ahead of the clock, one
  // reading the clock back for the display. Started by play, and again by
  // resume once the anchor has been moved.
  const runLoops = useCallback(() => {
    const { spb, bpb, lead } = plan.current;

    timer.current = window.setInterval(() => {
      const { chart: cur, playChords } = live.current;
      const now = audio.getCurrentTime();
      const horizon = now + AHEAD_SEC;

      while (nextBeat.current < cur.totalBeats && timeOf(nextBeat.current) < horizon) {
        const b = nextBeat.current;
        audio.playClick(timeOf(b), ((b % bpb) + bpb) % bpb === 0);
        nextBeat.current += 1;
      }

      if (playChords) {
        const all = chartChords(cur);
        while (nextChord.current < all.length && timeOf(all[nextChord.current].beat) < horizon) {
          const chord = all[nextChord.current];
          // The shape you chose, so what you hear is the chord you are being
          // shown rather than a different inversion of the same name.
          const voicing = preferredVoicing(chord.symbol);
          // Under the click, not over it — this is a reference, not the part.
          if (voicing) audio.playChord(voicing.midis, spb * 1.6, timeOf(chord.beat));
          nextChord.current += 1;
        }
      }

      if (nextBeat.current >= cur.totalBeats && now > timeOf(cur.totalBeats)) {
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = null;
        setPhase('done');
      }
    }, TICK_MS);

    const follow = () => {
      const elapsed = audio.getCurrentTime() - startTime.current;
      const position = Math.floor(elapsed / spb) - lead;
      setBeat(prev => (position === prev ? prev : position));
      setPhase(prev => {
        if (prev === 'done' || prev === 'idle' || prev === 'paused') return prev;
        return position < 0 ? 'countin' : 'playing';
      });
      frame.current = requestAnimationFrame(follow);
    };
    frame.current = requestAnimationFrame(follow);
  }, []);

  const start = useCallback(() => {
    const { chart: c, tempo: bpm, beatsPerBar: bpb, countInBeats: lead } = live.current;
    if (c.totalBeats === 0) return;
    halt();   // a second press on Again must not leave the first run's loops up

    audio.init();
    plan.current = { spb: 60 / bpm, bpb, lead };
    startTime.current = audio.getCurrentTime() + LEAD_SEC;
    nextBeat.current = -lead;
    nextChord.current = 0;
    setPhase(lead > 0 ? 'countin' : 'playing');
    setBeat(-lead);
    runLoops();
  }, [halt, runLoops]);

  // Up to AHEAD_SEC of clicks are already committed to the audio clock when
  // this lands, so the metronome can get one more beat out after the button.
  // Cancelling those would mean tracking every oscillator for the sake of a
  // sixth of a second.
  const pause = useCallback(() => {
    if (phaseRef.current !== 'playing' && phaseRef.current !== 'countin') return;
    halt();
    pausedAt.current = audio.getCurrentTime();
    setPhase('paused');
  }, [halt]);

  // Resuming moves the anchor forward by however long the pause lasted, which
  // leaves every beat's time — and both scheduling cursors, still pointing at
  // the beat we stopped on — correct on the new timeline.
  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    audio.init();
    startTime.current += audio.getCurrentTime() - pausedAt.current;
    const elapsed = audio.getCurrentTime() - startTime.current;
    setPhase(elapsed < plan.current.lead * plan.current.spb ? 'countin' : 'playing');
    runLoops();
  }, [runLoops]);

  // Finishing leaves the position at the end rather than snapping to the top,
  // so the last line is still on screen when the click stops.
  useEffect(() => {
    if (phase !== 'done') return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, [phase]);

  return { phase, beat, start, stop, pause, resume, countInBeats };
}
