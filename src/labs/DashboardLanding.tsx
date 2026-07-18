import React from 'react';
import type { ActiveTab } from '../components/Sidebar';

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
            Welcome back to <span style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cadenza Lab</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Your personal dashboard for learning guitar fretboard geography, relative pitch training, metronome speed building, and vocal singing accuracy.
          </p>
        </div>
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Focus Instrument</span>
          <h3 style={{ color: 'var(--primary)', marginTop: '0.2rem', fontSize: '1.25rem' }}>Acoustic Guitar 🎸</h3>
        </div>
      </div>

      {/* Quick Overview Section */}
      <div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Active Training Modules</h3>
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
