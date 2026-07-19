import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMicPitch } from '../hooks/useMicPitch';
import { Fretboard } from '../components/Fretboard';
import { audio } from '../utils/audio';
import {
  NOTE_NAMES,
  INTERVALS,
  CHORD_QUALITIES,
  SCALE_FORMULAS
} from '../utils/musicTheory';
import { SCALE_FEELINGS, CHORD_FEELINGS } from '../utils/glossary';

// ---- Challenge tuning constants ----
const CONFIRM_MS = 350;  // how long the correct note must be held to count
const SLIP_MS = 550;     // how long a stable wrong note counts as a real miss
const CENTS_TOL = 45;    // generous — this game grades WHICH note, not intonation

const NOTE_POINTS = 10;
const ROUND_BONUS = 20;

const BEST_KEY = 'play-challenges-best-v1';

type Mode = 'scale' | 'interval' | 'chord';

interface Round {
  targets: number[];       // pitch classes (0-11) to play, in order
  chipLabels: string[];    // label under each step chip (note name or degree)
  promptTitle: string;
  promptDetail: string;
  contextPcs: number[];    // pitch classes shown green on the fretboard
  referenceMidis: number[]; // played by the "hear it" button (sequential)
  rewardMidis: number[];    // played together when the round is complete
  rootMidi: number;         // reference root (interval mode plays this)
}

interface Feedback {
  type: 'ok' | 'slip' | 'info';
  text: string;
}

const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// All guitar-range midis (open E2 .. fret 12 of high E) with a given pitch class
const midisForPcs = (pcs: number[]): number[] => {
  const out: number[] = [];
  for (let m = 40; m <= 76; m++) {
    if (pcs.includes(m % 12)) out.push(m);
  }
  return out;
};

// Map a pitch class to a comfortable guitar-register midi (E2..D#3)
const pcToLowMidi = (pc: number): number => 40 + ((pc - 4 + 12) % 12);

// Intervals a beginner should meet first (semitone counts)
const COMMON_INTERVAL_SEMITONES = [2, 3, 4, 5, 7, 12];

const ordinal = (n: number): string => ['Root', '3rd', '5th', '7th'][n] ?? `${n + 1}th`;

