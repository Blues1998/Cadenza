import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Segmented } from '../components/Segmented';
import { LabIcon } from '../components/LabIcon';
import { Pendulum } from '../components/Pendulum';
import { usePlayKey } from '../hooks/usePlayKey';
import { audio } from '../utils/audio';
import { clearTempoLog, getTempoLog, heldLabel, logTempo, whenHeld, type TempoRun } from '../utils/tempoLog';
import { reportProgress } from '../utils/progress';

interface TapHit {
  id: number;
  expectedTime: number;
  actualTime: number;
  differenceMs: number; // actual - expected
  rating: 'perfect' | 'good' | 'imprecise' | 'miss';
}

// Events plotted on the live timing graph. All times are audio-clock seconds.
interface TimelineBeat {
  time: number;      // when the click is HEARD (scheduled time + output latency)
  accented: boolean; // beat 1 of the bar
}
interface TimelineTap {
  time: number;        // when the press landed on the audio clock
  matchedTime: number; // heard time of the beat this tap was graded against
  differenceMs: number;
  rating: TapHit['rating'];
}

// Scrolling oscilloscope-style strip: metronome clicks (as heard) and taps
// drift right-to-left; the horizontal gap between paired spikes IS the timing
// error. Draws from refs via requestAnimationFrame — no React state per frame.
const TimingGraph: React.FC<{
  beatsRef: React.MutableRefObject<TimelineBeat[]>;
  tapsRef: React.MutableRefObject<TimelineTap[]>;
}> = ({ beatsRef, tapsRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    // Fixed palette, independent of the app theme — this canvas is a
    // "stage" surface (like the Sound Physics waveforms) that stays dark
    // regardless of light/dark mode, so its colors can't be sourced from
    // the live --primary/--warning/etc theme tokens (those shift to darker,
    // low-contrast values in light mode, which would read fine as page text
    // but muddy against this canvas's own always-dark background).
    const colors = {
      beat: 'var(--primary)',
      tap: '#FF6A2A',
      perfect: '#46C08A',
      good: 'var(--primary)',
      imprecise: '#E5C463',
      miss: '#FF4D5E',
      grid: 'rgba(255,255,255,0.07)',
      text: '#8b93a7'
    };

    const WINDOW_S = 4; // seconds of history shown
    let rafId = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const now = audio.getCurrentTime();
      const pxPerSec = w / WINDOW_S;
      const xFor = (t: number) => w - (now - t) * pxPerSec;
      const baseline = h - 16;

      // Prune events that scrolled out of view
      beatsRef.current = beatsRef.current.filter(b => b.time > now - WINDOW_S - 0.5);
      tapsRef.current = tapsRef.current.filter(t => t.time > now - WINDOW_S - 0.5);

      // Faint gridline each second
      g.strokeStyle = colors.grid;
      g.lineWidth = 1;
      for (let t = Math.floor(now); t > now - WINDOW_S; t--) {
        const x = xFor(t);
        g.beginPath();
        g.moveTo(x, 6);
        g.lineTo(x, baseline);
        g.stroke();
      }
      // Baseline
      g.beginPath();
      g.moveTo(0, baseline);
      g.lineTo(w, baseline);
      g.stroke();

      // Metronome spikes at their HEARD time (only once actually audible)
      for (const b of beatsRef.current) {
        if (b.time > now) continue;
        const x = xFor(b.time);
        g.strokeStyle = colors.beat;
        g.lineWidth = b.accented ? 3 : 2;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(x, baseline);
        g.lineTo(x, b.accented ? 10 : 24);
        g.stroke();
      }
      g.globalAlpha = 1;

      // Tap spikes + dashed connector to their matched beat + ms label
      for (const t of tapsRef.current) {
        const x = xFor(t.time);
        g.strokeStyle = colors.tap;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(x, baseline);
        g.lineTo(x, 38);
        g.stroke();

        const mx = xFor(t.matchedTime);
        g.strokeStyle = colors[t.rating];
        g.lineWidth = 1;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(mx, 38);
        g.lineTo(x, 38);
        g.stroke();
        g.setLineDash([]);

        g.fillStyle = colors[t.rating];
        g.font = "10px 'JetBrains Mono', monospace";
        g.textAlign = 'center';
        const label = `${t.differenceMs > 0 ? '+' : ''}${t.differenceMs}ms`;
        g.fillText(label, (x + mx) / 2, 34);
      }

      // Live latency readout (what the grader is compensating for)
      g.fillStyle = colors.text;
      g.font = "9px 'JetBrains Mono', monospace";
      g.textAlign = 'left';
      g.fillText(`output latency: ${Math.round(audio.getOutputLatency() * 1000)}ms`, 6, h - 4);
      g.textAlign = 'right';
      g.fillText('now', w - 12, 12);
      // Small drawn triangle marking the "now" line — sharper at any zoom
      // level than relying on the ▶ glyph in a 9px monospace font.
      g.beginPath();
      g.moveTo(w - 8, 8);
      g.lineTo(w - 8, 16);
      g.lineTo(w - 2, 12);
      g.closePath();
      g.fill();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [beatsRef, tapsRef]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '110px',
          display: 'block',
          background: '#0E0F11',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '8px'
        }}
      />
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)', justifyContent: 'center' }}>
        <span><span style={{ color: 'var(--primary)' }}>▌</span> Metronome (as heard)</span>
        <span><span style={{ color: 'var(--warning)' }}>▌</span> Your taps</span>
        <span>gap = your timing error</span>
      </div>
    </div>
  );
};

