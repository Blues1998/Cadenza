import React from 'react';
import type { ActiveTab } from '../components/Sidebar';
import { Journey } from '../components/Journey';
import { GuitarLineArt } from '../components/GuitarLineArt';

interface DashboardLandingProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const DashboardLanding: React.FC<DashboardLandingProps> = ({ setActiveTab }) => {
  const learningPaths = [
    {
      id: 'theory' as ActiveTab,
      title: 'Visual Theory & Scales',
      description: 'Explore scale layouts and chords on the guitar fretboard and piano. Interactive Circle of Fifths diagrams included.',
      buttonText: 'Open Theory Lab',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />
        </svg>
      )
    },
    {
      id: 'rhythm' as ActiveTab,
      title: 'Rhythm Metronome & Game',
      description: 'Test your timing precision against a rock-solid, low-latency audio metronome. Get millisecond-accuracy feedback.',
      buttonText: 'Open Rhythm Lab',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Hero. Eyebrow, name, one sentence — then the instrument the whole app
          is pointed at, with a line drawing behind it doing the decorating so
          the chrome does not have to. */}
      <div className="glass-panel hero">
        <div className="hero-copy">
          <span className="hero-eyebrow readout">Welcome to your</span>
          <h2 className="hero-title">
            Cadenza <span>Lab</span>
          </h2>
          <p className="hero-lede">
            No music experience required. Follow the guided journey below — each level is one idea
            learned by playing, and completes automatically the moment you do it.
          </p>
        </div>

        <div className="hero-aside">
          <GuitarLineArt className="hero-guitar" />
          <div className="hero-focus">
            <span className="hero-eyebrow readout">Focus instrument</span>
            <button type="button" className="hero-focus-link" onClick={() => setActiveTab('theory')}>
              Acoustic Guitar
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <span className="hero-focus-verbs readout">Strum · Learn · Play</span>
          </div>
        </div>
      </div>

      {/* Guided Journey — auto-tracked curriculum across all labs */}
      <Journey setActiveTab={setActiveTab} />

      {/* Quick Overview Section */}
      <div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Explore Labs Individually</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {learningPaths.map((path) => (
            <div
              key={path.id}
              className="glass-panel path-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {path.icon}
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{path.title}</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1 }}>{path.description}</p>
              <button 
                onClick={() => setActiveTab(path.id)} 
                className="btn"
                style={{ 
                  background: 'var(--surface-2)', 
                  borderColor: 'var(--surface-3)',
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
