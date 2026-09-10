import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../utils/audio';
import { chartChords, chordsAtBeat, type ChartSettings, type ParsedChart } from '../utils/chart';
import { preferredVoicing } from '../utils/chordbook';
import { slotBeats, type StrumPattern } from '../utils/strum';

export type ChartPhase = 'idle' | 'countin' | 'playing' | 'paused' | 'done';

const LEAD_SEC = 0.2;      // breathing room before the count-in's first click
const PATTERN_RING = 1.5;  // beats a strummed chord rings for inside a pattern
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
  options: {
    playChords?: boolean;
    loop?: boolean;
    strum?: boolean;
    metronome?: boolean;
    /** A strumming pattern to play the chords with, instead of one hit each. */
    pattern?: StrumPattern | null;
  } = {}
) {
  const { tempo, beatsPerBar, countInBars } = settings;
  const countInBeats = countInBars * beatsPerBar;

  const [phase, setPhase] = useState<ChartPhase>('idle');
  const [beat, setBeat] = useState(-1);
  // Where the strumming hand is, in subdivisions. Reported separately from the
  // beat because a pattern moves twice or four times as often as one, and
  // everything else watching this only wants to know about beats.
  const [slot, setSlot] = useState(-1);

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
  // The pattern's own cursor, counting subdivisions rather than chords, plus
  // the pattern it belongs to — changing the pattern mid-loop has to re-seat
  // it or the new grid would be read at the old one's position.
  const nextStep = useRef(0);
  const patternKey = useRef<string | null>(null);
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
    metronome: options.metronome ?? true,
    pattern: options.pattern ?? null
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
    setSlot(-1);
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
      const { chart: cur, playChords, loop, strum, metronome, pattern } = live.current;
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

      // A strumming pattern turns the chords into a part: the hand keeps its
      // own time and plays whatever is being held when each stroke comes
      // round, which is the other way up from striking each chord once as it
      // arrives. So the scheduling walks subdivisions and asks the chart what
      // is held, rather than walking chords and asking when.
      if (playChords && pattern) {
        const key = `${pattern.steps.join('')}|${pattern.perBeat}`;
        const step = slotBeats(pattern);
        if (patternKey.current !== key) {
          patternKey.current = key;
          // From here, not from the top: a pattern changed mid-loop should
          // take over at the next stroke rather than jump the hand back.
          const beatNow = (now - startTime.current) / spb - plan.current.lead;
          nextStep.current = Math.max(0, Math.ceil(beatNow / step - 1e-6));
        }

        while (timeOf(nextStep.current * step) < horizon) {
          const i = nextStep.current;
          const beatAt = i * step;
          if (!loop && beatAt >= total) break;
          nextStep.current += 1;

          const stroke = pattern.steps[i % pattern.steps.length];
          if (stroke === '-') continue;
          // Where in the song this stroke lands, with the laps taken off.
          const held = chordsAtBeat(cur, loop && total > 0 ? beatAt % total : beatAt).current;
          if (!held) continue;
          // The shape you chose, so what you hear is the chord you are being
          // shown rather than a different inversion of the same name.
          const voicing = preferredVoicing(held.symbol);
          if (!voicing) continue;
          // Shorter than a single strike would ring: eight of these a bar all
          // holding a chord apiece is a wash, and a strummed guitar is not a
          // wash — each stroke is still audible over the last.
          audio.playStroke(voicing.midis, stroke, spb * PATTERN_RING, Math.min(0.018, spb / 10), timeOf(beatAt));
        }
      } else if (playChords) {
        const all = chartChords(cur);
        const at = (i: number) => (loop
          // Which chord, and which lap it belongs to.
          ? all[i % all.length].beat + Math.floor(i / all.length) * total
          : all[i].beat);
        while (all.length > 0 && (loop || nextChord.current < all.length) && timeOf(at(nextChord.current)) < horizon) {
          const i = nextChord.current;
          const chord = all[loop ? i % all.length : i];
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
      const exact = elapsed / spb - lead;
      const position = Math.floor(exact);
      setBeat(prev => (position === prev ? prev : position));

      const pat = live.current.pattern;
      const cell = pat && exact >= 0 ? Math.floor(exact * pat.perBeat) : -1;
      setSlot(prev => (cell === prev ? prev : cell));
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
    nextStep.current = 0;
    patternKey.current = null;
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

  return { phase, beat, slot, start, stop, pause, resume, countInBeats };
}