export const PlayLab: React.FC = () => {
  const { pitch, isActive, error: micError, start, stop } = useMicPitch();

  const [mode, setMode] = useState<Mode>('scale');
  const [round, setRound] = useState<Round | null>(null);
  const [progressIdx, setProgressIdx] = useState<number>(0);
  const [phase, setPhase] = useState<'playing' | 'complete'>('playing');
  const [holdPct, setHoldPct] = useState<number>(0);
  const [feedback, setFeedback] = useState<Feedback>({ type: 'info', text: 'Play the first highlighted note to begin.' });
  const [revealed, setRevealed] = useState<boolean>(false);
  const [showTargets, setShowTargets] = useState<boolean>(true);

  // Session score/streak + persisted best streak per mode
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [best, setBest] = useState<Record<Mode, number>>(() => {
    try {
      return { scale: 0, interval: 0, chord: 0, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') };
    } catch {
      return { scale: 0, interval: 0, chord: 0 };
    }
  });

  // Mode settings
  const [scaleRootPc, setScaleRootPc] = useState<number | 'random'>(0); // C
  const [scaleIdx, setScaleIdx] = useState<number>(0); // Major
  const [chordSevenths, setChordSevenths] = useState<boolean>(false);
  const [trickyIntervals, setTrickyIntervals] = useState<boolean>(false);

  // Matching engine refs (per-frame accumulators, no re-render churn)
  const holdMsRef = useRef<number>(0);
  const wrongMsRef = useRef<number>(0);
  const wrongPcRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const armedRef = useRef<boolean>(true);
  const eventPcRef = useRef<number | null>(null);
  const nextRoundTimer = useRef<number | null>(null);
  // While the app itself is playing sound, ignore the mic — otherwise speaker
  // bleed from reference/reward notes could self-confirm the challenge
  const muteUntilRef = useRef<number>(0);

  const makeRound = useCallback((): Round => {
    if (mode === 'scale') {
      const rootPc = scaleRootPc === 'random' ? Math.floor(Math.random() * 12) : scaleRootPc;
      const scale = SCALE_FORMULAS[scaleIdx];
      const targets = scale.steps.map(s => (rootPc + s) % 12);
      const refMidis = scale.steps.map(s => pcToLowMidi(rootPc) + s);
      return {
        targets,
        chipLabels: targets.map(pc => NOTE_NAMES[pc]),
        promptTitle: `Climb the ${NOTE_NAMES[rootPc]} ${scale.name} scale`,
        promptDetail: `${SCALE_FEELINGS[scale.name]?.feeling ?? ''} — play each note in order, one at a time, in any octave. Amber on the fretboard = play this now.`,
        contextPcs: targets,
        referenceMidis: refMidis,
        rewardMidis: refMidis,
        rootMidi: pcToLowMidi(rootPc)
      };
    }

    if (mode === 'chord') {
      const pool = chordSevenths ? CHORD_QUALITIES : CHORD_QUALITIES.slice(0, 4);
      const quality = randomOf(pool);
      const rootPc = Math.floor(Math.random() * 12);
      const targets = quality.intervals.map(i => (rootPc + i) % 12);
      const refMidis = quality.intervals.map(i => pcToLowMidi(rootPc) + i);
      const feeling = CHORD_FEELINGS[quality.name] ?? quality.name;
      return {
        targets,
        chipLabels: targets.map((pc, i) => `${NOTE_NAMES[pc]} · ${ordinal(i)}`),
        promptTitle: `Build ${NOTE_NAMES[rootPc]} ${quality.name} (${feeling})`,
        promptDetail: `A chord is just its notes stacked up. Play them one at a time — root first, then upward. Any octave counts.`,
        contextPcs: targets,
        referenceMidis: refMidis,
        rewardMidis: refMidis,
        rootMidi: pcToLowMidi(rootPc)
      };
    }

    // Interval Hunt
    const pool = INTERVALS.filter(iv =>
      iv.semitones > 0 && (trickyIntervals || COMMON_INTERVAL_SEMITONES.includes(iv.semitones))
    );
    const interval = randomOf(pool);
    const rootMidi = 45 + Math.floor(Math.random() * 13); // A2..A3, comfy register
    const targetPc = (rootMidi + interval.semitones) % 12;
    const rootName = `${NOTE_NAMES[rootMidi % 12]}${Math.floor(rootMidi / 12) - 1}`;
    return {
      targets: [targetPc],
      chipLabels: ['?'],
      promptTitle: `Play a ${interval.name} above ${rootName}`,
      promptDetail: `That's ${interval.semitones} semitone${interval.semitones === 1 ? '' : 's'} (frets) up. Hint: it's the gap in “${interval.songClue}”. Any octave counts.`,
      contextPcs: [rootMidi % 12],
      referenceMidis: [rootMidi],
      rewardMidis: [rootMidi, rootMidi + interval.semitones],
      rootMidi
    };
  }, [mode, scaleRootPc, scaleIdx, chordSevenths, trickyIntervals]);

  const startNewRound = useCallback(() => {
    const r = makeRound();
    setRound(r);
    setProgressIdx(0);
    setPhase('playing');
    setHoldPct(0);
    setRevealed(false);
    holdMsRef.current = 0;
    wrongMsRef.current = 0;
    wrongPcRef.current = null;
    armedRef.current = true;
    eventPcRef.current = null;
    // Grace period covers the tail of the previous round's reward sound
    muteUntilRef.current = performance.now() + 800;
    setFeedback({
      type: 'info',
      text: mode === 'interval'
        ? 'Listen to the reference note, then hunt for the answer.'
        : `First up: ${NOTE_NAMES[r.targets[0]]}. Let it ring clearly.`
    });
    // Interval mode: play the reference note so the hunt starts by ear
    if (mode === 'interval') {
      muteUntilRef.current = performance.now() + 2800;
      window.setTimeout(() => {
        audio.init();
        audio.playMidi(r.rootMidi, 1.8);
      }, 500);
    }
  }, [makeRound, mode]);

  // New round whenever the mode or its settings change; reset session stats on mode switch
  useEffect(() => {
    setScore(0);
    setStreak(0);
  }, [mode]);

  useEffect(() => {
    if (isActive) startNewRound();
  }, [isActive, startNewRound]);

  // Persist best streak
  useEffect(() => {
    if (streak > best[mode]) {
      const updated = { ...best, [mode]: streak };
      setBest(updated);
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
    }
  }, [streak, mode, best]);

  // Clear any pending next-round timer on unmount / round churn
  useEffect(() => {
    return () => {
      if (nextRoundTimer.current !== null) window.clearTimeout(nextRoundTimer.current);
    };
  }, []);

  const completeRound = () => {
    setScore(s => s + ROUND_BONUS);
    setStreak(s => s + 1);
    setPhase('complete');
    setFeedback({ type: 'ok', text: 'Nailed it! Here is how it sounds together…' });

    // Reward: hear what you just built
    audio.init();
    const now = audio.getCurrentTime();
    if (mode === 'chord') {
      round?.rewardMidis.forEach(m => audio.playMidi(m, 2.0, now + 0.45));
    } else {
      round?.rewardMidis.forEach((m, i) => audio.playMidi(m, 0.9, now + 0.4 + i * 0.22));
    }

    const delay = 700 + (round ? round.rewardMidis.length * 220 : 0);
    nextRoundTimer.current = window.setTimeout(() => startNewRound(), delay);
  };

  // ---- The matching engine: runs once per detected-pitch frame ----
  useEffect(() => {
    if (!isActive || phase !== 'playing' || !round) {
      lastTickRef.current = 0;
      return;
    }

    const now = performance.now();
    const elapsed = lastTickRef.current === 0 ? 16 : Math.min(100, now - lastTickRef.current);
    lastTickRef.current = now;

    // App audio is (or was just) playing — don't grade speaker bleed
    if (now < muteUntilRef.current) return;

    const targetPc = round.targets[progressIdx];
    const heardPc = pitch ? ((pitch.midi % 12) + 12) % 12 : null;

    // After a confirm/slip the same sustained note must be released
    // (silence or a different note) before it can trigger again
    if (!armedRef.current) {
      if (heardPc === null || heardPc !== eventPcRef.current) {
        armedRef.current = true;
        wrongMsRef.current = 0;
        wrongPcRef.current = null;
      } else {
        return;
      }
    }

    const isMatch = pitch !== null && heardPc === targetPc && Math.abs(pitch.cents) <= CENTS_TOL;

    if (isMatch) {
      wrongMsRef.current = 0;
      wrongPcRef.current = null;
      holdMsRef.current += elapsed;
      setHoldPct(Math.min(100, Math.round((holdMsRef.current / CONFIRM_MS) * 100)));

      if (holdMsRef.current >= CONFIRM_MS) {
        holdMsRef.current = 0;
        setHoldPct(0);
        armedRef.current = false;
        eventPcRef.current = targetPc;
        setScore(s => s + NOTE_POINTS);

        audio.init();
        audio.playMidi(93, 0.18); // bright confirmation ping

        const nextIdx = progressIdx + 1;
        if (nextIdx >= round.targets.length) {
          completeRound();
        } else {
          setProgressIdx(nextIdx);
          setFeedback({
            type: 'ok',
            text: `${NOTE_NAMES[targetPc]} ✓ — next: ${NOTE_NAMES[round.targets[nextIdx]]}`
          });
        }
      }
    } else {
      // Decay hold progress when off-target or silent
      holdMsRef.current = Math.max(0, holdMsRef.current - elapsed);
      setHoldPct(Math.round((holdMsRef.current / CONFIRM_MS) * 100));

      // A *stable* wrong note (not a transition blip) counts as a miss
      if (heardPc !== null && heardPc !== targetPc) {
        if (wrongPcRef.current === heardPc) {
          wrongMsRef.current += elapsed;
        } else {
          wrongPcRef.current = heardPc;
          wrongMsRef.current = elapsed;
        }
        if (wrongMsRef.current >= SLIP_MS) {
          wrongMsRef.current = 0;
          armedRef.current = false;
          eventPcRef.current = heardPc;
          setStreak(0);
          setFeedback({
            type: 'slip',
            text: `Heard ${NOTE_NAMES[heardPc]} — the target is ${NOTE_NAMES[targetPc]}. Streak reset, keep going!`
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, isActive, phase, round, progressIdx]);

  const playReference = () => {
    if (!round) return;
    audio.init();
    const now = audio.getCurrentTime();
    round.referenceMidis.forEach((m, i) => audio.playMidi(m, 0.9, now + i * 0.3));
    muteUntilRef.current = performance.now() + round.referenceMidis.length * 300 + 1200;
  };

  const revealAnswer = () => {
    setRevealed(true);
    setStreak(0);
    if (round) {
      setFeedback({ type: 'info', text: `It's ${NOTE_NAMES[round.targets[progressIdx]]} — shown in amber below. Play it to continue.` });
    }
  };

  // ---- Fretboard highlight sets ----
  const targetsHidden = mode === 'interval' && !revealed;
  const currentTargetPc = round && phase === 'playing' ? round.targets[progressIdx] : null;
  const rootMidis = !targetsHidden && showTargets && currentTargetPc !== null ? midisForPcs([currentTargetPc]) : [];
  // Interval mode's contextPcs only contains the reference note, so it stays
  // visible even while the answer is hidden
  const contextMidis = round && showTargets ? midisForPcs(round.contextPcs) : [];
  // Live feedback: light up every position of the note we're currently hearing
  const heardMidis = pitch ? midisForPcs([((pitch.midi % 12) + 12) % 12]) : [];

  const feedbackColor =
    feedback.type === 'ok' ? 'var(--success)' :
    feedback.type === 'slip' ? 'var(--danger)' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title">Play Challenges</h2>
        <p className="lab-description">
          Theory you play, not memorize. The app listens through your microphone and verifies
          every note on your real instrument — guitar, piano, or your voice.
        </p>
      </div>

      {!isActive ? (
        <section className="glass-panel" style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </div>
          <h3 style={{ fontSize: '1.25rem' }}>Grab your instrument</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px' }}>
            These challenges are answered by <em>playing notes</em>, not clicking buttons.
            Allow microphone access, then play scales, intervals, and chords on whatever you have —
            the app confirms each note in real time.
          </p>
          <button onClick={start} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Allow Microphone & Start
          </button>
          {micError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{micError}</p>}
        </section>
      ) : (
        <>
          {/* Mode tabs + scoreboard */}
          <section className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {([
                ['scale', 'Scale Climb'],
                ['interval', 'Interval Hunt'],
                ['chord', 'Chord Builder']
              ] as [Mode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`btn ${mode === m ? 'btn-primary' : ''}`}
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontSize: '0.9rem' }}>
              <span>Score: <strong style={{ color: 'var(--primary)' }}>{score}</strong></span>
              <span style={{ color: 'var(--warning)' }}>Streak: <strong>🔥 {streak}</strong></span>
              <span style={{ color: 'var(--text-secondary)' }}>Best: <strong>{best[mode]}</strong></span>
              <button onClick={stop} className="btn" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%' }}></span>
                Stop Mic
              </button>
            </div>
          </section>

          <div className="grid-2">
            {/* Challenge prompt */}
            <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--secondary)' }}>{round?.promptTitle ?? '…'}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{round?.promptDetail}</p>

              {/* Step chips */}
              {round && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {round.chipLabels.map((label, i) => {
                    const done = i < progressIdx || phase === 'complete';
                    const current = i === progressIdx && phase === 'playing';
                    return (
                      <span
                        key={`${label}-${i}`}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: current ? 700 : 500,
                          border: `1px solid ${done ? 'var(--success)' : current ? 'var(--warning)' : 'rgba(255,255,255,0.1)'}`,
                          background: done ? 'rgba(16,185,129,0.12)' : current ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)',
                          color: done ? 'var(--success)' : current ? 'var(--warning)' : 'var(--text-muted)'
                        }}
                      >
                        {done ? '✓ ' : ''}{targetsHidden && !done ? '?' : label}
                      </span>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button onClick={playReference} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {mode === 'interval' ? 'Replay Reference Note' : 'Hear It First'}
                </button>
                {mode === 'interval' && !revealed && (
                  <button onClick={revealAnswer} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                    Reveal Answer (resets streak)
                  </button>
                )}
                <button onClick={startNewRound} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
                  Skip
                </button>
              </div>

              {/* Mode-specific settings */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {mode === 'scale' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Root:
                      <select
                        value={String(scaleRootPc)}
                        onChange={e => setScaleRootPc(e.target.value === 'random' ? 'random' : Number(e.target.value))}
                        style={{ background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem', borderRadius: '6px', color: '#fff' }}
                      >
                        {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
                        <option value="random">Surprise me</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Scale:
                      <select
                        value={scaleIdx}
                        onChange={e => setScaleIdx(Number(e.target.value))}
                        style={{ background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem', borderRadius: '6px', color: '#fff' }}
                      >
                        {SCALE_FORMULAS.map((s, i) => (
                          <option key={s.name} value={i}>{SCALE_FEELINGS[s.name]?.feeling ?? s.name} — {s.name}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {mode === 'chord' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={chordSevenths} onChange={e => setChordSevenths(e.target.checked)} />
                    Include 7th chords (4 notes)
                  </label>
                )}
                {mode === 'interval' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={trickyIntervals} onChange={e => setTrickyIntervals(e.target.checked)} />
                    Include tricky intervals (m2, tritone, 6ths, 7ths)
                  </label>
                )}
              </div>
            </section>

            {/* Live listening panel */}
            <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Hearing</span>
                <div style={{ fontSize: '3.2rem', fontWeight: 700, lineHeight: 1.1, color: pitch ? (currentTargetPc !== null && ((pitch.midi % 12) + 12) % 12 === currentTargetPc ? 'var(--success)' : 'var(--primary)') : 'var(--text-muted)' }}>
                  {pitch ? pitch.note : '--'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {pitch ? `${pitch.frequency.toFixed(1)} Hz · ${pitch.cents > 0 ? '+' : ''}${pitch.cents}c` : 'silent'}
                </div>
              </div>

              {/* Hold-to-confirm progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span>Hold to confirm</span>
                  <span>{holdPct}%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${holdPct}%`, height: '100%', background: 'var(--success)', boxShadow: '0 0 10px var(--success-glow)', transition: 'width 0.08s linear' }} />
                </div>
              </div>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: feedbackColor, minHeight: '2.4em', lineHeight: 1.4 }}>
                {feedback.text}
              </p>
            </section>
          </div>

          {/* Fretboard */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Guitar Fretboard Guide</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showTargets} onChange={e => setShowTargets(e.target.checked)} />
                Show targets (turn off for a harder ear workout)
              </label>
            </h3>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warning)', marginRight: '0.35rem', verticalAlign: 'middle' }} />Play this now</span>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)', marginRight: '0.35rem', verticalAlign: 'middle' }} />{mode === 'interval' ? 'Reference note' : 'All notes in this challenge'}</span>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', marginRight: '0.35rem', verticalAlign: 'middle' }} />What we're hearing from you</span>
            </div>
            <Fretboard
              activeMidis={heardMidis}
              highlightCorrectMidis={contextMidis}
              rootMidis={rootMidis}
              interactive={false}
            />
          </section>
        </>
      )}
    </div>
  );
};
export default PlayLab;
