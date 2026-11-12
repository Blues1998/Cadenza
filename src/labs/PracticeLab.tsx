import React from 'react';
import { LabIcon } from '../components/LabIcon';
import { PRACTICE_GROUPS, type ActiveTab } from '../components/navGroups';
import { preloadLab } from './chunks';
import { useLibrary } from '../hooks/useLibrary';
import { ALL_LEVELS, isLevelComplete } from '../utils/journey';
import { getChordSkills } from '../utils/chordbook';

// Practice: everything that trains your hands and ears, and everything that
// explains why, one page with a card each, rather than seven rail entries.
//
// Each card says what it is for in a line, because "Challenges" and "Ear
// Training" are names that only mean something once you have opened them.

interface PracticeLabProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const PracticeLab: React.FC<PracticeLabProps> = ({ setActiveTab }) => {
  useLibrary(); // re-render when the chord book or library changes

  // A line of progress where there is one worth showing.
  const stat = (id: ActiveTab): string | null => {
    if (id === 'journey') {
      const done = ALL_LEVELS.filter(isLevelComplete).length;
      return `${done} of ${ALL_LEVELS.length} steps`;
    }
    if (id === 'chordbook') {
      const solid = getChordSkills().filter(s => s.comfort === 'solid').length;
      return solid > 0 ? `${solid} solid` : null;
    }
    return null;
  };

  return (
    <div className="lab-narrow practice">
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="practice" />Practice</h2>
      </div>

      {PRACTICE_GROUPS.map(group => (
        <section key={group.name} className="practice-group">
          <h3 className="practice-label">{group.name === 'Drills' ? 'Train your hands and ears' : 'Understand what you play'}</h3>
          <div className="practice-grid">
            {group.items.map(item => {
              const line = stat(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="practice-card"
                  onClick={() => setActiveTab(item.id)}
                  onPointerEnter={() => preloadLab(item.id)}
                  onTouchStart={() => preloadLab(item.id)}
                >
                  <span className="practice-icon navmark" data-nav={item.id} aria-hidden="true">
                    <span className="channel-icon">{item.icon}</span>
                  </span>
                  <span className="practice-text">
                    <span className="practice-name">{item.label}</span>
                    <span className="practice-blurb">{item.blurb}</span>
                    {line && <span className="practice-stat readout">{line}</span>}
                  </span>
                  <svg className="practice-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PracticeLab;
