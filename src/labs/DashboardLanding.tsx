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
  songProgressions,
  STATUS_LABEL,
  STATUS_ORDER,
  today,
  totalMinutes
} from '../utils/library';
import type { Song } from '../utils/library';
import { promptForDate } from '../data/tryThis';
import { getRun, startRun } from '../utils/practiceRun';
import { capoLabel } from '../utils/songText';
import { weekRecap } from '../utils/weekly';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSong: (id: string) => void;
  onAddSong: () => void;
}

/** The masthead's line: the time of day, said the way a person would. */
const greeting = (d = new Date()): string => {
  const h = d.getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const ARROW = (size: number) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

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
 * It is not a launcher any more, the rail on the left already is one, and a
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
  const prompt = promptForDate(new Date(), songs.length > 0);

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

  // Every song has exactly one status, so these add up to the song count. Revisit
  // is a flag that sits across them, and is said beside them, not among them.
  const byStatus = STATUS_ORDER.map(status => ({ status, count: songs.filter(s => s.status === status).length }));
  const started = activeSong ? totalMinutes(activeSong) > 0 : false;

  return (
    <div className="dash">
      <header
        className="hero"
        style={{ ['--hero-image' as string]: `url(${assetUrl('img/hero-guitar.webp')})` } as React.CSSProperties}
      >
        {/* The name is already in the bar above. The masthead says when it is;
            what the week held is the This week card's job. */}
        <div className="hero-copy">
          <span className="hero-eyebrow">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h2 className="hero-title">{greeting()}</h2>
        </div>
      </header>

      {/* Active practice card */}
      {ready && (
        activeSong ? (
          <section className="today">
            <div className="today-mark">
              <span className="surface-label">
                {started ? 'Practising' : 'Up next'}
              </span>
              <span className="today-day readout">{STATUS_LABEL[activeSong.status]}</span>
            </div>
            <h3 className="today-title">{activeSong.title}</h3>
            <p className="today-artist">{activeSong.artist || 'Unknown artist'}</p>
            <p className="today-meta readout">
              {activeSong.key}{activeSong.key && ' · '}{capoLabel(activeSong.capo)}
              {songProgressions(activeSong).length > 0 && (
                <span className="today-chords"> · {songProgressions(activeSong).map(p => p.join(' → ')).join('  |  ')}</span>
              )}
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
              {started ? 'Continue practice' : 'Start practising'}
              {ARROW(15)}
            </button>
          </section>
        ) : (
          <section className="today is-empty">
            <div className="today-mark">
              <span className="surface-label">Songs</span>
            </div>
            <h3 className="today-title">No songs yet</h3>
            <p className="today-artist">
              Add a song you want to learn. Its chords, strumming and practice time all live with it.
            </p>
            <button
              type="button"
              className="btn btn-primary today-go"
              onClick={() => onAddSong()}
            >
              Add first song
              {ARROW(15)}
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
            <span className="dash-run-note">Tune up, two drills, then your song.</span>
          </span>
          <span className="dash-run-go">
            Begin
            {ARROW(15)}
          </span>
        </button>
      )}

      <div className="dash-row">
        {/* The library's shape. Not shown before there is a library: the
            card above already says there are no songs. */}
        {songs.length > 0 && (
          <button type="button" className="dash-card repertoire-card" onClick={() => setActiveTab('library')}>
            <div className="card-head">
              <span className="surface-label">Repertoire</span>
              <span className="card-count readout">
                <strong>{stats.songsEntered}</strong> {stats.songsEntered === 1 ? 'song' : 'songs'}
              </span>
            </div>

            <div className="repertoire-summary">
              <div className="repertoire-stat-row">
                {byStatus.filter(b => b.count > 0).map(b => (
                  <span key={b.status} className="rep-stat-item">
                    <span className={`rep-dot is-${b.status}`} />
                    <span className="readout">{b.count}</span> {STATUS_LABEL[b.status].toLowerCase()}
                  </span>
                ))}
              </div>
              <div className="repertoire-meter" aria-hidden="true">
                {[...byStatus].reverse().filter(b => b.count > 0).map(b => (
                  <span key={b.status} className={`meter-seg is-${b.status}`} style={{ width: `${(b.count / songs.length) * 100}%` }} />
                ))}
              </div>
            </div>

            <span className="card-foot">
              {stats.revisitCount > 0 && <>{stats.revisitCount} marked to revisit · </>}
              View all songs →
            </span>
          </button>
        )}

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
              {ARROW(14)}
            </span>
          </button>
        ) : alternativeSong ? (
          <button type="button" className="dash-card pickup" onClick={() => onOpenSong(alternativeSong.id)}>
            <span className="surface-label">From your songs</span>
            <span className="pickup-title">{alternativeSong.title}</span>
            <span className="pickup-meta readout">
              {alternativeSong.key}{alternativeSong.key && ' · '}{capoLabel(alternativeSong.capo)}
            </span>
            <span className="pickup-when">{STATUS_LABEL[alternativeSong.status]}</span>
            <span className="pickup-go">
              Practice
              {ARROW(14)}
            </span>
          </button>
        ) : null}

        <button type="button" className="dash-card tryit" onClick={() => setActiveTab(prompt.tab)}>
          <span className="surface-label">Try this</span>
          <span className="tryit-text">{prompt.text}</span>
          <span className="pickup-go">
            Start
            {ARROW(14)}
          </span>
        </button>
      </div>

      {/* The curriculum, kept to one line */}
      <button type="button" className="dash-progress" onClick={() => setActiveTab('journey')}>
        <span className="dash-progress-label">Journey</span>
        <span className="dash-progress-bar"><span style={{ width: `${pct}%` }} /></span>
        <span className="dash-progress-count readout">{done}/{total}</span>
        {ARROW(14)}
      </button>
    </div>
  );
};
export default DashboardLanding;
