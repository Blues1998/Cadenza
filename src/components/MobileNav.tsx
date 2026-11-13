import React from 'react';
import { BrandMark, Wordmark } from './Brand';
import type { ActiveTab } from './navGroups';
import { PRIMARY, navItem, parentTab } from './navGroups';
import { IconJump } from './Icons';
import { preloadLab } from '../labs/chunks';

// The phone's navigation, replacing the sidebar below the shell breakpoint.
//
// Five tabs where the thumb is, Today, Songs, Practice, Tuner, Me, and a top
// bar that names the page. A page that lives under one of the five (Chords
// under Practice, the Tab Player under Songs) keeps its tab lit and gets a
// back arrow to it, so you always know where you are and how to get out.

interface MobileNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onJump: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab, onJump }) => {
  const parent = parentTab(activeTab);
  const nested = parent !== activeTab;
  const title = activeTab === 'dashboard' ? null : navItem(activeTab).label;

  return (
    <>
      <header className="mtop">
        {nested ? (
          <button type="button" className="mtop-icon mtop-back" onClick={() => setActiveTab(parent)} aria-label={`Back to ${navItem(parent).label}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 5 8 12 15 19" />
            </svg>
          </button>
        ) : (
          <button type="button" className="mtop-brand" onClick={() => setActiveTab('dashboard')} aria-label="Today">
            <BrandMark />
          </button>
        )}
        <span className="mtop-title">{title ?? <Wordmark />}</span>
        <button type="button" className="mtop-icon" onClick={onJump} aria-label="Search">
          <IconJump size={18} aria-hidden="true" />
        </button>
      </header>

      <nav className="mtabs" aria-label="Main">
        {PRIMARY.map(({ id, label, icon }) => {
          const active = parent === id;
          return (
            <button
              key={id}
              type="button"
              className={`mtab${active ? ' is-active' : ''}`}
              onClick={() => setActiveTab(id)}
              onTouchStart={() => preloadLab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <span className="mtab-icon">{icon}</span>
              <span className="mtab-label">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default MobileNav;
