import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../utils/audio';
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
      beat: '#00f0ff',
      tap: '#f59e0b',
      perfect: '#10b981',
      good: '#00f0ff',
      imprecise: '#f59e0b',
      miss: '#ef4444',
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
        g.font = '10px monospace';
        g.textAlign = 'center';
        const label = `${t.differenceMs > 0 ? '+' : ''}${t.differenceMs}ms`;
        g.fillText(label, (x + mx) / 2, 34);
      }

      // Live latency readout (what the grader is compensating for)
      g.fillStyle = colors.text;
      g.font = '9px monospace';
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
          background: '#0f1219',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '10px'
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
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  
  // Rhythm game states
  const [isGameMode, setIsGameMode] = useState<boolean>(false);
  const [tapHistory, setTapHistory] = useState<TapHit[]>([]);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ text: string; color: string; offset: number } | null>(null);

  // Metronome Scheduler Refs
  const isPlayingRef = useRef<boolean>(false);
  const bpmRef = useRef<number>(100);
  const timeSignatureRef = useRef<number>(4);
  const schedulerTimerId = useRef<number | null>(null);
  
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

  // Metronome scheduler tick (runs every 25ms in JS loop)
  const scheduleNextBeats = () => {
    if (!isPlayingRef.current) return;

    const ctxTime = audio.getCurrentTime();
    const scheduleAheadTime = 0.12; // schedule 120ms ahead
    const secondsPerBeat = 60.0 / bpmRef.current;
    const outputLatency = audio.getOutputLatency();

    while (nextBeatTime.current < ctxTime + scheduleAheadTime) {
      const beatNum = beatIndex.current % timeSignatureRef.current;
      const isAccented = beatNum === 0;

      // 1. Play synthesized woodblock tick at the exact audio time
      audio.playClick(nextBeatTime.current, isAccented);

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

      // Sync active beat visualization with the UI
      const currentScheduledTime = nextBeatTime.current;
      const scheduleIndex = beatNum;
      
      const timeToVisual = (currentScheduledTime - ctxTime) * 1000;
      setTimeout(() => {
        if (isPlayingRef.current) {
          setCurrentBeat(scheduleIndex);
        }
      }, Math.max(0, timeToVisual));

      // Advance clock
      nextBeatTime.current += secondsPerBeat;
      beatIndex.current++;
    }

    // Prune beats older than 2 seconds — long past any grading window
    scheduledBeats.current = scheduledBeats.current.filter(b => b.audioTime > ctxTime - 2);
  };

  const startMetronome = () => {
    audio.init();
    setIsPlaying(true);
    
    // Clear scheduled tracking
    scheduledBeats.current = [];
    timelineBeats.current = [];
    timelineTaps.current = [];
    nextBeatTime.current = audio.getCurrentTime() + 0.05;
    beatIndex.current = 0;
    setCurrentBeat(0);

    // Run scheduler loop every 25 milliseconds
    schedulerTimerId.current = window.setInterval(scheduleNextBeats, 25);
  };

  const stopMetronome = () => {
    setIsPlaying(false);
    if (schedulerTimerId.current !== null) {
      clearInterval(schedulerTimerId.current);
      schedulerTimerId.current = null;
    }
    setCurrentBeat(0);
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
        if (e.repeat) return; // Ignore OS key-repeat while holding the bar
        if (isGameMode) {
          handleTap();
        } else {
          handleTogglePlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isGameMode]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (schedulerTimerId.current) {
        clearInterval(schedulerTimerId.current);
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title">Rhythm & Timing Lab</h2>
        <p className="lab-description">Master your internal clock. Practice holding steady tempos and measure your tapping timing deviation in real-time.</p>
      </div>

      <div className="grid-2">
        
        {/* Metronome Console */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(var(--surface-tint-rgb),0.08)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Metronome Console</span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{bpm} BPM</span>
          </h3>

          {/* Tempo Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setBpm(prev => Math.max(40, prev - 5))} 
                className="btn" 
                style={{ padding: '0.5rem 1rem' }}
              >
                -5
              </button>
              <input
                type="range"
                min="40"
                max="220"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <button 
                onClick={() => setBpm(prev => Math.min(220, prev + 5))} 
                className="btn" 
                style={{ padding: '0.5rem 1rem' }}
              >
                +5
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Time Signature</label>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(Number(e.target.value))}
                className="input-field"
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value={2}>2/4 (Duple)</option>
                <option value={3}>3/4 (Triple / Waltz)</option>
                <option value={4}>4/4 (Common Time)</option>
                <option value={6}>6/8 (Compound)</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Mode</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={() => { setIsGameMode(false); stopMetronome(); }}
                  className={`btn ${!isGameMode ? 'btn-primary' : ''}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  Solo
                </button>
                <button
                  onClick={() => { setIsGameMode(true); stopMetronome(); }}
                  className={`btn ${isGameMode ? 'btn-secondary' : ''}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  Game
                </button>
              </div>
            </div>
          </div>

          {/* Visual Beat Indicator Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1rem 0' }}>
            {Array.from({ length: timeSignature }).map((_, idx) => {
              const isActive = currentBeat === idx && isPlaying;
              const isFirstBeat = idx === 0;

              return (
                <div
                  key={idx}
                  style={{
                    width: isFirstBeat ? '24px' : '20px',
                    height: isFirstBeat ? '24px' : '20px',
                    borderRadius: '50%',
                    background: isActive 
                      ? (isFirstBeat ? 'var(--success)' : 'var(--primary)') 
                      : 'rgba(var(--surface-tint-rgb), 0.05)',
                    border: '1px solid',
                    borderColor: isActive
                      ? (isFirstBeat ? 'var(--success)' : 'var(--primary)')
                      : 'rgba(var(--surface-tint-rgb), 0.1)',
                    boxShadow: isActive
                      ? (isFirstBeat ? '0 0 15px var(--success-glow)' : '0 0 15px var(--primary-glow)')
                      : 'none',
                    transition: 'all 0.05s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: isActive ? 'var(--text-on-primary)' : 'var(--text-muted)'
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

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
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(var(--surface-tint-rgb),0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            {isGameMode ? 'Tapping Accuracy Game' : 'Metronome Guide'}
          </h3>

          {!isGameMode ? (
            <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p>Practice timing independently with the metronome ticks.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tip: Press <kbd className="key-hint">Spacebar</kbd> to toggle the metronome on/off.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, gap: '1rem' }}>
              
              {/* Score / Accuracy Banner */}
              <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'center', background: 'rgba(var(--surface-tint-rgb),0.02)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(var(--surface-tint-rgb),0.04)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Session Accuracy:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: overallAccuracy > 80 ? 'var(--success)' : 'var(--primary)' }}>
                  {overallAccuracy}%
                </span>
              </div>

              {/* Interactive Game Pace Control Row */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(var(--surface-tint-rgb),0.02)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(var(--surface-tint-rgb),0.04)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Game Pace:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button 
                    onClick={() => setBpm(prev => Math.max(40, prev - 10))} 
                    className="btn" 
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    title="Slower (-10 BPM)"
                  >
                    Slower
                  </button>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                    {bpm} BPM ({getTempoLabel(bpm)})
                  </strong>
                  <button 
                    onClick={() => setBpm(prev => Math.min(220, prev + 10))} 
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
                  background: 'rgba(var(--surface-tint-rgb),0.01)',
                  border: '2px dashed rgba(var(--surface-tint-rgb),0.1)',
                  borderRadius: '12px',
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
                            background: 'rgba(var(--surface-tint-rgb),0.02)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            borderLeft: `3px solid ${color}`
                          }}
                        >
                          <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem', color }}>{hit.rating}</span>
                          <span style={{ fontFamily: 'monospace' }}>
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
