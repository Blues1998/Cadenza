import React, { useEffect, useState } from 'react';
import type { ActiveTab } from './Sidebar';
import { JOURNEY, ALL_LEVELS, XP_PER_LEVEL, isLevelComplete, getCurrentLevelIndex, levelProgress } from '../utils/journey';
import { subscribeProgress } from '../utils/progress';

interface JourneyProps {
  setActiveTab: (tab: ActiveTab) => void;
}

// The Guided Journey panel: a linear curriculum whose levels complete
// automatically when the labs report the required progress events.
export const Journey: React.FC<JourneyProps> = ({ setActiveTab }) => {
  // Re-render whenever any lab reports progress (covers other tabs too)
  const [, setTick] = useState(0);
  useEffect(() => subscribeProgress(() => setTick(t => t + 1)), []);

  const completedCount = ALL_LEVELS.filter(isLevelComplete).length;
  const currentIdx = getCurrentLevelIndex();
  const totalLevels = ALL_LEVELS.length;
  const xp = completedCount * XP_PER_LEVEL;
  const pct = Math.round((completedCount / totalLevels) * 100);
  const finished = completedCount === totalLevels;

  let flatIdx = -1;

  return (
    <section className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header + overall progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span>Your Guided Journey</span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(0, 240, 255, 0.08)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
              {xp} XP
            </span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            One idea at a time, learned by doing. Levels complete <em>automatically</em> when you do the task in the lab — no checkboxes.
          </p>
        </div>
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>{completedCount} of {totalLevels} levels</span>
            <strong>{pct}%</strong>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {finished && (
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)', fontSize: '0.9rem' }}>
          🎉 Journey complete! You've covered notes, scales, intervals, chords, keys, and rhythm — by playing all of it.
          Keep building streaks in Play Challenges and Ear Training to sharpen everything.
        </div>
      )}

      {/* Chapters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {JOURNEY.map(chapter => {
          const chapterDone = chapter.levels.filter(isLevelComplete).length;
          return (
            <div key={chapter.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>{chapter.emoji}</span>
                <span>{chapter.title}</span>
                <span style={{ color: chapterDone === chapter.levels.length ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'none' }}>
                  {chapterDone}/{chapter.levels.length}
                </span>
              </h4>

              {chapter.levels.map(level => {
                flatIdx++;
                const done = isLevelComplete(level);
                const isCurrent = flatIdx === currentIdx;
                const locked = flatIdx > currentIdx;
                const [met, needed] = levelProgress(level);

                if (!isCurrent) {
                  // Compact row for done / locked levels
                  return (
                    <div key={level.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.75rem', borderRadius: '8px', background: done ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)', border: '1px solid ' + (done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)'), opacity: locked ? 0.55 : 1 }}>
                      <span style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>
                        {done ? '✅' : '🔒'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: done ? 'var(--text-secondary)' : 'var(--text-muted)', textDecoration: done ? 'line-through' : 'none' }}>
                        {level.title}
                      </span>
                    </div>
                  );
                }

                // Expanded card for the current level
                return (
                  <div key={level.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.04)', border: '1px solid rgba(0, 240, 255, 0.25)', boxShadow: '0 0 20px rgba(0, 240, 255, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#030406', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>
                        UP NEXT
                      </span>
                      <h5 style={{ fontSize: '1rem', fontWeight: 700 }}>{level.title}</h5>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {level.idea}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#fff', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--warning)' }}>Your task:</strong> {level.task}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <button onClick={() => setActiveTab(level.tab)} className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                        {level.buttonText}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                      {needed > 1 && (
                        <span style={{ fontSize: '0.78rem', color: met > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                          Progress: {met}/{needed}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{XP_PER_LEVEL} XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
};
export default Journey;
