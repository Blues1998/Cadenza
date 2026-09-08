import React, { useState, useEffect, useRef } from 'react';
import { Keyboard } from '../components/Keyboard';
import { Fretboard } from '../components/Fretboard';
import { Segmented } from '../components/Segmented';
import { audio } from '../utils/audio';
import { reportProgress } from '../utils/progress';
import {
  pickNextItem,
  recordAttempt,
  resetMastery,
  unlockedCount
} from '../utils/mastery';
import { MasteryStrip } from '../components/MasteryStrip';
import type { MasteryItem } from '../components/MasteryStrip';
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
import { CHORD_FEELINGS } from '../utils/glossary';
import { IconSpeaker } from '../components/Icons';

// Two of the longer 7th-chord names get an abbreviated parenthetical
// (everything else is short enough to show in full) — the feeling word
// itself always comes from CHORD_FEELINGS so it can't drift out of sync
// with the rest of the app's chord-quality labeling.
const CHORD_SHORT_LABEL_OVERRIDES: Record<string, string> = {
  'Half-Diminished 7th': 'Half-Dim',
  'Diminished 7th': 'Dim 7th'
};

type QuizMode = 'intervals' | 'chords';
type Difficulty = 'auto' | 'super-beginner' | 'easy' | 'medium' | 'hard';
type PlaybackStyle = 'melodic' | 'harmonic';
type SourceMode = 'random' | 'tab';

// Item ids for the mastery store. Opaque to it, meaningful here.
const intervalItemId = (semitones: number): string => `interval:${semitones}`;
const chordItemId = (name: string): string => `chord:${name}`;

// The order things are introduced in on Auto, easiest first. Not the
// chromatic order: the octave and the fifth are the two intervals a beginner
// can already hear before being taught anything, so they anchor the row, and
// the tritone and the minor 2nd — the two that need a reference to place at
// all — come last.
const INTERVAL_LADDER = [0, 12, 7, 5, 4, 3, 2, 9, 8, 10, 11, 1, 6];

// Same idea for chord qualities: the major/minor split first, then the
// colours that sit between them, then the sevenths.
const CHORD_LADDER = [
  'Major Triad',
  'Minor Triad',
  'Dominant 7th',
  'Diminished Triad',
  'Augmented Triad',
  'Major 7th',
  'Minor 7th',
  'Half-Diminished 7th',
  'Diminished 7th'
];

// Two or three characters, because the strip is thirteen cells wide.
const CHORD_TICK_LABELS: Record<string, string> = {
  'Major Triad': 'Maj',
  'Minor Triad': 'min',
  'Dominant 7th': '7',
  'Diminished Triad': 'dim',
  'Augmented Triad': 'aug',
  'Major 7th': 'M7',
  'Minor 7th': 'm7',
  'Half-Diminished 7th': '\u00F87',
  'Diminished 7th': 'o7'
};

const INTERVAL_STRIP_ITEMS: MasteryItem[] = INTERVAL_LADDER.map(semitones => {
  const info = INTERVALS.find(i => i.semitones === semitones);
  return {
    id: intervalItemId(semitones),
    label: info?.shortName ?? String(semitones),
    name: info?.name ?? `${semitones} semitones`
  };
});

const CHORD_STRIP_ITEMS: MasteryItem[] = CHORD_LADDER.map(name => ({
  id: chordItemId(name),
  label: CHORD_TICK_LABELS[name] ?? name,
  name
}));

