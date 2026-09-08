import React, { useEffect, useState } from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { GuitarLineArt } from '../components/GuitarLineArt';
import { ALL_LEVELS, isLevelComplete } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const ICON = {
  theory: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  physics: <polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />,
  ear: <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>,
  rhythm: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  tuner: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" /></>,
  play: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  tabs: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  songs: <polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9 12 2" />
};

// The dashboard is a launcher, not a brochure. A tile is an icon and the lab's
// name; anything a sentence would have added is one click away in the lab
// itself, where it is actually useful.
const LABS: { id: ActiveTab; name: string; icon: React.ReactNode }[] = [
  { id: 'theory', name: 'Theory & Scales', icon: ICON.theory },
  { id: 'physics', name: 'Sound Physics', icon: ICON.physics },
  { id: 'ear-training', name: 'Ear Training', icon: ICON.ear },
  { id: 'rhythm', name: 'Rhythm & Timing', icon: ICON.rhythm },
  { id: 'tuner', name: 'Pitch & Tuner', icon: ICON.tuner },
  { id: 'play', name: 'Play Challenges', icon: ICON.play },
  { id: 'tabs', name: 'Tab Player', icon: ICON.tabs },
  { id: 'songs', name: 'Song Hero', icon: ICON.songs }
];

export const DashboardLanding: React.FC<DashboardLandingProps> = ({ setActiveTab }) => {
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);

  const done = ALL_LEVELS.filter(isLevelComplete).length;
  const total = ALL_LEVELS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="dash">
      <header className="hero">
        <h2 className="hero-title">
          Cadenza <span>Lab</span>
        </h2>
        <GuitarLineArt className="hero-guitar" />
      </header>

      {/* One line for the curriculum: where you are, as a bar and a count.
          The levels themselves live in Journey. */}
      <button type="button" className="dash-progress" onClick={() => setActiveTab('journey')}>
        <span className="dash-progress-label">Journey</span>
        <span className="dash-progress-bar"><span style={{ width: `${pct}%` }} /></span>
        <span className="dash-progress-count readout">{String(done).padStart(2, '0')}/{total}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      <div className="dash-grid">
        {LABS.map(lab => (
          <button key={lab.id} type="button" className="dash-tile" onClick={() => setActiveTab(lab.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {lab.icon}
            </svg>
            <span>{lab.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
export default DashboardLanding;
