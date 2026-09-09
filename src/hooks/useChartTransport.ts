import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../utils/audio';
import { getVoicings } from '../utils/chords';
import { chartChords, type ChartSettings, type ParsedChart } from '../utils/chart';
import { chordShape } from '../utils/songText';

export type ChartPhase = 'idle' | 'countin' | 'playing' | 'done';

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

  const startTime = useRef(0);
  const nextBeat = useRef(0);
  const nextChord = useRef(0);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  // Read inside the scheduler, which must not be rebuilt every time the chart
  // text changes under it.
  const live = useRef({ chart, tempo, beatsPerBar, countInBeats, playChords: options.playChords ?? false });
  live.current = { chart, tempo, beatsPerBar, countInBeats, playChords: options.playChords ?? false };

  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
    setPhase('idle');
    setBeat(-1);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const { chart: c, tempo: bpm, beatsPerBar: bpb, countInBeats: lead } = live.current;
    if (c.totalBeats === 0) return;

    audio.init();
    const spb = 60 / bpm;
    startTime.current = audio.getCurrentTime() + LEAD_SEC;
    nextBeat.current = -lead;
    nextChord.current = 0;
    setPhase(lead > 0 ? 'countin' : 'playing');
    setBeat(-lead);

    const timeOf = (b: number) => startTime.current + (b + lead) * spb;

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
          const shape = chordShape(chord.symbol);
          if (shape) {
            const voicing = getVoicings(shape.rootPc, shape.typeId, shape.rootName)[0];
            // Under the click, not over it — this is a reference, not the part.
            if (voicing) audio.playChord(voicing.midis, spb * 1.6, timeOf(chord.beat));
          }
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
        if (prev === 'done' || prev === 'idle') return prev;
        return position < 0 ? 'countin' : 'playing';
      });
      frame.current = requestAnimationFrame(follow);
    };
    frame.current = requestAnimationFrame(follow);
  }, []);

  // Finishing leaves the position at the end rather than snapping to the top,
  // so the last line is still on screen when the click stops.
  useEffect(() => {
    if (phase !== 'done') return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, [phase]);

  return { phase, beat, start, stop, countInBeats };
}
