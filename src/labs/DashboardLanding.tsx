import React, { useEffect, useState } from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { WeekPanel } from '../components/WeekPanel';
import { assetUrl } from '../utils/assetUrl';
import { ALL_LEVELS, isLevelComplete } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';
import { useLibrary } from '../hooks/useLibrary';
import {
  getSongs,
  lastPractised,
  minutesOn,
  practiceStats,
  STATUS_LABEL,
  today,
  totalMinutes
} from '../utils/library';
import type { Song } from '../utils/library';
import { promptForDate } from '../data/tryThis';
import { getRun, startRun } from '../utils/practiceRun';
import { capoLabel } from '../utils/songText';
import { weekLine, weekRecap } from '../utils/weekly';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSong: (id: string) => void;
  onAddSong: () => void;
}

const fmtWhen = (iso: string): string => {
  const days = Math.round((new Date(`${today()}T12:00`).getTime() - new Date(`${iso}T12:00`).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * Home answers one question: what should I do right now?
 *
 * It is not a launcher any more — the rail on the left already is one, and a
 * grid of the same ten destinations was the rail said twice. What is here
 * instead is the state of your repertoire: the song currently in practice,
 * the shape of your library, what has actually been played, and the one thing
 * left unfinished.
 */
export const DashboardLanding: React.FC<DashboardLandingProps> = ({ setActiveTab, onOpenSong, onAddSong }) => {
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);
  const ready = useLibrary();

  const done = ALL_LEVELS.filter(isLevelComplete).length;
  const total = ALL_LEVELS.length;
  const pct = Math.round((done / total) * 100);

  const stats = practiceStats();
  const recap = weekRecap();
  const songs = getSongs();
  const prompt = promptForDate();

  // Find the most relevant active song:
  // 1. Most recently practiced song, or
  // 2. First song currently in 'learning' status, or
  // 3. First song in repertoire
  const lastPlayed = lastPractised(null);
  const learningSong = songs.find(s => s.status === 'learning');
  const activeSong: Song | null = lastPlayed?.song ?? learningSong ?? songs[0] ?? null;

  // The secondary card: a different recently played song, or another song from the library
  const pickUp: { song: Song; date: string } | null = lastPractised(activeSong?.id ?? null);
  const alternativeSong: Song | null = !pickUp ? (songs.find(s => s.id !== activeSong?.id) ?? null) : null;

  const learningCount = songs.filter(s => s.status === 'learning').length;

  return (
    <div className="dash">
      <header
        className="hero"
        style={{ ['--hero-image' as string]: `url(${assetUrl('img/hero-guitar.webp')})` } as React.CSSProperties}
      >
        <div className="hero-copy">
          <span className="hero-eyebrow">{weekLine(recap)}</span>
          <h2 className="hero-title">
            Cadenza <span>Lab</span>
          </h2>
        </div>
      </header>

      {/* Active practice card */}
      {ready && (
        activeSong ? (
          <section className="today">
            <div className="today-mark">
              <span className="surface-label">
                {lastPlayed?.song?.id === activeSong.id ? 'Active Practice · Pick Up' : 'Active Practice · In Repertoire'}
              </span>
              <span className="today-day readout">{STATUS_LABEL[activeSong.status]}</span>
            </div>
            <h3 className="today-title">{activeSong.title}</h3>
            <p className="today-artist">{activeSong.artist || 'Unknown artist'}</p>
            <p className="today-meta readout">
              {activeSong.key}{activeSong.key && ' · '}{capoLabel(activeSong.capo)}
              {activeSong.chordsRaw && <span className="today-chords"> · {activeSong.chordsRaw}</span>}
            </p>
            <div className="today-stats">
              <span className="today-stat">
                <span className="readout">{activeSong.confidence}/10</span> confidence
              </span>
              <span className="today-stat">
                <span className="readout">{minutesOn(activeSong.id, today())} min</span> today
              </span>
              <span className="today-stat">
                <span className="readout">{totalMinutes(activeSong)} min</span> in total
              </span>
            </div>
            <button type="button" className="btn btn-primary today-go" onClick={() => onOpenSong(activeSong.id)}>
              Continue practice
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </section>
        ) : (
          <section className="today is-empty">
            <div className="today-mark">
              <span className="surface-label">Song Repertoire</span>
            </div>
            <h3 className="today-title">No songs in library yet</h3>
            <p className="today-artist">
              Add songs to your repertoire to log practice, manage chord charts, and track your progress.
            </p>
            <button
              type="button"
              className="btn btn-primary today-go"
              onClick={() => onAddSong()}
            >
              Add first song
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </section>
        )
      )}

      {/* One press instead of a decision */}
      {ready && !getRun() && (
        <button type="button" className="dash-run" onClick={() => startRun()}>
          <span className="dash-run-said">
            <span className="surface-label">Today's run</span>
            <span className="dash-run-title">Start a session</span>
            <span className="dash-run-note">Tune, two drills picked from what is in your way, then your song.</span>
          </span>
          <span className="dash-run-go">
            Begin
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </button>
      )}

      <div className="dash-row">
        {/* Repertoire overview card */}
        <button type="button" className="dash-card repertoire-card" onClick={() => setActiveTab('library')}>
          <div className="card-head">
            <span className="surface-label">Repertoire</span>
            <span className="card-count readout">
              <strong>{stats.songsEntered}</strong> {stats.songsEntered === 1 ? 'song' : 'songs'}
            </span>
          </div>

          <div className="repertoire-summary">
            <div className="repertoire-stat-row">
              <span className="rep-stat-item">
                <span className="rep-dot is-learning" />
                <span className="readout">{learningCount}</span> learning
              </span>
              <span className="rep-stat-item">
                <span className="rep-dot is-complete" />
                <span className="readout">{stats.songsComplete}</span> complete
              </span>
              <span className="rep-stat-item">
                <span className="rep-dot is-revisit" />
                <span className="readout">{stats.revisitCount}</span> revisit
              </span>
            </div>

            {stats.songsEntered > 0 && (
              <div className="repertoire-meter" aria-hidden="true">
                <span
                  className="meter-complete"
                  style={{ width: `${(stats.songsComplete / stats.songsEntered) * 100}%` }}
                />
                <span
                  className="meter-learning"
                  style={{ width: `${(learningCount / stats.songsEntered) * 100}%` }}
                />
              </div>
            )}
          </div>

          <span className="card-foot">
            {stats.totalMinutes} min practice logged · View all {stats.songsEntered} songs →
          </span>
        </button>

        <WeekPanel recap={recap} />
      </div>

      <div className="dash-row">
        {pickUp ? (
          <button type="button" className="dash-card pickup" onClick={() => onOpenSong(pickUp.song.id)}>
            <span className="surface-label">Recently practiced</span>
            <span className="pickup-title">{pickUp.song.title}</span>
            <span className="pickup-meta readout">
              {pickUp.song.key}{pickUp.song.key && ' · '}{capoLabel(pickUp.song.capo)}
            </span>
            <span className="pickup-when">Last played {fmtWhen(pickUp.date)}</span>
            <span className="pickup-go">
              Practice
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>
        ) : alternativeSong ? (
          <button type="button" className="dash-card pickup" onClick={() => onOpenSong(alternativeSong.id)}>
            <span className="surface-label">From your repertoire</span>
            <span className="pickup-title">{alternativeSong.title}</span>
            <span className="pickup-meta readout">
              {alternativeSong.key}{alternativeSong.key && ' · '}{capoLabel(alternativeSong.capo)}
            </span>
            <span className="pickup-when">{STATUS_LABEL[alternativeSong.status]}</span>
            <span className="pickup-go">
              Practice
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>
        ) : (
          <button type="button" className="dash-card pickup is-empty" onClick={() => setActiveTab('library')}>
            <span className="surface-label">Your songs</span>
            <span className="pickup-title">Nothing played yet</span>
            <span className="pickup-when">Every session you log shows up here.</span>
            <span className="pickup-go">
              Open library
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>
        )}

        <button type="button" className="dash-card tryit" onClick={() => setActiveTab(prompt.tab)}>
          <span className="surface-label">Try this</span>
          <span className="tryit-text">{prompt.text}</span>
          <span className="pickup-go">
            Start
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </button>
      </div>

      {/* The curriculum, kept to one line */}
      <button type="button" className="dash-progress" onClick={() => setActiveTab('journey')}>
        <span className="dash-progress-label">Journey</span>
        <span className="dash-progress-bar"><span style={{ width: `${pct}%` }} /></span>
        <span className="dash-progress-count readout">{String(done).padStart(2, '0')}/{total}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
};
export default DashboardLanding;
