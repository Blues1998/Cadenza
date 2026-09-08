import React, { useEffect, useState } from 'react';
import type { ActiveTab } from './Sidebar';
import { JOURNEY, ALL_LEVELS, isLevelComplete, getCurrentLevelIndex, levelProgress } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';

interface JourneyProps {
  setActiveTab: (tab: ActiveTab) => void;
}

// The curriculum, drawn as one continuous line rather than a stack of cards.
// Levels tick themselves off when the labs report the work done, so the line
// is also the progress bar: lit behind you, unlit ahead.
//
// The nodes carry the state — hollow, ringed, or filled with a tick — which
// is why no row needs a word like "Done" or "Up next" beside it.
export const Journey: React.FC<JourneyProps> = ({ setActiveTab }) => {
  // Re-render whenever any lab reports progress (covers other tabs too)
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);

  // Which level is open; null = default to the suggested next one
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completedCount = ALL_LEVELS.filter(isLevelComplete).length;
  const currentIdx = getCurrentLevelIndex();
  const totalLevels = ALL_LEVELS.length;
  const pct = Math.round((completedCount / totalLevels) * 100);

  let flatIdx = -1;

  return (
    <section className="glass-panel journey">
      <div className="journey-meter">
        <span className="journey-stat readout">
          <span className="journey-stat-figure">{String(completedCount).padStart(2, '0')}</span>
          <span className="journey-stat-total">/ {totalLevels}</span>
        </span>
        <span className="journey-bar" role="presentation">
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>

      <ol className="timeline">
        {JOURNEY.map(chapter => {
          const chapterDone = chapter.levels.filter(isLevelComplete).length;
          const chapterComplete = chapterDone === chapter.levels.length;
          return (
            <React.Fragment key={chapter.title}>
              {/* Rehearsal mark: where one movement of the curriculum starts */}
              <li className={`timeline-mark${chapterComplete ? ' is-done' : ''}`}>
                <span className="timeline-mark-label">{chapter.title}</span>
                <span className="timeline-mark-count readout">
                  {chapterDone}/{chapter.levels.length}
                </span>
              </li>

              {chapter.levels.map(level => {
                flatIdx++;
                const step = flatIdx + 1;
                const done = isLevelComplete(level);
                const isSuggested = flatIdx === currentIdx;
                const [met, needed] = levelProgress(level);
                const isOpen = expandedId === null ? isSuggested : expandedId === level.id;

                return (
                  <li
                    key={level.id}
                    className={`timeline-step${done ? ' is-done' : ''}${isSuggested && !done ? ' is-next' : ''}${isOpen ? ' is-open' : ''}`}
                  >
                    <span className="step-node" aria-hidden="true">
                      {done && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <button
                      type="button"
                      className="step-head"
                      aria-expanded={isOpen}
                      onClick={() => setExpandedId(isOpen ? '' : level.id)}
                    >
                      <span className="step-index readout">{String(step).padStart(2, '0')}</span>
                      <span className="step-title">{level.title}</span>
                    </button>

                    {isOpen && (
                      <div className="step-body">
                        <p className="step-idea">{level.idea}</p>
                        <p className="step-task">{level.task}</p>
                        <div className="step-actions">
                          <button
                            onClick={() => setActiveTab(level.tab)}
                            className={`btn ${done ? '' : 'btn-primary'}`}
                            style={{ padding: '0.42rem 0.9rem', fontSize: '0.8rem' }}
                          >
                            {level.buttonText}
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </button>
                          {needed > 1 && !done && (
                            <span className="step-progress readout">{met}/{needed}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </React.Fragment>
          );
        })}
      </ol>
    </section>
  );
};
export default Journey;
