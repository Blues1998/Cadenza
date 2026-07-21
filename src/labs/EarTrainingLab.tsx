import React, { useState, useEffect } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { audio } from '../utils/audio';
import { reportProgress } from '../utils/progress';
import {
  INTERVALS,
  CHORD_QUALITIES,
  midiToNoteName
} from '../utils/musicTheory';
import type {
  IntervalInfo,
  ChordQualityInfo
} from '../utils/musicTheory';
import { useTabIntervalSource } from '../hooks/useTabIntervalSource';
import type { TabIntervalCandidate } from '../utils/tabIntervalSource';

type QuizMode = 'intervals' | 'chords';
type Difficulty = 'super-beginner' | 'easy' | 'medium' | 'hard';
type PlaybackStyle = 'melodic' | 'harmonic';
type SourceMode = 'random' | 'tab';

export const EarTrainingLab: React.FC = () => {
  const [quizMode, setQuizMode] = useState<QuizMode>('intervals');
  const [difficulty, setDifficulty] = useState<Difficulty>('super-beginner');
  const [playbackStyle, setPlaybackStyle] = useState<PlaybackStyle>('melodic');
  const [sourceMode, setSourceMode] = useState<SourceMode>('random');
  const tabSource = useTabIntervalSource();
  const [currentCandidate, setCurrentCandidate] = useState<TabIntervalCandidate | null>(null);

  // Game States
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);

  // Question details
  const [currentRoot, setCurrentRoot] = useState<number>(60); // Default C4
  const [correctInterval, setCorrectInterval] = useState<IntervalInfo | null>(null);
  const [correctChord, setCorrectChord] = useState<ChordQualityInfo | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [correctMidis, setCorrectMidis] = useState<number[]>([]);

  // Configure options based on difficulty and mode
  const getPossibleIntervals = (): IntervalInfo[] => {
    switch (difficulty) {
      case 'super-beginner':
        // Very basic leaps: Unison, Perfect 5th (Star Wars), Octave
        return INTERVALS.filter(i => [0, 7, 12].includes(i.semitones));
      case 'easy':
        return INTERVALS.filter(i => [0, 4, 7, 12].includes(i.semitones)); // Unison, Maj3, P5, Octave
      case 'medium':
        return INTERVALS.filter(i => [0, 2, 3, 4, 5, 7, 9, 11, 12].includes(i.semitones)); // Basic intervals
      case 'hard':
      default:
        return INTERVALS; // All chromatic intervals
    }
  };

  const getPossibleChords = (): ChordQualityInfo[] => {
    switch (difficulty) {
      case 'super-beginner':
      case 'easy':
        return CHORD_QUALITIES.filter(c => ['Major Triad', 'Minor Triad'].includes(c.name));
      case 'medium':
        return CHORD_QUALITIES.filter(c => ['Major Triad', 'Minor Triad', 'Diminished Triad', 'Augmented Triad'].includes(c.name));
      case 'hard':
      default:
        return CHORD_QUALITIES; // Triads + 7ths
    }
  };

  // Generate a new question
  const generateQuestion = () => {
    audio.init();
    setIsAnswered(false);
    setUserAnswer(null);
    setCorrectMidis([]);
    setCurrentCandidate(null);

    if (sourceMode === 'tab') {
      const possible = getPossibleIntervals();
      const allowedSemitones = new Set(possible.map(i => i.semitones));
      // Prefer jumps matching the current difficulty; fall back to whatever
      // this piece actually has rather than showing nothing.
      const matchingCandidates = tabSource.candidates.filter(c => allowedSemitones.has(Math.abs(c.toMidi - c.fromMidi)));
      const pool = matchingCandidates.length > 0 ? matchingCandidates : tabSource.candidates;
      if (pool.length === 0) return;

      const candidate = pool[Math.floor(Math.random() * pool.length)];
      setCurrentCandidate(candidate);

      const semitones = Math.abs(candidate.toMidi - candidate.fromMidi);
      const matchedInterval = INTERVALS.find(i => i.semitones === semitones) ?? INTERVALS[0];
      setCorrectInterval(matchedInterval);
      setCorrectChord(null);

      const lo = Math.min(candidate.fromMidi, candidate.toMidi);
      const hi = Math.max(candidate.fromMidi, candidate.toMidi);
      setCurrentRoot(lo);
      setCorrectMidis([lo, hi]);

      const distOptions = new Set<string>([matchedInterval.name]);
      while (distOptions.size < Math.min(4, possible.length)) {
        distOptions.add(possible[Math.floor(Math.random() * possible.length)].name);
      }
      setOptions(Array.from(distOptions).sort(() => Math.random() - 0.5));
      return;
    }

    // Random root between C3 (48) and C5 (72)
    const rootMidi = Math.floor(Math.random() * 24) + 48;
    setCurrentRoot(rootMidi);

    if (quizMode === 'intervals') {
      const possible = getPossibleIntervals();
      const randInterval = possible[Math.floor(Math.random() * possible.length)];
      setCorrectInterval(randInterval);
      setCorrectChord(null);

      // Determine correct MIDI targets
      setCorrectMidis([rootMidi, rootMidi + randInterval.semitones]);

      // Choose distractor answers
      const distOptions = new Set<string>([randInterval.name]);
      while (distOptions.size < Math.min(4, possible.length)) {
        const randOpt = possible[Math.floor(Math.random() * possible.length)].name;
        distOptions.add(randOpt);
      }
      
      // Shuffle options
      setOptions(Array.from(distOptions).sort(() => Math.random() - 0.5));
    } else {
      // Chords mode
      const possible = getPossibleChords();
      const randChord = possible[Math.floor(Math.random() * possible.length)];
      setCorrectChord(randChord);
      setCorrectInterval(null);

      // Determine correct MIDI targets
      setCorrectMidis(randChord.intervals.map(offset => rootMidi + offset));

      // Choose distractor answers
      const distOptions = new Set<string>([randChord.name]);
      while (distOptions.size < Math.min(4, possible.length)) {
        const randOpt = possible[Math.floor(Math.random() * possible.length)].name;
        distOptions.add(randOpt);
      }
      
      // Shuffle options
      setOptions(Array.from(distOptions).sort(() => Math.random() - 0.5));
    }
  };

  // Trigger sound playback for the current question
  const playSound = () => {
    if (sourceMode === 'tab') {
      if (currentCandidate) tabSource.playCandidate(currentCandidate);
      return;
    }
    if (correctMidis.length === 0) return;
    audio.init();

    const now = audio.getCurrentTime();

    if (quizMode === 'intervals') {
      if (playbackStyle === 'melodic') {
        // Melodic play: Play root, then play interval note
        audio.playMidi(correctMidis[0], 1.5, now);
        audio.playMidi(correctMidis[1], 1.5, now + 0.6); // delayed by 600ms
      } else {
        // Harmonic play
        audio.playChord(correctMidis, 2.0, now);
      }
    } else {
      // Chord Playback
      if (playbackStyle === 'melodic') {
        // Arpeggiate (strum string by string ascending)
        correctMidis.forEach((midi, idx) => {
          audio.playMidi(midi, 2.0, now + idx * 0.25); // strum effect
        });
      } else {
        // Play together (harmonic)
        audio.playChord(correctMidis, 2.5, now);
      }
    }
  };

  // Play reference sound from cheat sheet list
  const playCheatSheetInterval = (semitones: number) => {
    audio.init();
    const now = audio.getCurrentTime();
    const referenceRoot = 60; // C4 Middle C
    audio.playMidi(referenceRoot, 1.2, now);
    audio.playMidi(referenceRoot + semitones, 1.2, now + 0.55);
  };

  // Translates complex terms to beginner-friendly labels
  const getDisplayOptionName = (opt: string) => {
    if (quizMode === 'chords') {
      switch (opt) {
        case 'Major Triad':
          return 'Happy (Major)';
        case 'Minor Triad':
          return 'Sad (Minor)';
        case 'Diminished Triad':
          return 'Mysterious (Diminished)';
        case 'Augmented Triad':
          return 'Tense (Augmented)';
        case 'Major 7th':
          return 'Dreamy (Major 7th)';
        case 'Minor 7th':
          return 'Mellow (Minor 7th)';
        case 'Dominant 7th':
          return 'Bluesy (Dominant 7th)';
        case 'Half-Diminished 7th':
          return 'Complex (Half-Dim)';
        case 'Diminished 7th':
          return 'Suspenseful (Dim 7th)';
        default:
          return opt;
      }
    }
    return opt;
  };

  // Handle choice submission
  const handleAnswerSubmit = (option: string) => {
    if (isAnswered) return;
    
    setUserAnswer(option);
    setIsAnswered(true);
    setTotalQuestions(prev => prev + 1);

    const isCorrect = quizMode === 'intervals' 
      ? correctInterval?.name === option
      : correctChord?.name === option;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      reportProgress(quizMode === 'intervals' ? 'ear-interval-correct' : 'ear-chord-correct');
    } else {
      setStreak(0);
    }

    // Play sound of correct answer again so they reinforce the auditory memory
    playSound();
  };

  const handleStartQuiz = () => {
    setScore(0);
    setTotalQuestions(0);
    setStreak(0);
    setHasStarted(true);
    generateQuestion();
  };

  // Watch for quiz criteria changes and update quiz question automatically
  useEffect(() => {
    if (hasStarted) {
      generateQuestion();
    }
  }, [quizMode, difficulty, playbackStyle, sourceMode, tabSource.candidates]);

  // Autoplay new question sound when ready
  useEffect(() => {
    if (hasStarted && correctMidis.length > 0 && !isAnswered) {
      const timer = setTimeout(() => {
        playSound();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [correctMidis]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="lab-header">
        <h2 className="lab-title">Ear Training Lab</h2>
        <p className="lab-description">Improve your relative pitch and chord recognition skills. Practice identifying intervals and chord qualities by ear.</p>
      </div>

      <div className="grid-2">
        
        {/* Settings Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>Quiz Settings</h3>

          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Question Source</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setSourceMode('random')}
                className={`btn ${sourceMode === 'random' ? 'btn-primary' : ''}`}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
              >
                Random Tones
              </button>
              <button
                onClick={() => { setSourceMode('tab'); setQuizMode('intervals'); }}
                className={`btn ${sourceMode === 'tab' ? 'btn-primary' : ''}`}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
              >
                From My Tabs
              </button>
            </div>
          </div>

          {sourceMode === 'tab' && (
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Practice From</span>
              {tabSource.libraryEntries.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  No tabs saved yet. Import one in the Tab Player lab, then come back here to practice with it.
                </p>
              ) : (
                <select
                  value={tabSource.selectedTab?.id ?? ''}
                  onChange={(e) => {
                    const entry = tabSource.libraryEntries.find(t => t.id === e.target.value);
                    if (entry) tabSource.selectTab(entry);
                  }}
                  style={{ width: '100%', background: '#0b0c10', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0.6rem', borderRadius: '6px', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
                >
                  <option value="" disabled>Choose a piece…</option>
                  {tabSource.libraryEntries.map(entry => (
                    <option key={entry.id} value={entry.id}>{entry.title || entry.fileName}</option>
                  ))}
                </select>
              )}
              {tabSource.isLoading && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Loading…</p>
              )}
              {tabSource.error && (
                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.4rem' }}>{tabSource.error}</p>
              )}
              {tabSource.selectedTab && !tabSource.isLoading && !tabSource.error && tabSource.candidates.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  This piece doesn't have clear single-note melodic jumps to quiz on — try a different piece.
                </p>
              )}
            </div>
          )}

          {sourceMode === 'random' && (
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Quiz Type</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setQuizMode('intervals')}
                  className={`btn ${quizMode === 'intervals' ? 'btn-primary' : ''}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  Intervals
                </button>
                <button
                  onClick={() => setQuizMode('chords')}
                  className={`btn ${quizMode === 'chords' ? 'btn-primary' : ''}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  Chord Qualities
                </button>
              </div>
            </div>
          )}

          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Difficulty Level</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(['super-beginner', 'easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`btn ${difficulty === level ? 'btn-secondary' : ''}`}
                  style={{ flex: '1 1 45%', padding: '0.4rem', fontSize: '0.8rem', textTransform: 'none' }}
                >
                  {level === 'super-beginner' ? 'Super Beginner' : level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {sourceMode === 'random' && (
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Playback Style</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPlaybackStyle('melodic')}
                  className={`btn ${playbackStyle === 'melodic' ? 'btn-primary' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                >
                  Melodic (Stepwise)
                </button>
                <button
                  onClick={() => setPlaybackStyle('harmonic')}
                  className={`btn ${playbackStyle === 'harmonic' ? 'btn-primary' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                >
                  Harmonic (Together)
                </button>
              </div>
            </div>
          )}

          {hasStarted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Accuracy:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {totalQuestions > 0 ? `${Math.round((score / totalQuestions) * 100)}%` : '0%'} 
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.8rem' }}> ({score}/{totalQuestions})</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Streak:</span>
                <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>🔥 {streak}</span>
              </div>
            </div>
          )}
        </section>

        {/* Quiz Arena Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '320px', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
          {!hasStarted ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Ready to train your ears?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
                {sourceMode === 'tab'
                  ? 'Listen to a real jump pulled straight from the piece you picked, then name the interval.'
                  : <>Listen to interval gaps or chord qualities, then make your selection. Defaulting to <strong>Super Beginner</strong> mode for basic song association practice!</>}
              </p>
              <button
                onClick={handleStartQuiz}
                className="btn btn-primary"
                disabled={sourceMode === 'tab' && tabSource.candidates.length === 0}
                style={{ marginTop: '0.5rem' }}
              >
                Start Training Session
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Audio Playback controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Listen & Identify</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={playSound} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    Replay
                  </button>
                  {quizMode === 'intervals' && (
                    <button 
                      onClick={() => setShowCheatSheet(!showCheatSheet)} 
                      className={`btn ${showCheatSheet ? 'active' : ''}`}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      🎵 Songs Reference
                    </button>
                  )}
                  {isAnswered && (
                    <button onClick={generateQuestion} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      Next
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Multiple Choice Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {options.map((opt) => {
                  const isCorrectOpt = quizMode === 'intervals' 
                    ? correctInterval?.name === opt 
                    : correctChord?.name === opt;

                  const isUserAnswer = userAnswer === opt;
                  
                  let cardStyle: React.CSSProperties = {
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: 500,
                    fontSize: '0.95rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60px'
                  };

                  let borderClass = 'glass-card';
                  if (isAnswered) {
                    if (isCorrectOpt) {
                      cardStyle.borderColor = 'var(--success)';
                      cardStyle.background = 'rgba(16, 185, 129, 0.08)';
                      cardStyle.color = '#fff';
                    } else if (isUserAnswer) {
                      cardStyle.borderColor = 'var(--danger)';
                      cardStyle.background = 'rgba(239, 68, 68, 0.08)';
                      cardStyle.color = '#fff';
                    } else {
                      cardStyle.opacity = 0.55;
                    }
                  }

                  return (
                    <div
                      key={opt}
                      onClick={() => handleAnswerSubmit(opt)}
                      className={borderClass}
                      style={cardStyle}
                    >
                      <span>{getDisplayOptionName(opt)}</span>
                      {isAnswered && isCorrectOpt && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--success)', marginTop: '2px' }}>Correct</span>
                      )}
                      {isAnswered && isUserAnswer && !isCorrectOpt && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--danger)', marginTop: '2px' }}>Incorrect</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Collapsible Melody Cheat Sheet Drawer */}
              {showCheatSheet && quizMode === 'intervals' && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem', 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Melody Clue Reference</span>
                    <span>Click 🔊 to hear reference</span>
                  </div>
                  {getPossibleIntervals().map((interval) => (
                    <div 
                      key={interval.name} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        fontSize: '0.8rem',
                        padding: '2px 0'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{interval.name} ({interval.shortName}):</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>{interval.songClue}</span>
                      </div>
                      <button 
                        onClick={() => playCheatSheetInterval(interval.semitones)} 
                        className="btn" 
                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                        title="Hear reference interval"
                      >
                        🔊
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Message */}
              {isAnswered && (
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '8px' }}>
                  {(() => {
                    const rootNote = midiToNoteName(currentRoot);
                    if (quizMode === 'intervals' && correctInterval) {
                      const secondNote = midiToNoteName(currentRoot + correctInterval.semitones);
                      return (
                        <div style={{ fontSize: '0.85rem' }}>
                          <div>
                            Root note was <strong style={{ color: 'var(--primary)' }}>{rootNote.name}{rootNote.octave}</strong>.
                            Interval is {correctInterval.name} ({correctInterval.songClue}) to <strong style={{ color: 'var(--secondary)' }}>{secondNote.name}{secondNote.octave}</strong>.
                          </div>
                          {sourceMode === 'tab' && currentCandidate && tabSource.selectedTab && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              From <strong>{tabSource.selectedTab.title || tabSource.selectedTab.fileName}</strong>, bar {currentCandidate.barNumber}
                              {currentCandidate.toMidi > currentCandidate.fromMidi
                                ? ' (ascending)'
                                : currentCandidate.toMidi < currentCandidate.fromMidi
                                  ? ' (descending)'
                                  : ''}
                            </div>
                          )}
                        </div>
                      );
                    } else if (correctChord) {
                      const chordNotes = correctChord.intervals.map(offset => midiToNoteName(currentRoot + offset).name).join(' - ');
                      const label = getDisplayOptionName(correctChord.name);
                      return (
                        <div style={{ fontSize: '0.85rem' }}>
                          Root note was <strong style={{ color: 'var(--primary)' }}>{rootNote.name}{rootNote.octave}</strong>. 
                          It is a <strong style={{ color: 'var(--secondary)' }}>{label}</strong> chord: <strong style={{ color: 'var(--secondary)' }}>{chordNotes}</strong>.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Visual Feedback - Piano/Fretboard show up during review to reinforce chord shapes/intervals */}
      {hasStarted && (
        <>
          <section className="glass-panel" style={{ padding: '1.5rem', opacity: isAnswered ? 1.0 : 0.45, transition: 'opacity 0.3s ease' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              Piano Notation Assistant
            </h3>
            <Keyboard 
              activeMidis={isAnswered ? [] : correctMidis}
              highlightCorrectMidis={isAnswered ? correctMidis : []}
              interactive={false}
            />
          </section>

          <section className="glass-panel" style={{ padding: '1.5rem', opacity: isAnswered ? 1.0 : 0.45, transition: 'opacity 0.3s ease' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              Guitar Fretboard Helper (Standard Tuning)
            </h3>
            <Fretboard 
              activeMidis={isAnswered ? [] : correctMidis}
              highlightCorrectMidis={isAnswered ? correctMidis : []}
              interactive={false}
            />
          </section>
        </>
      )}

    </div>
  );
};
export default EarTrainingLab;
