import React, { useState, useEffect, useRef } from 'react';
import { detectPitch } from '../utils/pitch';
import type { PitchResult } from '../utils/pitch';
import { audio } from '../utils/audio';
import { noteNameToMidi } from '../utils/musicTheory';

export const TunerLab: React.FC = () => {
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [pitchData, setPitchData] = useState<PitchResult | null>(null);

  // Pitch matching game states
  const [gameMode, setGameMode] = useState<boolean>(false);
  const [targetNote, setTargetNote] = useState<string>('A4');
  const [matchScore, setMatchScore] = useState<number>(0);
  const [matchStreak, setMatchStreak] = useState<number>(0);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100%

  // Web Audio microphone stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const bufferRef = useRef<Float32Array | null>(null);
  const holdTimerRef = useRef<number>(0); // measures how long user held note

  // Possible target notes for the matching game (Standard range)
  const targetNotesList = ['E2', 'G2', 'A2', 'C3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4'];

  const initMicrophone = async () => {
    try {
      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      streamRef.current = stream;

      // 2. Initialize Web Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // 3. Connect nodes
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; // High FFT size for low frequency resolution
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      bufferRef.current = new Float32Array(bufferLength);

      setIsMicrophoneActive(true);
      startPitchDetectionLoop();
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      alert('Could not access microphone. Please check system permissions.');
    }
  };

  const stopMicrophone = () => {
    setIsMicrophoneActive(false);
    
    // Stop mic capture loop
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    // Release microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setPitchData(null);
    setHoldProgress(0);
    holdTimerRef.current = 0;
  };

  const startPitchDetectionLoop = () => {
    if (!analyserRef.current || !bufferRef.current || !audioContextRef.current) return;

    const analyser = analyserRef.current;
    const buffer = bufferRef.current;
    const sampleRate = audioContextRef.current.sampleRate;

    const updatePitch = () => {
      analyser.getFloatTimeDomainData(buffer as any);
      const result = detectPitch(buffer, sampleRate);
      
      setPitchData(result);
      animationFrameId.current = requestAnimationFrame(updatePitch);
    };

    animationFrameId.current = requestAnimationFrame(updatePitch);
  };

  const selectRandomTargetNote = () => {
    const remaining = targetNotesList.filter(n => n !== targetNote);
    const randomNote = remaining[Math.floor(Math.random() * remaining.length)];
    setTargetNote(randomNote);
    setHoldProgress(0);
    holdTimerRef.current = 0;
  };

  // Play reference sound for target note
  const playTargetReference = () => {
    audio.init();
    // Parse note and octave, e.g. "A4" -> "A", 4
    const match = targetNote.match(/^([A-G]#?)([0-9])$/);
    if (!match) return;
    
    const root = match[1];
    const octave = Number(match[2]);
    const midi = noteNameToMidi(root, octave);
    
    audio.playMidi(midi, 2.5);
  };

  // Game loop: check pitch matching logic
  useEffect(() => {
    if (!gameMode || !pitchData || !isMicrophoneActive) {
      setHoldProgress(0);
      holdTimerRef.current = 0;
      return;
    }

    // Standardize comparison format (strip octave for raw pitch name if needed, but here we do exact note matching)
    // Note names are e.g. "A4"
    const isNoteMatch = pitchData.note === targetNote;
    const isInTune = Math.abs(pitchData.cents) <= 8; // within 8 cents of accuracy

    if (isNoteMatch && isInTune) {
      holdTimerRef.current += 1; // Increment duration ticks (~60fps standard)
      
      const requiredTicks = 70; // ~1.1 seconds hold
      const percentage = Math.min(100, Math.round((holdTimerRef.current / requiredTicks) * 100));
      setHoldProgress(percentage);

      if (holdTimerRef.current >= requiredTicks) {
        // Match Successful!
        setMatchScore(prev => prev + 1);
        setMatchStreak(prev => prev + 1);
        
        // Play success tone
        audio.init();
        audio.playMidi(72, 0.4); // C5 quick ping
        setTimeout(() => audio.playMidi(76, 0.6), 150); // E5

        // Advance to next target note
        selectRandomTargetNote();
      }
    } else {
      // Decay progress if they drift off key
      holdTimerRef.current = Math.max(0, holdTimerRef.current - 2);
      setHoldProgress(Math.round((holdTimerRef.current / 70) * 100));
    }
  }, [pitchData, gameMode, targetNote, isMicrophoneActive]);

  useEffect(() => {
    if (gameMode) {
      selectRandomTargetNote();
      setMatchScore(0);
      setMatchStreak(0);
    } else {
      setHoldProgress(0);
      holdTimerRef.current = 0;
    }
  }, [gameMode]);

  // Clean up animation frames and audio contexts on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title">Singing & Pitch Trainer</h2>
        <p className="lab-description">Test your pitch precision. Tune your instruments, practice vocal intonation, and play interactive pitch-matching games.</p>
      </div>

      <div className="grid-2">
        
        {/* Tuner Gauge Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', minHeight: '340px', justifyContent: 'center' }}>
          
          {!isMicrophoneActive ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Microphone Access Required</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '300px' }}>To use the real-time tuner and singing matching game, please activate your microphone input.</p>
              <button onClick={initMicrophone} className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
                Allow Microphone Access
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              
              {/* Dynamic Note Display */}
              <div style={{ textAlign: 'center' }}>
                <div 
                  style={{
                    fontSize: '4.5rem',
                    fontWeight: 700,
                    color: pitchData ? (Math.abs(pitchData.cents) <= 5 ? 'var(--success)' : 'var(--primary)') : 'var(--text-muted)',
                    textShadow: pitchData && Math.abs(pitchData.cents) <= 5 ? '0 0 30px var(--success-glow)' : 'none',
                    lineHeight: 1.1,
                    transition: 'color 0.15s ease'
                  }}
                >
                  {pitchData ? pitchData.note : '--'}
                </div>
                <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                  {pitchData ? `${pitchData.frequency.toFixed(1)} Hz` : 'Silent'}
                </div>
              </div>

              {/* Slider Scale Meter */}
              <div style={{ width: '100%', maxWidth: '360px', position: 'relative', marginTop: '1rem' }}>
                {/* Horizontal scale */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', width: '100%' }}></div>
                
                {/* Center / In-Tune tick */}
                <div style={{ position: 'absolute', left: '50%', top: '-8px', width: '2px', height: '20px', background: 'var(--success)', transform: 'translateX(-50%)' }} />
                
                {/* 50 cents left/right limits */}
                <div style={{ position: 'absolute', left: '0', top: '-4px', width: '1px', height: '12px', background: 'var(--text-muted)' }} />
                <div style={{ position: 'absolute', right: '0', top: '-4px', width: '1px', height: '12px', background: 'var(--text-muted)' }} />

                {/* Floating Needle Indicator */}
                {pitchData && (
                  <div
                    style={{
                      position: 'absolute',
                      // map cents (-50 to +50) to percentage (0% to 100%)
                      left: `${((pitchData.cents + 50) / 100) * 100}%`,
                      top: '-14px',
                      width: '4px',
                      height: '32px',
                      background: Math.abs(pitchData.cents) <= 5 ? 'var(--success)' : 'var(--primary)',
                      boxShadow: Math.abs(pitchData.cents) <= 5 ? '0 0 10px var(--success-glow)' : '0 0 8px var(--primary-glow)',
                      borderRadius: '2px',
                      transform: 'translateX(-50%)',
                      transition: 'left 0.08s linear, background-color 0.1s ease'
                    }}
                  />
                )}

                {/* Left/Right flat/sharp Labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
                  <span>FLAT (-50c)</span>
                  <span style={{ color: pitchData && Math.abs(pitchData.cents) <= 5 ? 'var(--success)' : 'var(--text-muted)', fontWeight: pitchData && Math.abs(pitchData.cents) <= 5 ? 'bold' : 'normal' }}>
                    {pitchData ? (pitchData.cents === 0 ? 'IN TUNE' : `${pitchData.cents > 0 ? '+' : ''}${pitchData.cents} cents`) : '0.0 cents'}
                  </span>
                  <span>SHARP (+50c)</span>
                </div>
              </div>

              {/* Stop capture button */}
              <button onClick={stopMicrophone} className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%' }}></span>
                Disconnect Microphone
              </button>

            </div>
          )}

        </section>

        {/* Intonation Game Console */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Pitch Matching Game</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                onClick={() => setGameMode(false)}
                className={`btn ${!gameMode ? 'btn-primary' : ''}`}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Tuner
              </button>
              <button
                onClick={() => setGameMode(true)}
                className={`btn ${gameMode ? 'btn-secondary' : ''}`}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Practice Game
              </button>
            </div>
          </h3>

          {!gameMode ? (
            <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p>Practice tuning your guitar strings or singing clean scales.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Guitar strings: E2 (82.4 Hz), A2 (110.0 Hz), D3 (146.8 Hz), G3 (196.0 Hz), B3 (246.9 Hz), E4 (329.6 Hz).</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem', justifyContent: 'center' }}>
              
              {/* Target Note Display Box */}
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TARGET NOTE</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{targetNote}</span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <button onClick={playTargetReference} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Play Reference Pitch
                  </button>
                  <button onClick={selectRandomTargetNote} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    Skip Note
                  </button>
                </div>
              </div>

              {/* Hold Progress Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Pitch Intonation Accuracy:</span>
                  <span style={{ fontWeight: 'bold' }}>{holdProgress}%</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${holdProgress}%`, 
                      height: '100%', 
                      background: 'var(--success)', 
                      boxShadow: '0 0 10px var(--success-glow)', 
                      transition: 'width 0.1s ease' 
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Sing or play standard {targetNote} in tune for 1.2 seconds to progress
                </span>
              </div>

              {/* Accuracy Stats */}
              <div style={{ display: 'flex', justifyItems: 'space-between', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', fontSize: '0.85rem', justifyContent: 'space-between' }}>
                <span>Matched Notes: <strong style={{ color: 'var(--primary)' }}>{matchScore}</strong></span>
                <span style={{ color: 'var(--warning)' }}>Streak: <strong>🔥 {matchStreak}</strong></span>
              </div>

            </div>
          )}
        </section>

      </div>
    </div>
  );
};
export default TunerLab;
