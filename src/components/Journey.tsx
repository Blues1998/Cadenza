import React, { useEffect, useState } from 'react';
import type { ActiveTab } from './Sidebar';
import { JOURNEY, ALL_LEVELS, XP_PER_LEVEL, isLevelComplete, getCurrentLevelIndex, levelProgress } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';

interface JourneyProps {
  setActiveTab: (tab: ActiveTab) => void;
}

// The Guided Journey: a curriculum whose levels complete automatically when
// the labs report the required progress events. The order is a suggestion,
// not a gate — every level is open and redoable at any time.
//
// Drawn as one continuous line rather than a stack of cards. The line itself
// is the progress bar: the segment beside a finished level is lit, the rest
// is not, so the shape of the run tells you where you are the way a score
// tells you how much of the piece is left.
export const Journey: React.FC<JourneyProps> = ({ setActiveTab }) => {
  // Re-render whenever any lab reports progress (covers other tabs too)
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);

  // Which level is open; null = default to the suggested next one
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completedCount = ALL_LEVELS.filter(isLevelComplete).length;
  const currentIdx = getCurrentLevelIndex();
  const totalLevels = ALL_LEVELS.length;
  const xp = completedCount * XP_PER_LEVEL;
  const pct = Math.round((completedCount / totalLevels) * 100);
  const finished = completedCount === totalLevels;

  let flatIdx = -1;

  return (
    <section className="glass-panel journey">
      <div className="journey-main">
        <h3 className="journey-title">Your Guided Journey</h3>
        <p className="journey-lede">
          One idea at a time, learned by doing. Levels complete <em>automatically</em> when you do
          the task in the lab — no checkboxes. The order is a suggestion: open any level to jump in,
          or redo one you've finished.
        </p>

        {finished && (
          <p className="journey-done">
            Journey complete — notes, scales, intervals, chords, keys and rhythm, all of it played
            rather than read. Keep building streaks in Play Challenges and Ear Training.
          </p>
        )}

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
                      {isSuggested && !done && <span className="step-tag">Up next</span>}
                      {done && <span className="step-tag is-done">Done</span>}
                    </button>

                    {isOpen && (
                      <div className="step-body">
                        <p className="step-idea">{level.idea}</p>
                        <p className="step-task">
                          <span className="step-task-label">Your task</span>
                          {level.task}
                        </p>
                        <div className="step-actions">
                          <button
                            onClick={() => setActiveTab(level.tab)}
                            className={`btn ${done ? '' : 'btn-primary'}`}
                            style={{ padding: '0.42rem 0.9rem', fontSize: '0.8rem' }}
                          >
                            {done ? 'Do it again' : level.buttonText}
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </button>
                          {needed > 1 && !done && (
                            <span className="step-progress readout">{met}/{needed}</span>
                          )}
                          <span className="step-xp readout">+{XP_PER_LEVEL} XP</span>
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
      </div>

      {/* The run of levels says where you are step by step; this says it as a
          number. Separated by a rule rather than boxed, so it reads as one
          panel with two columns and not as a card inside a card. */}
      <aside className="journey-side">
        <div className="journey-stat readout">
          <span className="journey-stat-figure">{String(completedCount).padStart(2, '0')}</span>
          <span className="journey-stat-total">/ {totalLevels}</span>
        </div>
        <span className="journey-stat-label readout">
          {pct}% complete{xp > 0 && ` · ${xp} XP`}
        </span>
        <div className="journey-bar" role="presentation">
          <span style={{ width: `${pct}%` }} />
        </div>

        <blockquote className="journey-quote">
          Small steps make great musicians.
        </blockquote>

        <ul className="journey-verbs readout">
          <li>Practice</li>
          <li>Explore</li>
          <li>Improve</li>
        </ul>
      </aside>
    </section>
  );
};
export default Journey;
