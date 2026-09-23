import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Segmented } from '../components/Segmented';
import { LabIcon } from '../components/LabIcon';
import { TunerDial } from '../components/TunerDial';
import { IconCheck } from '../components/Icons';
import { useMicPitch } from '../hooks/useMicPitch';
import { useSpringValue } from '../hooks/useSpringValue';
import { audio } from '../utils/audio';
import { noteNameToMidi } from '../utils/musicTheory';
import { HOLD_MS, IN_TUNE_CENTS, TUNINGS, nearestString, stringsOf } from '../utils/tuning';
import { reportProgress } from '../utils/progress';

const TUNING_KEY = 'cadenza-tuning';

export const TunerLab: React.FC = () => {
  // Shared microphone + YIN pitch detection pipeline
  const {
    pitch: pitchData,
    isActive: isMicrophoneActive,
    error: micError,
    start: initMicrophone,
    stop: stopMicrophone
  } = useMicPitch();

  // The gauge runs on a sprung value rather than the raw estimate. Pitch
  // detection re-reads every audio frame and its output jitters by a few cents
  // even on a perfectly steady note, so the needle used to teleport and read as
  // noise. The spring low-passes that away and settles like a real meter.
  //
  // Only the gauge is smoothed. The matching game below still judges the raw
  // estimate, so what it accepts is not softened by a display decision.
  // ---- tuning up, as a thing with a finish line -------------------------
  // Six strings, ticked off as each one is held in tune. The app's own
  // counters all report a level; this one reports a job you can finish, which
  // is the only shape "tune up" has ever had.
  const [tuned, setTuned] = useState<Record<number, boolean>>({});
  const settling = useRef<{ string: number; since: number } | null>(null);

  // Which tuning the guitar is in. Kept across visits, because somebody who
  // plays in DADGAD plays in DADGAD, and re-picking it every time you sit
  // down is the app forgetting something it was told.
  const [tuningId, setTuningId] = useState<string>(() => {
    try { return localStorage.getItem(TUNING_KEY) ?? TUNINGS[0].id; } catch { return TUNINGS[0].id; }
  });
  const tuning = TUNINGS.find(t => t.id === tuningId) ?? TUNINGS[0];
  const targets = useMemo(() => stringsOf(tuning), [tuning]);
  const pickTuning = (id: string) => {
    setTuningId(id);
    setTuned({});
    settling.current = null;
    try { localStorage.setItem(TUNING_KEY, id); } catch { /* a blocked store is not worth failing over */ }
  };

  // Which string this is, and how far off *it* — not off the nearest note in
  // the chromatic scale. See utils/tuning.ts: the two answers disagree exactly
  // when a string is worst out, which is the moment a tuner has to be useful.
  const onString = pitchData ? nearestString(pitchData.frequency, targets) : null;
  const readCents = pitchData ? (onString ? onString.cents : pitchData.cents) : null;
  const readNote = onString ? onString.target.name : pitchData?.note ?? null;

  const lastCentsRef = useRef<number>(0);
  if (readCents !== null) lastCentsRef.current = readCents;
  // Held rather than recentred through a silent frame, so a gap in detection
  // does not swing the needle to "in tune" and back.
  const springedCents = useSpringValue(readCents !== null ? readCents : lastCentsRef.current);
  const gaugeCents = Math.max(-50, Math.min(50, springedCents));
  const gaugeInTune = Math.abs(gaugeCents) <= IN_TUNE_CENTS;

  useEffect(() => {
    if (!isMicrophoneActive) return;
    // Judged on the raw estimate, not the sprung one: the needle is smoothed
    // because a display should be, and a tick is a claim.
    const here = pitchData ? nearestString(pitchData.frequency, targets) : null;
    if (!here || Math.abs(here.cents) > IN_TUNE_CENTS) {
      settling.current = null;
      return;
    }
    const now = Date.now();
    if (settling.current?.string !== here.target.number) {
      settling.current = { string: here.target.number, since: now };
      return;
    }
    if (now - settling.current.since >= HOLD_MS) {
      setTuned(done => (done[here.target.number] ? done : { ...done, [here.target.number]: true }));
    }
  }, [pitchData, isMicrophoneActive, targets]);

  // A fresh guitar each time the mic comes on: whatever was in tune last week
  // is a claim about a different afternoon.
  useEffect(() => {
    if (!isMicrophoneActive) { setTuned({}); settling.current = null; }
  }, [isMicrophoneActive]);

  const tunedCount = targets.filter(target => tuned[target.number]).length;

  // Pitch matching game states
  const [gameMode, setGameMode] = useState<boolean>(false);
  const [targetNote, setTargetNote] = useState<string>('A4');
  const [matchScore, setMatchScore] = useState<number>(0);
  const [matchStreak, setMatchStreak] = useState<number>(0);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100%

  const holdMsRef = useRef<number>(0); // milliseconds the target note has been held
  const lastTickRef = useRef<number>(0); // timestamp of the previous game tick
  const reportedPitchRef = useRef<boolean>(false); // journey event fired this session

  // Journey: the first time the tuner successfully hears a pitch
  useEffect(() => {
    if (pitchData && !reportedPitchRef.current) {
      reportedPitchRef.current = true;
      reportProgress('tuner-pitch-detected');
    }
  }, [pitchData]);

  // Possible target notes for the matching game (Standard range)
  const targetNotesList = ['E2', 'G2', 'A2', 'C3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4'];

  const selectRandomTargetNote = () => {
    const remaining = targetNotesList.filter(n => n !== targetNote);
    const randomNote = remaining[Math.floor(Math.random() * remaining.length)];
    setTargetNote(randomNote);
    setHoldProgress(0);
    holdMsRef.current = 0;
  };

  // Parse a note name like "C4" or "F#3" into its MIDI number
  const parseNoteToMidi = (name: string): number | null => {
    const match = name.match(/^([A-G]#?)([0-9])$/);
    if (!match) return null;
    return noteNameToMidi(match[1], Number(match[2]));
  };

  // Play reference sound for target note
  const playTargetReference = () => {
    audio.init();
    const midi = parseNoteToMidi(targetNote);
    if (midi === null) return;
    audio.playMidi(midi, 2.5);
  };

  // Game loop: check pitch matching logic
  useEffect(() => {
    if (!gameMode || !isMicrophoneActive) {
      setHoldProgress(0);
      holdMsRef.current = 0;
      lastTickRef.current = 0;
      return;
    }

    // Time-based hold, so progress speed doesn't depend on frame rate
    const now = performance.now();
    const elapsed = lastTickRef.current === 0 ? 16 : Math.min(100, now - lastTickRef.current);
    lastTickRef.current = now;

    const REQUIRED_HOLD_MS = 1200;
    const CENTS_TOLERANCE = 30; // realistic for fretted guitar notes and singing

    // Compare MIDI numbers (robust) instead of exact note-name strings
    const targetMidi = parseNoteToMidi(targetNote);
    const isMatch =
      pitchData !== null &&
      targetMidi !== null &&
      pitchData.midi === targetMidi &&
      Math.abs(pitchData.cents) <= CENTS_TOLERANCE;

    if (isMatch) {
      holdMsRef.current += elapsed;
      const percentage = Math.min(100, Math.round((holdMsRef.current / REQUIRED_HOLD_MS) * 100));
      setHoldProgress(percentage);

      if (holdMsRef.current >= REQUIRED_HOLD_MS) {
        // Match Successful!
        setMatchScore(prev => prev + 1);
        setMatchStreak(prev => prev + 1);
        reportProgress('tuner-note-matched');

        // Play success tone
        audio.init();
        audio.playMidi(72, 0.4); // C5 quick ping
        setTimeout(() => audio.playMidi(76, 0.6), 150); // E5

        // Advance to next target note
        selectRandomTargetNote();
      }
    } else {
      // Decay progress gently if they drift off key or go silent
      holdMsRef.current = Math.max(0, holdMsRef.current - elapsed);
      setHoldProgress(Math.round((holdMsRef.current / REQUIRED_HOLD_MS) * 100));
    }
  }, [pitchData, gameMode, targetNote, isMicrophoneActive]);

  useEffect(() => {
    if (gameMode) {
      selectRandomTargetNote();
      setMatchScore(0);
      setMatchStreak(0);
    } else {
      setHoldProgress(0);
      holdMsRef.current = 0;
    }
  }, [gameMode]);

  // (Mic teardown on unmount is handled inside useMicPitch)

  return (
    <div className="lab-narrow" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="tuner" />Pitch &amp; Tuner</h2>
      </div>

      <div className="grid-2">
        
        {/* The meter. Before permission it is here all the same, greyed and
            inert: the ask used to arrive before anything had said what the
            screen does, and "allow your microphone" is an easier yes when you
            can see what it is for. */}
        <section className={`glass-panel tunerface${isMicrophoneActive ? '' : ' is-off'}`}>
          <div className="tunerface-meter" aria-hidden={!isMicrophoneActive}>
            <div className="tuner-note">
              <span className={`tuner-note-name readout${pitchData ? (gaugeInTune ? ' is-home' : ' is-live') : ''}`}>
                {readNote ?? '—'}
              </span>
              <span className="tuner-note-hz readout">
                {pitchData ? `${pitchData.frequency.toFixed(1)} Hz` : isMicrophoneActive ? 'silent' : 'not listening'}
              </span>
            </div>

            <TunerDial cents={pitchData ? gaugeCents : null} inTune={Boolean(pitchData) && gaugeInTune} />

            <span className={`tuner-off readout${pitchData && gaugeInTune ? ' is-home' : ''}`}>
              {pitchData
                ? gaugeInTune
                  ? onString ? `${onString.target.ordinal} string is there` : 'in tune'
                  // The needle pins at the end of the dial; the words do not.
                  // "+50" under a needle that is actually reading +64 is the
                  // meter lying about its own limit.
                  : `${springedCents > 0 ? '+' : ''}${Math.round(springedCents)} cents${onString ? ` off ${onString.target.name}` : ''}`
                : 'play a string'}
            </span>
          </div>

          {isMicrophoneActive ? (
            <button onClick={stopMicrophone} className="btn tuner-stop">
              <span className="tuner-stop-dot" aria-hidden="true" />
              Stop listening
            </button>
          ) : (
            <div className="micbar">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span className="micbar-said">The needle moves once the tuner can hear you.</span>
              <button onClick={initMicrophone} className="btn btn-primary">Turn on the mic</button>
            </div>
          )}
          {micError && <p className="micbar-error">{micError}</p>}
        </section>

        {/* Intonation Game Console */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <h3 style={{ fontSize: '1.15rem', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{gameMode ? 'Pitch Matching' : 'Tuning'}</span>
            <Segmented
              value={gameMode}
              onChange={setGameMode}
              tone={gameMode ? 'secondary' : 'primary'}
              size="sm"
              options={[
                { value: false, label: 'Tuner' },
                { value: true, label: 'Practice Game' }
              ]}
            />
          </h3>

          {!gameMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>
                One string at a time. Tune <em>up</em> to the note — a string arriving from
                below holds better than one left slack.
              </p>

              {/* The reference you read while turning a peg — and, once the
                  tuner can hear, the thing that ticks off. Every other counter
                  in this app reports a level; tuning up is a job with an end,
                  so this one reports how much of it is left. */}
              <div className="strings">
                <div className="surface-label">
                  <span>{tuning.name}</span>
                  <span className="readout">
                    {isMicrophoneActive
                      ? tunedCount === targets.length ? 'all six' : `${tunedCount} of ${targets.length}`
                      : tuning.note}
                  </span>
                </div>
                <div className="strings-row">
                  {targets.map(target => {
                    const here = isMicrophoneActive && onString?.target.number === target.number;
                    const done = tuned[target.number];
                    return (
                      <button
                        type="button"
                        key={target.number}
                        className={`stringcard${here ? ' is-here' : ''}${done ? ' is-done' : ''}`}
                        title={`${target.ordinal} string · ${target.hz.toFixed(1)} Hz · press to hear it`}
                        onClick={() => { audio.init(); audio.playMidi(target.midi, 2.5); }}
                      >
                        <span className="stringcard-ord">{target.ordinal}</span>
                        <span className="stringcard-note">{target.name}</span>
                        <span className="stringcard-hz readout">
                          {here && pitchData
                            ? `${onString.cents > 0 ? '+' : ''}${Math.round(onString.cents)}c`
                            : `${target.hz.toFixed(1)} Hz`}
                        </span>
                        {done && <span className="stringcard-tick" aria-label="in tune"><IconCheck size={11} /></span>}
                      </button>
                    );
                  })}
                </div>
                {isMicrophoneActive && tunedCount > 0 && (
                  <button type="button" className="strings-again" onClick={() => setTuned({})}>
                    Start again
                  </button>
                )}
                <p className="strings-hint">Press a string to hear it — the other way to tune, and the one that trains an ear.</p>
                <Segmented<string>
                  label="Tuning"
                  value={tuningId}
                  onChange={pickTuning}
                  options={TUNINGS.map(t => ({ value: t.id, label: t.name, title: t.note }))}
                  size="sm"
                  full
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem', justifyContent: 'center' }}>
              
              {/* Target Note Display Box */}
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'var(--surface-2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                <div style={{ height: '10px', background: 'var(--surface-3)', borderRadius: '5px', overflow: 'hidden' }}>
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
                  Sing or play {targetNote} (within ±30 cents) for 1.2 seconds to progress
                </span>
              </div>

              {/* Accuracy Stats */}
              <div style={{ display: 'flex', justifyItems: 'space-between', gap: '1rem', paddingTop: '0.75rem', fontSize: '0.85rem', justifyContent: 'space-between' }}>
                <span>Matched Notes: <strong style={{ color: 'var(--primary)' }}>{matchScore}</strong></span>
                <span style={{ color: 'var(--warning)' }}>Streak <strong>{matchStreak}</strong></span>
              </div>

            </div>
          )}
        </section>

      </div>
    </div>
  );
};
export default TunerLab;