export const EarTrainingLab: React.FC = () => {
  const [quizMode, setQuizMode] = useState<QuizMode>('intervals');
  const [difficulty, setDifficulty] = useState<Difficulty>('auto');
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

  // The item the current question is about, and the one before it. The drill
  // never asks the same thing twice running, and the strip marks whichever
  // bar just moved.
  const lastItemId = useRef<string | null>(null);
  const [latestItemId, setLatestItemId] = useState<string | null>(null);
  // Clearing the store has to repaint the strip, which reads it directly.
  const [, setMasteryTick] = useState(0);

  // How far the Auto ladders have opened up. Recomputed on render so the row
  // widens the moment an unlock is earned.
  const intervalsUnlocked = unlockedCount(INTERVAL_STRIP_ITEMS.map(i => i.id));
  const chordsUnlocked = unlockedCount(CHORD_STRIP_ITEMS.map(i => i.id));

  // Configure options based on difficulty and mode
  const getPossibleIntervals = (): IntervalInfo[] => {
    switch (difficulty) {
      case 'auto': {
        // The ladder decides the pool; mastery decides which of it you get
        // asked. A hand-set level is still there for anyone who wants to sit
        // on one thing until it sticks.
        const semitones = INTERVAL_LADDER.slice(0, intervalsUnlocked);
        return INTERVALS.filter(i => semitones.includes(i.semitones));
      }
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
      case 'auto': {
        const names = CHORD_LADDER.slice(0, chordsUnlocked);
        return CHORD_QUALITIES.filter(c => names.includes(c.name));
      }
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

  // Which row of bars to show, and how much of it is in play. Only Auto gates
  // the pool by mastery, so under a hand-set level every item is available and
  // the strip is a plain record of what you know.
  const strip = quizMode === 'intervals'
    ? { items: INTERVAL_STRIP_ITEMS, unlocked: difficulty === 'auto' ? intervalsUnlocked : INTERVAL_STRIP_ITEMS.length }
    : { items: CHORD_STRIP_ITEMS, unlocked: difficulty === 'auto' ? chordsUnlocked : CHORD_STRIP_ITEMS.length };

  // Which item to ask next. Weighted toward what you are weakest at and what
  // is due — in every difficulty, not just Auto. A hand-set level chooses the
  // pool, not the order within it, and a uniform draw over a pool you have
  // half learned spends half its questions on the half you already know.
  const chooseInterval = (pool: IntervalInfo[]): IntervalInfo => {
    const picked = pickNextItem(pool.map(i => intervalItemId(i.semitones)), { exclude: lastItemId.current });
    return pool.find(i => intervalItemId(i.semitones) === picked) ?? pool[0];
  };

  const chooseChord = (pool: ChordQualityInfo[]): ChordQualityInfo => {
    const picked = pickNextItem(pool.map(c => chordItemId(c.name)), { exclude: lastItemId.current });
    return pool.find(c => chordItemId(c.name) === picked) ?? pool[0];
  };

  // Generate a new question
  const generateQuestion = () => {
    audio.init();
    setIsAnswered(false);
    setUserAnswer(null);
    // The strip's marker is cleared with the answer it belonged to. Left up,
    // it would sit on the previous question's item all through the next one —
    // and since the drill never repeats an item back to back, that quietly
    // rules an option out for you.
    setLatestItemId(null);
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

      // Same weighting, applied to whichever jumps this piece actually
      // contains: choose the interval first, then a bar that has one of them.
      const byItem = new Map<string, TabIntervalCandidate[]>();
      for (const c of pool) {
        const id = intervalItemId(Math.abs(c.toMidi - c.fromMidi));
        const bucket = byItem.get(id);
        if (bucket) bucket.push(c);
        else byItem.set(id, [c]);
      }
      const pickedId = pickNextItem(Array.from(byItem.keys()), { exclude: lastItemId.current });
      const bucket = (pickedId && byItem.get(pickedId)) || pool;

      const candidate = bucket[Math.floor(Math.random() * bucket.length)];
      setCurrentCandidate(candidate);

      const semitones = Math.abs(candidate.toMidi - candidate.fromMidi);
      lastItemId.current = intervalItemId(semitones);
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
      if (possible.length === 0) return;
      const randInterval = chooseInterval(possible);
      lastItemId.current = intervalItemId(randInterval.semitones);
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
      if (possible.length === 0) return;
      const randChord = chooseChord(possible);
      lastItemId.current = chordItemId(randChord.name);
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
      const feeling = CHORD_FEELINGS[opt];
      if (!feeling) return opt;
      const shortLabel = CHORD_SHORT_LABEL_OVERRIDES[opt] ?? opt.replace(' Triad', '');
      return `${feeling} (${shortLabel})`;
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

    // Grade the item itself, right or wrong — the miss is the more useful of
    // the two, and it is the one a running total of successes throws away.
    const itemId = quizMode === 'intervals'
      ? (correctInterval ? intervalItemId(correctInterval.semitones) : null)
      : (correctChord ? chordItemId(correctChord.name) : null);
    if (itemId) {
      recordAttempt(itemId, isCorrect);
      setLatestItemId(itemId);
    }

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

  // Watch for quiz criteria changes and update quiz question automatically.
  // If tab mode runs dry mid-session (switching the library pick to a piece
  // with no gradable candidates), generateQuestion() would otherwise bail
  // out early having already cleared the old candidate/correctMidis while
  // leaving the previous correctInterval/options on screen — an unanswerable
  // stale question. Bounce back to the start screen instead, same as the
  // already-disabled Start button for that same empty-candidates case.
  useEffect(() => {
    if (!hasStarted) return;
    if (sourceMode === 'tab' && !tabSource.isLoading && tabSource.candidates.length === 0) {
      setHasStarted(false);
      return;
    }
    generateQuestion();
  }, [quizMode, difficulty, playbackStyle, sourceMode, tabSource.candidates, tabSource.isLoading]);

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
        <h2 className="lab-title">Ear Training</h2>
      </div>

      <div className="grid-2">
        
        {/* Settings Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', paddingBottom: '0.5rem' }}>Settings</h3>

          <Segmented
            label="Source"
            value={sourceMode}
            onChange={(v) => { setSourceMode(v); if (v === 'tab') setQuizMode('intervals'); }}
            options={[
              { value: 'random', label: 'Random Tones' },
              { value: 'tab', label: 'From My Tabs' }
            ]}
            full
          />

          {sourceMode === 'tab' && (
            <div>
              <span className="field-label">Practice From</span>
              {tabSource.libraryEntries.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Nothing saved yet — import a piece in Tab Player first.
                </p>
              ) : (
                <select
                  value={tabSource.selectedTab?.id ?? ''}
                  onChange={(e) => {
                    const entry = tabSource.libraryEntries.find(t => t.id === e.target.value);
                    if (entry) tabSource.selectTab(entry);
                  }}
                  className="select-field"
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
                  No clear single-note jumps in this piece.
                </p>
              )}
            </div>
          )}

          {sourceMode === 'random' && (
            <Segmented
              label="Type"
              value={quizMode}
              onChange={setQuizMode}
              options={[
                { value: 'intervals', label: 'Intervals' },
                { value: 'chords', label: 'Chord Qualities' }
              ]}
              full
            />
          )}

          <Segmented
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            tone="secondary"
            size="sm"
            options={[
              { value: 'auto' as Difficulty, label: 'Auto', title: 'Asks whatever you are worst at, and adds a new one each time you have earned it' },
              { value: 'super-beginner' as Difficulty, label: 'Starter', title: 'Unison, 5th, octave' },
              { value: 'easy' as Difficulty, label: 'Easy' },
              { value: 'medium' as Difficulty, label: 'Medium' },
              { value: 'hard' as Difficulty, label: 'Hard' }
            ]}
            full
          />

          {sourceMode === 'random' && (
            <Segmented
              label="Playback"
              value={playbackStyle}
              onChange={setPlaybackStyle}
              size="sm"
              options={[
                { value: 'melodic', label: 'Melodic (Stepwise)' },
                { value: 'harmonic', label: 'Harmonic (Together)' }
              ]}
              full
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: 'auto' }}>
          {hasStarted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', background: 'var(--surface-2)', padding: '0.75rem 0.9rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Accuracy</span>
                <span className="readout" style={{ color: 'var(--text-primary)' }}>
                  {totalQuestions > 0 ? `${Math.round((score / totalQuestions) * 100)}%` : '0%'}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> {score}/{totalQuestions}</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Streak</span>
                <span className="readout" style={{ color: streak > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{streak}</span>
              </div>
            </div>
          )}

          {/* The record, kept across sessions. What the drill reads to decide
              the next question, shown so the decision isn't a black box. */}
          <MasteryStrip
            items={strip.items}
            unlocked={strip.unlocked}
            highlightId={latestItemId}
            onReset={() => {
              resetMastery();
              setLatestItemId(null);
              setMasteryTick(t => t + 1);
            }}
          />
          </div>
        </section>

        {/* Quiz Arena Panel */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '320px', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
          {!hasStarted ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 106, 42, 0.05)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
                {sourceMode === 'tab'
                  ? 'Hear a jump from the piece you picked, then name it.'
                  : 'Hear it, then name it.'}
              </p>
              <button
                onClick={handleStartQuiz}
                className="btn btn-primary"
                disabled={sourceMode === 'tab' && tabSource.candidates.length === 0}
                style={{ marginTop: '0.5rem' }}
              >
                Start
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Audio Playback controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem' }}>
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
                      Song clues
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
                      cardStyle.background = 'rgba(70, 192, 138, 0.08)';
                      cardStyle.color = 'var(--text-primary)';
                    } else if (isUserAnswer) {
                      cardStyle.borderColor = 'var(--danger)';
                      cardStyle.background = 'rgba(239, 68, 68, 0.08)';
                      cardStyle.color = 'var(--text-primary)';
                    } else {
                      cardStyle.opacity = 0.55;
                    }
                  }

                  return (
                    <div
                      key={opt}
                      onClick={() => handleAnswerSubmit(opt)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAnswerSubmit(opt);
                        }
                      }}
                      className={borderClass}
                      style={{ ...cardStyle, cursor: 'pointer' }}
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
                    background: 'var(--surface-2)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Melody Clue Reference</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Click <IconSpeaker size={12} /> to hear reference</span>
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
                        <IconSpeaker />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Message */}
              {isAnswered && (
                <div style={{ textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed rgba(var(--surface-tint-rgb),0.06)', padding: '0.75rem', borderRadius: '8px' }}>
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
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
              Piano Notation Assistant
            </h3>
            <Keyboard 
              activeMidis={isAnswered ? [] : correctMidis}
              highlightCorrectMidis={isAnswered ? correctMidis : []}
              interactive={false}
            />
          </section>

          <section className="glass-panel" style={{ padding: '1.5rem', opacity: isAnswered ? 1.0 : 0.45, transition: 'opacity 0.3s ease' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
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