const BPM_MIN = 40;
const BPM_MAX = 220;

/**
 * How often the ladder takes a rung.
 *
 * Eight bars is about twenty seconds at a hundred — long enough to have
 * actually settled into a tempo rather than survived it, short enough that a
 * ten-minute practice climbs somewhere.
 */
const RAMP_BARS = 8;

const SUBDIVISIONS: { value: number; label: string; title: string }[] = [
  { value: 1, label: '1', title: 'Quarters — one click to the beat' },
  { value: 2, label: '2', title: 'Eighths — the down-up of a strumming hand' },
  { value: 3, label: '3', title: 'Triplets — three to the beat' },
  { value: 4, label: '4', title: 'Sixteenths' }
];

const RAMPS: { value: number; label: string; title: string }[] = [
  { value: 0, label: 'Off', title: 'Hold the tempo where it is' },
  { value: 2, label: '+2', title: `Two beats a minute faster every ${RAMP_BARS} bars` },
  { value: 5, label: '+5', title: `Five beats a minute faster every ${RAMP_BARS} bars` }
];

/**
 * Where the click has been, as a shape rather than a list.
 *
 * Oldest on the left, because that is the direction time reads in. Each run
 * is a column up to the tempo it finished at, and the part of it above where
 * the run *started* is in the accent — so a session that climbed shows the
 * climb, and a page full of flat grey columns is telling you something true
 * about the week.
 *
 * The scale starts a little under the slowest run rather than at zero: the
 * question is never "is 96 more than nothing", it is "is tonight faster than
 * Tuesday", and a bar chart anchored at zero answers the wrong one.
 */
