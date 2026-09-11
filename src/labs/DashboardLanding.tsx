import React, { useEffect, useState } from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { DayGrid } from '../components/DayGrid';
import { assetUrl } from '../utils/assetUrl';
import { ALL_LEVELS, isLevelComplete } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';
import { useLibrary } from '../hooks/useLibrary';
import {
  challengeProgress,
  lastPractised,
  minutesOn,
  practiceStats,
  today,
  totalMinutes
} from '../utils/library';
import type { Song } from '../utils/library';
import { promptForDate } from '../data/tryThis';
import { capoLabel } from '../utils/songText';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSong: (id: string) => void;
  onAddSongForDay: (day: number | null) => void;
}

const fmtWhen = (iso: string): string => {
  const days = Math.round((new Date(`${today()}T12:00`).getTime() - new Date(`${iso}T12:00`).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const Metric: React.FC<{ label: string; value: React.ReactNode; unit?: string }> = ({ label, value, unit }) => (
  <div className="metric">
    <span className="metric-value readout">{value}{unit && <span className="metric-unit">{unit}</span>}</span>
    <span className="metric-label">{label}</span>
  </div>
);

/**
 * Home answers one question: what should I do right now?
 *
 * It is not a launcher any more — the rail on the left already is one, and a
 * grid of the same ten destinations was the rail said twice. What is here
 * instead is the state of the month: the song that is today's, the shape of
 * the thirty days, what has actually been played, and the one thing left
 * unfinished. Everything on the page is either a fact from the library or a
 * way into it.
 */
export const DashboardLanding: React.FC<DashboardLandingProps> = ({ setActiveTab, onOpenSong, onAddSongForDay }) => {
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);
  const ready = useLibrary();

  const done = ALL_LEVELS.filter(isLevelComplete).length;
  const total = ALL_LEVELS.length;
  const pct = Math.round((done / total) * 100);

  const progress = challengeProgress();
  const stats = practiceStats();
  const todaySong = progress.todaySong;
  const prompt = promptForDate();

  // The song you were last at, skipping the one already filling the top of the
  // page — repeating it would waste the only other card that can carry an
  // unfinished thing. Skipping rather than blanking: when today's song was also
  // the last one played, this card used to say nothing had been played at all,
  // directly under a card counting the minutes.
  const pickUp: { song: Song; date: string } | null = lastPractised(todaySong?.id ?? null);

  return (
    <div className="dash">
      <header
        className="hero"
        style={{ ['--hero-image' as string]: `url(${assetUrl('img/hero-guitar.webp')})` } as React.CSSProperties}
      >
        <div className="hero-copy">
          <span className="hero-eyebrow">Ready to play?</span>
          <h2 className="hero-title">
            Cadenza <span>Lab</span>
          </h2>
        </div>
      </header>

      {/* Today. The one card that is allowed to be big. */}
      {ready && (
        todaySong ? (
          <section className="today">
            <div className="today-mark">
              <span className="surface-label">Today · Song a day</span>
              <span className="today-day readout">Day {String(todaySong.day ?? progress.currentDay ?? 0).padStart(2, '0')}</span>
            </div>
            <h3 className="today-title">{todaySong.title}</h3>
            <p className="today-artist">{todaySong.artist}</p>
            <p className="today-meta readout">
              {todaySong.key}{todaySong.key && ' · '}{capoLabel(todaySong.capo)}
            </p>
            <div className="today-stats">
              <span className="today-stat">
                <span className="readout">{todaySong.confidence}/10</span> confidence
              </span>
              <span className="today-stat">
                <span className="readout">{minutesOn(todaySong.id, today())} min</span> today
              </span>
              <span className="today-stat">
                <span className="readout">{totalMinutes(todaySong)} min</span> in total
              </span>
            </div>
            <button type="button" className="btn btn-primary today-go" onClick={() => onOpenSong(todaySong.id)}>
              Continue practice
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </section>
        ) : (
          <section className="today is-empty">
            <div className="today-mark">
              <span className="surface-label">Today · Song a day</span>
              {progress.currentDay && (
                <span className="today-day readout">Day {String(progress.currentDay).padStart(2, '0')}</span>
              )}
            </div>
            <h3 className="today-title">
              {progress.currentDay ? 'No song yet for today'
                : progress.challenge ? 'Today is outside this challenge'
                : 'No challenge running'}
            </h3>
            <p className="today-artist">
              {progress.currentDay
                ? 'Pick one, write down its key and chords, and the day starts.'
                : progress.challenge
                  ? `${progress.challenge.name} ran ${progress.challenge.startDate} to ${progress.challenge.endDate}. The library is still open.`
                  : 'Your songs are still here, with no month around them.'}
            </p>
            <button
              type="button"
              className="btn btn-primary today-go"
              onClick={() => onAddSongForDay(progress.currentDay)}
            >
              {progress.currentDay ? "Add today's song" : 'Open the library'}
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </section>
        )
      )}

      <div className="dash-row">
        {/* The month, as a shape. */}
        <button type="button" className="dash-card challenge-card" onClick={() => setActiveTab('library')}>
          <div className="card-head">
            <span className="surface-label">{progress.challenge?.name ?? 'Songs'}</span>
            {progress.dayCount > 0 && (
              <span className="card-count readout">
                <strong>{String(progress.entered).padStart(2, '0')}</strong>/{progress.dayCount}
              </span>
            )}
          </div>
          {progress.dayCount > 0 && (
            <DayGrid byDay={progress.byDay} currentDay={progress.currentDay} size="sm" />
          )}
          <span className="card-foot">
            {progress.dayCount > 0
              ? `${progress.complete} complete · ${progress.dayCount - progress.entered} days still open`
              : `${stats.songsEntered} in the library`}
          </span>
        </button>

        {/* Only numbers the library can actually account for. */}
        <section className="dash-card snapshot">
          <div className="card-head"><span className="surface-label">Practice</span></div>
          <div className="metrics">
            <Metric label="This week" value={stats.weekMinutes} unit="min" />
            <Metric label="Streak" value={stats.streakDays} unit={stats.streakDays === 1 ? 'day' : 'days'} />
            <Metric
              label="Avg confidence"
              value={stats.avgConfidence === null ? '—' : stats.avgConfidence.toFixed(1)}
              unit={stats.avgConfidence === null ? undefined : '/10'}
            />
            <Metric label="Complete" value={stats.songsComplete} unit={`/${stats.songsEntered}`} />
          </div>
        </section>
      </div>

      <div className="dash-row">
        {pickUp ? (
          <button type="button" className="dash-card pickup" onClick={() => onOpenSong(pickUp.song.id)}>
            <span className="surface-label">Pick up where you left off</span>
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

      {/* The curriculum, kept to one line. It is a different thing from the
          month's songs and should not compete with them for the page. */}
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
