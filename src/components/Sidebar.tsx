import React, { useState } from 'react';

export type ActiveTab = 'dashboard' | 'ear-training' | 'theory' | 'play' | 'physics' | 'rhythm' | 'tuner' | 'tabs';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  // Collapsed = icon-only rail; the preference persists across sessions
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1');
      } catch { /* private browsing */ }
      return !prev;
    });
  };

  const menuItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    {
      id: 'ear-training' as ActiveTab,
      label: 'Ear Training',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      )
    },
    {
      id: 'theory' as ActiveTab,
      label: 'Theory & Scales',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    },
    {
      id: 'play' as ActiveTab,
      label: 'Play Challenges',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    },
    {
      id: 'physics' as ActiveTab,
      label: 'Sound Physics',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />
        </svg>
      )
    },
    {
      id: 'rhythm' as ActiveTab,
      label: 'Rhythm Lab',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      id: 'tuner' as ActiveTab,
      label: 'Pitch & Tuner',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    },
    {
      id: 'tabs' as ActiveTab,
      label: 'Tab Player',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )
    }
  ];

  return (
    <aside className="glass-panel" style={{ width: collapsed ? '76px' : '260px', padding: collapsed ? '2rem 0.6rem' : '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRight: '1px solid var(--panel-border)', borderRadius: '0 16px 16px 0', height: '100vh', position: 'sticky', top: 0, left: 0, transition: 'width 0.2s ease, padding 0.2s ease', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: collapsed ? 0 : '0.75rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div
          onClick={toggleCollapsed}
          role="button"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0, 240, 255, 0.3)', cursor: 'pointer' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#030406" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        {!collapsed && (
          <div style={{ whiteSpace: 'nowrap' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>CADENZA</h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Music Lab</span>
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="btn"
              title={item.label}
              style={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
                padding: collapsed ? '0.6rem 0' : undefined,
                background: isActive ? 'rgba(0, 240, 255, 0.06)' : 'transparent',
                borderColor: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 12px rgba(0, 240, 255, 0.1)' : 'none',
              }}
            >
              <span style={{ color: isActive ? 'var(--primary)' : 'inherit', display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div title="Audio Engine Ready" style={{ padding: collapsed ? '0.6rem 0' : '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: collapsed ? 'center' : 'stretch' }}>
        {!collapsed && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status:</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success-glow)', flexShrink: 0 }}></span>
          {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>Audio Engine Ready</span>}
        </div>
      </div>
    </aside>
  );
};
