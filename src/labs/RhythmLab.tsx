import React, { useState, useEffect, useRef } from 'react';
import { audio } from '../utils/audio';

interface TapHit {
  id: number;
  expectedTime: number;
  actualTime: number;
  differenceMs: number; // actual - expected
  rating: 'perfect' | 'good' | 'imprecise' | 'miss';
}

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

      // Keep array size reasonable (prune old beats older than 2 seconds)
      if (scheduledBeats.current.length > 30) {
        scheduledBeats.current.shift();
      }

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
  };

  const startMetronome = () => {
    audio.init();
    setIsPlaying(true);
    
    // Clear scheduled tracking
    scheduledBeats.current = [];
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
    
    // Find the closest scheduled beat in our window (+/- 1 beat width)
    let closestBeat: typeof scheduledBeats.current[0] | null = null;
    let minDifference = Infinity;

    // Search active beats in the queue
    scheduledBeats.current.forEach((beat) => {
      const diff = Math.abs(tapAudioTime - beat.audioTime);
      if (diff < minDifference) {
        minDifference = diff;
        closestBeat = beat;
      }
    });

    if (!closestBeat) return;

    // Calculate timing difference in milliseconds
    const difference = tapAudioTime - (closestBeat as any).audioTime;
    const differenceMs = Math.round(difference * 1000);
    const absDiff = Math.abs(differenceMs);

    // Grade accuracy
    let rating: TapHit['rating'] = 'miss';
    let text = 'MISS';
    let color = 'var(--danger)';

    if (absDiff <= 30) {
      rating = 'perfect';
      text = 'PERFECT!';
      color = 'var(--success)';
    } else if (absDiff <= 65) {
      rating = 'good';
      text = 'GOOD';
      color = 'var(--primary)';
    } else if (absDiff <= 140) {
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

    const newHit: TapHit = {
      id: Date.now(),
      expectedTime: (closestBeat as any).audioTime,
      actualTime: tapAudioTime,
      differenceMs,
      rating
    };

    setTapHistory((prev) => {
      const updated = [newHit, ...prev].slice(0, 20); // Keep last 20 hits
      
      // Calculate average accuracy score
      const ratedHits = updated.filter(h => h.rating !== 'miss');
      if (ratedHits.length > 0) {
        const sumScore = ratedHits.reduce((acc, h) => {
          if (h.rating === 'perfect') return acc + 100;
          if (h.rating === 'good') return acc + 75;
          return acc + 40; // imprecise
        }, 0);
        setOverallAccuracy(Math.round(sumScore / ratedHits.length));
      }
      return updated;
    });
  };

  // Keyboard support: Spacebar taps the beat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
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
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
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
                style={{ width: '100%', background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '6px', color: '#fff', outline: 'none' }}
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
                      : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid',
                    borderColor: isActive
                      ? (isFirstBeat ? 'var(--success)' : 'var(--primary)')
                      : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isActive
                      ? (isFirstBeat ? '0 0 15px var(--success-glow)' : '0 0 15px var(--primary-glow)')
                      : 'none',
                    transition: 'all 0.05s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: isActive ? '#030406' : 'var(--text-muted)'
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
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            {isGameMode ? 'Tapping Accuracy Game' : 'Metronome Guide'}
          </h3>

          {!isGameMode ? (
            <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p>Practice timing independently with the metronome ticks.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tip: Press <kbd style={{ padding: '2px 6px', background: '#2d3748', borderRadius: '4px', fontStyle: 'normal' }}>Spacebar</kbd> to toggle the metronome on/off.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, gap: '1rem' }}>
              
              {/* Score / Accuracy Banner */}
              <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Session Accuracy:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: overallAccuracy > 80 ? 'var(--success)' : 'var(--primary)' }}>
                  {overallAccuracy}%
                </span>
              </div>

              {/* Tap Target Zone */}
              <div 
                onClick={handleTap}
                style={{
                  height: '100px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '2px dashed rgba(255,255,255,0.1)',
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
                                    hit.rating === 'good' ? 'var(--primary)' : 'var(--warning)';

                      return (
                        <div 
                          key={hit.id} 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)',
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