const TempoHistory: React.FC<{ runs: TempoRun[]; onPick: (run: TempoRun) => void }> = ({ runs, onPick }) => {
  const all = runs.flatMap(run => [run.from, run.to]);
  // Both ends of the plot are labelled, so both ends have to be numbers the
  // plot actually reaches — a top label sitting above the tallest bar is a
  // chart telling a small lie about itself.
  const hi = Math.ceil(Math.max(...all) / 4) * 4;
  const lo = Math.max(0, Math.floor((Math.min(...all) - 8) / 4) * 4);
  const at = (bpm: number) => ((bpm - lo) / (hi - lo)) * 100;

  return (
    <div className="tempohist">
      <div className="tempohist-scale readout" aria-hidden="true">
        <span>{hi}</span>
        <span>{lo}</span>
      </div>
      <div className="tempohist-plot">
        {[...runs].reverse().map(run => {
          const top = at(run.to);
          const climb = Math.max(0, top - at(run.from));
          return (
            <button
              key={run.at}
              type="button"
              className="tempohist-col"
              onClick={() => onPick(run)}
              title={`${run.from === run.to ? `${run.to} bpm` : `${run.from} up to ${run.to} bpm`} in ${run.beatsPerBar}/4 · ${heldLabel(run.seconds)} · ${whenHeld(run.at)} — press to go back to it`}
            >
              <span className="tempohist-bar" style={{ height: `${top}%` }}>
                {climb > 0 && <span className="tempohist-climb" style={{ height: `${(climb / top) * 100}%` }} />}
              </span>
              <span className="tempohist-num readout">{run.to}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const getTempoLabel = (bpmVal: number): string => {
  if (bpmVal < 60) return 'Largo (Very Slow)';
  if (bpmVal < 76) return 'Adagio (Slow)';
  if (bpmVal < 108) return 'Andante (Walking)';
  if (bpmVal < 120) return 'Moderato (Moderate)';
  if (bpmVal < 156) return 'Allegro (Fast)';
  return 'Presto (Very Fast)';
};

export const RhythmLab: React.FC = () => {
  const [bpm, setBpm] = useState<number>(100);
  const [timeSignature, setTimeSignature] = useState<number>(4); // beats per bar
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Clicks to a beat. The pulse is always the beat; this is the texture under
  // it, which is what a strumming hand is actually counting.
  const [subdivision, setSubdivision] = useState<number>(1);
  // Beats per minute added every RAMP_BARS bars, or 0 to stay put.
  const [ramp, setRamp] = useState<number>(0);
  // Bars heard so far this run — not bars scheduled, which is up to 120ms ahead.
  const [bars, setBars] = useState<number>(0);
  const [tempoLog, setTempoLog] = useState<TempoRun[]>(() => getTempoLog());
  
  // Rhythm game states
  const [isGameMode, setIsGameMode] = useState<boolean>(false);
  const [tapHistory, setTapHistory] = useState<TapHit[]>([]);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ text: string; color: string; offset: number } | null>(null);

  // Metronome Scheduler Refs
  const isPlayingRef = useRef<boolean>(false);
  const bpmRef = useRef<number>(100);
  const timeSignatureRef = useRef<number>(4);
  const subdivisionRef = useRef<number>(1);
  const rampRef = useRef<number>(0);
  const schedulerTimerId = useRef<number | null>(null);

  // What the current run is, for the log it leaves behind when it stops.
  const runFrom = useRef<number>(100);
  const runStarted = useRef<number>(0);
  
  const nextBeatTime = useRef<number>(0.0);    // precise audio clock time of next beat
  const beatIndex = useRef<number>(0);         // current beat counter within the measure
  const scheduledBeats = useRef<{ index: number; audioTime: number; expired: boolean }[]>([]);

  // Live timing-graph event logs (drawn by TimingGraph, pruned there too)
  const timelineBeats = useRef<TimelineBeat[]>([]);
  const timelineTaps = useRef<TimelineTap[]>([]);

  // Update refs when state changes so the background scheduler timer sees them instantly
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    timeSignatureRef.current = timeSignature;
  }, [timeSignature]);

  useEffect(() => {
    subdivisionRef.current = subdivision;
  }, [subdivision]);

  useEffect(() => {
    rampRef.current = ramp;
  }, [ramp]);

  // Metronome scheduler tick (runs every 25ms in JS loop)
  const scheduleNextBeats = () => {
    if (!isPlayingRef.current) return;

    const ctxTime = audio.getCurrentTime();
    const scheduleAheadTime = 0.12; // schedule 120ms ahead
    const outputLatency = audio.getOutputLatency();

    while (nextBeatTime.current < ctxTime + scheduleAheadTime) {
      const beatsPerBar = timeSignatureRef.current;
      const beatNum = beatIndex.current % beatsPerBar;
      const isAccented = beatNum === 0;

      // The ladder takes its rung on the bar line, which is where a change of
      // tempo belongs — arriving mid-bar it reads as the click slipping.
      if (isAccented && beatIndex.current > 0 && rampRef.current > 0) {
        const bar = beatIndex.current / beatsPerBar;
        if (bar % RAMP_BARS === 0) {
          const faster = Math.min(BPM_MAX, bpmRef.current + rampRef.current);
          if (faster !== bpmRef.current) {
            bpmRef.current = faster;
            setBpm(faster);
          }
        }
      }

      // Read after the ramp, so the bar it changes on is already the new tempo.
      const secondsPerBeat = 60.0 / bpmRef.current;

      // 1. Play synthesized woodblock tick at the exact audio time
      audio.playClick(nextBeatTime.current, isAccented);

      // The ticks between this beat and the next. Audio only: they are a
      // texture to play against, not events to be graded, and putting them in
      // the candidate list would let a tap land halfway between two beats and
      // be told it was perfect.
      const sub = subdivisionRef.current;
      for (let s = 1; s < sub; s++) {
        audio.playClick(nextBeatTime.current + (s * secondsPerBeat) / sub, false, true);
      }

      // 2. Keep record of the scheduled beat for the tapping match logic
      scheduledBeats.current.push({
        index: beatIndex.current,
        audioTime: nextBeatTime.current,
        expired: false
      });

      // Log for the timing graph at the moment the click will be HEARD
      timelineBeats.current.push({
        time: nextBeatTime.current + outputLatency,
        accented: isAccented
      });

      // Advance clock
      nextBeatTime.current += secondsPerBeat;
      beatIndex.current++;
    }

    // Prune beats older than 2 seconds — long past any grading window
    scheduledBeats.current = scheduledBeats.current.filter(b => b.audioTime > ctxTime - 2);
  };

  /**
   * Where the beat is now, continuously, in the time the click is heard.
   *
   * `nextBeatTime` is the first beat not yet scheduled and `beatIndex` is its
   * number, so counting back from the pair gives a position that is exact at
   * the instant of every tick and smooth in between. Latency is added because
   * the drawing has to agree with the ear, not with the scheduler: the click
   * written at T is heard at T plus the output latency, and a pendulum that
   * hit its stop before you heard the tick would be the one thing on this page
   * teaching the wrong lesson.
   *
   * Stable, so the drawing's animation frame is never torn down and rebuilt
   * by a re-render of this screen.
   */
  const beatAt = useCallback((): number | null => {
    if (!isPlayingRef.current) return null;
    const secondsPerBeat = 60 / bpmRef.current;
    const heardNext = nextBeatTime.current + audio.getOutputLatency();
    return beatIndex.current - (heardNext - audio.getCurrentTime()) / secondsPerBeat;
  }, []);

  const startMetronome = () => {
    audio.init();
    setIsPlaying(true);
    
    // Clear scheduled tracking
    scheduledBeats.current = [];
    timelineBeats.current = [];
    timelineTaps.current = [];
    nextBeatTime.current = audio.getCurrentTime() + 0.05;
    beatIndex.current = 0;
    setBars(0);
    runFrom.current = bpmRef.current;
    runStarted.current = Date.now();

    // Run scheduler loop every 25 milliseconds
    schedulerTimerId.current = window.setInterval(scheduleNextBeats, 25);
  };

  const stopMetronome = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (schedulerTimerId.current !== null) {
      clearInterval(schedulerTimerId.current);
      schedulerTimerId.current = null;
    }
    if (runStarted.current > 0) {
      setTempoLog(logTempo({
        from: runFrom.current,
        to: bpmRef.current,
        beatsPerBar: timeSignatureRef.current,
        seconds: (Date.now() - runStarted.current) / 1000
      }));
      runStarted.current = 0;
    }
    setBars(0);
  };

  // Toggle Metronome on click
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  // Rhythm Game: Tapping mechanics
  const handleTap = () => {
    if (!isPlaying) {
      // Auto-start metronome if tapped while idle in game mode
      startMetronome();
      setTapHistory([]);
      setFeedback({ text: 'Session Started! Tap along...', color: 'var(--primary)', offset: 0 });
      return;
    }

    const tapAudioTime = audio.getCurrentTime();

    // Latency compensation: a click scheduled at audio time T is physically
    // HEARD at T + outputLatency. The player taps in sync with what they hear,
    // so shift the tap back by that latency before comparing to schedule times.
    const outputLatency = audio.getOutputLatency();
    const perceivedTapTime = tapAudioTime - outputLatency;

    // Candidate beats: everything scheduled recently, PLUS the predicted next
    // beat. The next beat only gets scheduled ~120ms ahead of time, so without
    // it an early tap would be graded against the PREVIOUS beat as a huge miss.
    const candidateTimes = scheduledBeats.current.map(b => b.audioTime);
    candidateTimes.push(nextBeatTime.current);

    let closestTime: number | null = null;
    let minDifference = Infinity;
    for (const beatTime of candidateTimes) {
      const diff = Math.abs(perceivedTapTime - beatTime);
      if (diff < minDifference) {
        minDifference = diff;
        closestTime = beatTime;
      }
    }

    if (closestTime === null) return;

    // Calculate timing difference in milliseconds
    const difference = perceivedTapTime - closestTime;
    const differenceMs = Math.round(difference * 1000);
    const absDiff = Math.abs(differenceMs);

    // Grade accuracy
    let rating: TapHit['rating'] = 'miss';
    let text = 'MISS';
    let color = 'var(--danger)';

    if (absDiff <= 45) {
      rating = 'perfect';
      text = 'PERFECT!';
      color = 'var(--success)';
      reportProgress('rhythm-perfect-tap');
    } else if (absDiff <= 90) {
      rating = 'good';
      text = 'GOOD';
      color = 'var(--primary)';
    } else if (absDiff <= 160) {
      rating = 'imprecise';
      text = differenceMs > 0 ? 'LATE' : 'EARLY';
      color = 'var(--warning)';
    }

    // Set real-time overlay feedback
    setFeedback({
      text: `${text} (${differenceMs > 0 ? '+' : ''}${differenceMs}ms)`,
      color,
      offset: differenceMs
    });

    // Log for the timing graph: raw press time vs the heard time of its beat
    timelineTaps.current.push({
      time: tapAudioTime,
      matchedTime: closestTime + outputLatency,
      differenceMs,
      rating
    });

    const newHit: TapHit = {
      id: Date.now(),
      expectedTime: closestTime,
      actualTime: perceivedTapTime,
      differenceMs,
      rating
    };

    setTapHistory((prev) => {
      const updated = [newHit, ...prev].slice(0, 20); // Keep last 20 hits

      // Calculate average accuracy score (misses count as 0)
      const sumScore = updated.reduce((acc, h) => {
        if (h.rating === 'perfect') return acc + 100;
        if (h.rating === 'good') return acc + 75;
        if (h.rating === 'imprecise') return acc + 40;
        return acc; // miss
      }, 0);
      setOverallAccuracy(Math.round(sumScore / updated.length));
      return updated;
    });
  };

  // Keyboard support: Spacebar taps the beat
  // The bar is the app's now, not this page's. In the game it is the thing you
  // tap with, which is still "what this screen does when you press Space".
  usePlayKey(() => { if (isGameMode) handleTap(); else handleTogglePlay(); });

  // Clean up timers on unmount — and leave the log behind, because walking
  // off to the chord page is a way of stopping the metronome too and a run
  // that only counted when you pressed the button would quietly lose half of
  // them.
  useEffect(() => {
    return () => {
      if (schedulerTimerId.current) {
        clearInterval(schedulerTimerId.current);
      }
      if (runStarted.current > 0) {
        logTempo({
          from: runFrom.current,
          to: bpmRef.current,
          beatsPerBar: timeSignatureRef.current,
          seconds: (Date.now() - runStarted.current) / 1000
        });
        runStarted.current = 0;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="rhythm" />Rhythm &amp; Timing</h2>
      </div>

      <div className="grid-2">
        
        {/* Metronome */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Metronome</span>
            <span className="readout" style={{ color: 'var(--primary)', fontWeight: 600 }}>{bpm} BPM</span>
          </h3>

          {/* Tempo Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setBpm(prev => Math.max(BPM_MIN, prev - 5))} 
                className="btn" 
                style={{ padding: '0.5rem 1rem' }}
              >
                -5
              </button>
              <input
                type="range"
                min={BPM_MIN}
                max={BPM_MAX}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <button 
                onClick={() => setBpm(prev => Math.min(BPM_MAX, prev + 5))} 
                className="btn" 
                style={{ padding: '0.5rem 1rem' }}
              >
                +5
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="field-label" htmlFor="time-signature">Time Signature</label>
              <select
                id="time-signature"
                value={timeSignature}
                onChange={(e) => setTimeSignature(Number(e.target.value))}
                className="select-field"
              >
                <option value={2}>2/4 (Duple)</option>
                <option value={3}>3/4 (Triple / Waltz)</option>
                <option value={4}>4/4 (Common Time)</option>
                <option value={6}>6/8 (Compound)</option>
              </select>
            </div>

            <Segmented<number>
              label="Clicks per beat"
              value={subdivision}
              onChange={setSubdivision}
              options={SUBDIVISIONS}
              size="sm"
              full
            />
          </div>

          <Segmented
            label="Mode"
            value={isGameMode}
            onChange={(v) => { setIsGameMode(v); stopMetronome(); }}
            tone={isGameMode ? 'secondary' : 'primary'}
            options={[
              { value: false, label: 'Solo' },
              { value: true, label: 'Game' }
            ]}
            full
          />

          {/* The one thing on this page that knows the tempo. */}
          <Pendulum beatsPerBar={timeSignature} subdivision={subdivision} at={beatAt} onBar={setBars} />

          <button
            onClick={handleTogglePlay}
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            style={{ width: '100%', padding: '1rem 0', fontSize: '1.05rem', justifyContent: 'center' }}
          >
            {isPlaying ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Stop Metronome
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start Metronome
              </>
            )}
          </button>
        </section>

        {/* Tapping Game Console */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <h3 style={{ fontSize: '1.15rem', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            {isGameMode ? 'Tap Accuracy' : 'Practice'}
          </h3>

          {!isGameMode ? (
            <div className="rhythm-practice">
              <p className="rhythm-lead">
                Play along until your note and the tick stop being two sounds.
              </p>

              {/* "Clean twice in a row? Add 5 BPM" was one of the four notes
                  under this heading, which made it the player's job to watch
                  the bar count and remember. It is a thing a metronome can do. */}
              <Segmented<number>
                label={`Speed up · every ${RAMP_BARS} bars`}
                value={ramp}
                onChange={setRamp}
                options={RAMPS}
                size="sm"
                full
              />

              {/* Something that changes while it runs, on a page where nothing did. */}
              {isPlaying ? (
                <p className="rhythm-live readout">
                  <span>bar {bars + 1}</span>
                  <span className="rhythm-live-bpm">{bpm} bpm</span>
                  {ramp > 0 && bpm > runFrom.current && (
                    <span className="rhythm-live-climb">up {bpm - runFrom.current} from {runFrom.current}</span>
                  )}
                </p>
              ) : (
                <p className="rhythm-live is-off readout">not running</p>
              )}

              <div className="rhythm-tips">
                {[
                  'Start slower than feels necessary.',
                  'Beat 1 is the higher click. Lost it \u2014 restart, don\u2019t catch up.',
                  'When it\u2019s easy, count two bars without the click.'
                ].map(line => (
                  <div key={line} className="rhythm-tip">
                    <span className="rhythm-dot" aria-hidden="true" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              {/* Not a record and not a claim — this page has no ear. It is
                  the answer to "what was I at last night?", which is the
                  question you actually have when you sit down. */}
              <div className="rhythm-been">
                <div className="surface-label">
                  <span>Where the click has been</span>
                  {tempoLog.length > 0 && (
                    <button type="button" className="rhythm-forget" onClick={() => setTempoLog(clearTempoLog())}>
                      Forget
                    </button>
                  )}
                </div>
                {tempoLog.length === 0 ? (
                  <p className="rhythm-none">
                    Run it for a quarter of a minute and it starts remembering where you were.
                  </p>
                ) : (
                  <TempoHistory
                    runs={tempoLog}
                    onPick={run => { setBpm(run.to); setTimeSignature(run.beatsPerBar); }}
                  />
                )}
              </div>

              <p className="rhythm-key">
                <kbd className="key-hint">Space</kbd> starts and stops.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, gap: '1rem' }}>
              
              {/* Score / Accuracy Banner */}
              <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '0.75rem 1rem', borderRadius: '8px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Session Accuracy:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: overallAccuracy > 80 ? 'var(--success)' : 'var(--primary)' }}>
                  {overallAccuracy}%
                </span>
              </div>

              {/* Interactive Game Pace Control Row */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', padding: '0.75rem 1rem', borderRadius: '8px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Game Pace:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button 
                    onClick={() => setBpm(prev => Math.max(BPM_MIN, prev - 10))} 
                    className="btn" 
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    title="Slower (-10 BPM)"
                  >
                    Slower
                  </button>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                    {bpm} BPM ({getTempoLabel(bpm)})
                  </strong>
                  <button 
                    onClick={() => setBpm(prev => Math.min(BPM_MAX, prev + 10))} 
                    className="btn" 
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    title="Faster (+10 BPM)"
                  >
                    Faster
                  </button>
                </div>
              </div>

              {/* Tap Target Zone */}
              <div
                onPointerDown={handleTap}
                style={{
                  height: '100px',
                  background: 'var(--surface-2)',
                  border: '2px dashed rgba(var(--surface-tint-rgb),0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background 0.15s ease'
                }}
                className="pulse-hover"
              >
                {/* Floating score text feedback */}
                {feedback ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: feedback.color }}>
                      {feedback.text}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Press SPACEBAR or CLICK this area on the beat
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Click here (or press Space) to start Tapping!
                  </div>
                )}
              </div>

              {/* Live latency timeline graph */}
              <TimingGraph beatsRef={timelineBeats} tapsRef={timelineTaps} />

              {/* Hit History Scrolling track */}
              <div>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Timing Log (Recent hits)</h4>
                
                {tapHistory.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No taps recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '110px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {tapHistory.map((hit) => {
                      const color = hit.rating === 'perfect' ? 'var(--success)' :
                                    hit.rating === 'good' ? 'var(--primary)' :
                                    hit.rating === 'imprecise' ? 'var(--warning)' : 'var(--danger)';

                      return (
                        <div 
                          key={hit.id} 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--surface-2)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            borderLeft: `3px solid ${color}`
                          }}
                        >
                          <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem', color }}>{hit.rating}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            {hit.differenceMs > 0 ? `+${hit.differenceMs}` : hit.differenceMs}ms
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </section>

      </div>
    </div>
  );
};
export default RhythmLab;
