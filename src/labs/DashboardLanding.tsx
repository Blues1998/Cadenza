import React, { useState } from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { audio } from '../utils/audio';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  actionText: string;
  targetTab: ActiveTab;
  isCompleted: boolean;
}

export const DashboardLanding: React.FC<DashboardLandingProps> = ({ setActiveTab }) => {
  // Load quests status from localStorage, default to new checklist
  const [quests, setQuests] = useState<Quest[]>(() => {
    const saved = localStorage.getItem('cadenza_quests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved quests:', e);
      }
    }
    return [
      {
        id: 'tuning',
        title: 'Quest 1: The Tuning Challenge 🎸',
        description: 'Tune your guitar strings (E2, A2, D3, G3, B3, E4) or hum clean notes. Open the Tuner, allow microphone access, and get the needle in the green!',
        actionText: 'Launch Pitch Tuner',
        targetTab: 'tuner',
        isCompleted: false
      },
      {
        id: 'middle_c',
        title: 'Quest 2: Locate Middle C 🔍',
        description: 'Find and play C4 (Middle C) in the Theory Lab. Click the key labeled C4 on the virtual piano or fret 3 on the 5th string (A) of the fretboard.',
        actionText: 'Open Theory Explorer',
        targetTab: 'theory',
        isCompleted: false
      },
      {
        id: 'happy_sad',
        title: 'Quest 3: Happy or Sad? 🎭',
        description: 'Test your musical intuition. Open the Ear Training Lab, select "Super Beginner" difficulty, and identify 5 happy (Major) vs sad (Minor) chords in a row.',
        actionText: 'Start Ear Training',
        targetTab: 'ear-training',
        isCompleted: false
      },
      {
        id: 'tapping_100',
        title: 'Quest 4: The 100 BPM Challenge ⏱️',
        description: 'Practice timing accuracy. Set the metronome to 100 BPM in Rhythm Lab, turn on "Game" mode, and press Spacebar to match the beats.',
        actionText: 'Open Rhythm Lab',
        targetTab: 'rhythm',
        isCompleted: false
      }
    ];
  });

  const toggleQuest = (id: string) => {
    audio.init();
    const updated = quests.map(q => q.id === id ? { ...q, isCompleted: !q.isCompleted } : q);
    setQuests(updated);
    localStorage.setItem('cadenza_quests', JSON.stringify(updated));

    // Play a satisfying major arpeggio chime if a quest is marked completed
    const quest = updated.find(q => q.id === id);
    if (quest?.isCompleted) {
      const now = audio.getCurrentTime();
      // E4 -> G#4 -> B4 -> E5 arpeggio
      audio.playMidi(64, 0.25, now);
      audio.playMidi(68, 0.25, now + 0.08);
      audio.playMidi(71, 0.25, now + 0.16);
      audio.playMidi(76, 0.5, now + 0.24);
    }
  };

  const completedCount = quests.filter(q => q.isCompleted).length;
  const progressPercentage = Math.round((completedCount / quests.length) * 100);

  const learningPaths = [
    {
      id: 'theory' as ActiveTab,
      title: 'Visual Theory & Scales',
      description: 'Explore scale layouts and chords on the guitar fretboard and piano. Interactive Circle of Fifths diagrams included.',
      buttonText: 'Open Theory Lab',
      color: 'var(--primary)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    },
    {
      id: 'ear-training' as ActiveTab,
      title: 'Ear Training (Chords & Intervals)',
      description: 'Train your ears to recognize musical relationships. Quizzes adapt dynamically across multiple difficulty ranges.',
      buttonText: 'Start Training',
      color: 'var(--secondary)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      )
    },
    {
      id: 'play' as ActiveTab,
      title: 'Play Challenges (Mic-Verified)',
      description: 'Play scales, intervals, and chords on your real instrument — the app hears every note and confirms it live. Theory you play, not memorize.',
      buttonText: 'Start Playing',
      color: '#f472b6',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    },
    {
      id: 'physics' as ActiveTab,
      title: 'Sound Physics',
      description: 'Why chords work, why 12 notes, why the circle of fifths exists — interactive waveforms, beating tones, and modular arithmetic instead of memorization.',
      buttonText: 'See the Physics',
      color: '#38bdf8',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />
        </svg>
      )
    },
    {
      id: 'rhythm' as ActiveTab,
      title: 'Rhythm Metronome & Game',
      description: 'Test your timing precision against a rock-solid, low-latency audio metronome. Get millisecond-accuracy feedback.',
      buttonText: 'Open Rhythm Lab',
      color: 'var(--success)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      id: 'tuner' as ActiveTab,
      title: 'Vocal Tuner & Matcher',
      description: 'Interactive singing exercises using autocorrelation real-time pitch detection. Great for guitar tuning too.',
      buttonText: 'Launch Tuner',
      color: 'var(--warning)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '2.5rem', 
          background: 'linear-gradient(135deg, rgba(18, 22, 33, 0.6) 0%, rgba(139, 92, 246, 0.08) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.2 }}>
            Welcome to your <span style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cadenza Lab</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            No music experience required. Follow the guided quests below to learn notes on your guitar fretboard, train your ears, and master rhythm.
          </p>
        </div>
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Focus Instrument</span>
          <h3 style={{ color: 'var(--primary)', marginTop: '0.2rem', fontSize: '1.25rem' }}>Acoustic Guitar 🎸</h3>
        </div>
      </div>

      {/* Beginner Quests checklist */}
      <section className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Beginner Training Quests</span>
              <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                {completedCount} of {quests.length} Completed
              </span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Complete these hands-on challenges to learn the basics of guitar playing and music theory.
            </p>
          </div>
          
          {/* Progress bar */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Total Progress:</span>
              <strong>{progressPercentage}%</strong>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercentage}%`, height: '100%', background: 'var(--success)', boxShadow: '0 0 8px var(--success-glow)', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        </div>

        {/* Quests Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {quests.map((quest) => (
            <div
              key={quest.id}
              className="glass-card"
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                cursor: 'default',
                background: quest.isCompleted ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255,255,255,0.01)',
                borderColor: quest.isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                transform: 'none'
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleQuest(quest.id)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: quest.isCompleted ? 'var(--success)' : 'transparent',
                  border: quest.isCompleted ? '1px solid var(--success)' : '2px solid var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
                title={quest.isCompleted ? 'Mark Incomplete' : 'Mark Completed'}
              >
                {quest.isCompleted && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#030406" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Card Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <h4 style={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  textDecoration: quest.isCompleted ? 'line-through' : 'none',
                  color: quest.isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)'
                }}>
                  {quest.title}
                </h4>
                <p style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: 1.4,
                  opacity: quest.isCompleted ? 0.6 : 1
                }}>
                  {quest.description}
                </p>
                
                {/* Navigation CTA button */}
                <button
                  onClick={() => setActiveTab(quest.targetTab)}
                  className="btn"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    width: 'fit-content',
                    marginTop: '0.25rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {quest.actionText}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Overview Section */}
      <div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Explore Labs Individually</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {learningPaths.map((path) => (
            <div 
              key={path.id} 
              className="glass-panel" 
              style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem', 
                transition: 'transform 0.2s ease, border-color 0.2s ease' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = path.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--panel-border)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {path.icon}
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{path.title}</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1 }}>{path.description}</p>
              <button 
                onClick={() => setActiveTab(path.id)} 
                className="btn"
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  borderColor: 'rgba(255,255,255,0.08)',
                  justifyContent: 'center',
                  fontSize: '0.85rem'
                }}
              >
                {path.buttonText}
              </button>
            </div>
          ))}

        </div>
      </div>

      {/* Guitar Practice Tips Card */}
      <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '2.5rem' }}>💡</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h4 style={{ fontWeight: 600 }}>Guitar Training Tip of the Day</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Match ear training with neck positions. When guessing intervals in the Ear Training Lab, observe the illuminated notes on the virtual fretboard below to connect physical fret patterns with acoustic pitch gaps!
          </p>
        </div>
      </section>

    </div>
  );
};
export default DashboardLanding;
