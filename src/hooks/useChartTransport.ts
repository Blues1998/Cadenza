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
  options: { playChords?: boolean; loop?: boolean; strum?: boolean; metronome?: boolean } = {}
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
  const settingsRef = {
    chart,
    tempo,
    beatsPerBar,
    countInBeats,
    playChords: options.playChords ?? false,
    loop: options.loop ?? false,
    strum: options.strum ?? false,
    metronome: options.metronome ?? true
  };
  const live = useRef(settingsRef);
  live.current = settingsRef;

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
    timer.current = window.setInterval(() => {
      // Read afresh every tick rather than closed over at setup: the tempo can
      // move while this is running, and a closure taken once would keep the
      // loop at whatever it started at while the readout said otherwise.
      const { spb, bpb } = plan.current;
      const { chart: cur, playChords, loop, strum, metronome } = live.current;
      const now = audio.getCurrentTime();
      const horizon = now + AHEAD_SEC;
      const total = cur.totalBeats;

      // Looping counts on past the end rather than resetting the clock. The
      // anchor stays where it was set, so a lap boundary is just another beat
      // and nothing has to be re-timed at the seam — which is the one place a
      // loop is heard to stutter.
      while ((loop || nextBeat.current < total) && timeOf(nextBeat.current) < horizon) {
        const b = nextBeat.current;
        // Silencing the click stops the sound, never the counting: the beats
        // land in the same places whether or not you can hear them.
        if (metronome) audio.playClick(timeOf(b), ((b % bpb) + bpb) % bpb === 0);
        nextBeat.current += 1;
      }

      if (playChords) {
        const all = chartChords(cur);
        const at = (i: number) => (loop
          // Which chord, and which lap it belongs to.
          ? all[i % all.length].beat + Math.floor(i / all.length) * total
          : all[i].beat);
        while (all.length > 0 && (loop || nextChord.current < all.length) && timeOf(at(nextChord.current)) < horizon) {
          const i = nextChord.current;
          const chord = all[loop ? i % all.length : i];
          // The shape you chose, so what you hear is the chord you are being
          // shown rather than a different inversion of the same name.
          const voicing = preferredVoicing(chord.symbol);
          if (voicing) {
            // Strummed, the chord is the part. Blocked, it is a reference
            // under the click — which is what a song's play-along wants and
            // a chord loop does not.
            if (strum) audio.playStrum(voicing.midis, spb * 1.9, Math.min(0.022, spb / 8), timeOf(at(i)));
            else audio.playChord(voicing.midis, spb * 1.6, timeOf(at(i)));
          }
          nextChord.current += 1;
        }
      }

      if (!loop && nextBeat.current >= total && now > timeOf(total)) {
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = null;
        setPhase('done');
      }
    }, TICK_MS);

    const follow = () => {
      const { spb, lead } = plan.current;
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

  /**
   * Moving the tempo mid-flight.
   *
   * Beat times come from one anchor and one beat length, so changing the beat
   * length alone would drag the whole timeline sideways — including the beats
   * already committed to the audio clock inside the look-ahead window. The
   * anchor is moved with it, chosen so the first beat not yet scheduled keeps
   * exactly the time it was already going to have. Everything before that
   * point stands, everything after it runs at the new speed, and the seam is
   * a beat rather than a jolt.
   */
  useEffect(() => {
    const phaseNow = phaseRef.current;
    if (phaseNow === 'idle' || phaseNow === 'done') return;   // start() will read it fresh
    const spb = 60 / tempo;
    if (spb === plan.current.spb) return;
    const b0 = nextBeat.current;
    const keep = timeOf(b0);
    plan.current = { ...plan.current, spb };
    startTime.current = keep - (b0 + plan.current.lead) * spb;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo]);

  // Finishing leaves the position at the end rather than snapping to the top,
  // so the last line is still on screen when the click stops.
  useEffect(() => {
    if (phase !== 'done') return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, [phase]);

  return { phase, beat, start, stop, pause, resume, countInBeats };
}
