import React, { useEffect, useRef, useState } from 'react';
import type { Theme } from '../hooks/useTheme';
import { IconSun, IconMoon } from './Icons';

export type ActiveTab = 'dashboard' | 'journey' | 'ear-training' | 'theory' | 'play' | 'physics' | 'rhythm' | 'tuner' | 'tabs' | 'songs';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

const icon = (path: React.ReactNode) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

// Ten destinations in one undifferentiated column read as a pile. Grouped by
// what you are actually doing — reading about it, drilling it, or playing —
// the rail becomes three short lists, which is a length the eye can take in
// without scanning.
const GROUPS: { name?: string; items: { id: ActiveTab; label: string; icon: React.ReactNode }[] }[] = [
  {
    items: [
      { id: 'dashboard', label: 'Home', icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) }
    ]
  },
  {
    name: 'Learn',
    items: [
      { id: 'journey', label: 'Journey', icon: icon(<><path d="M4 20h4l4-16h4" /><circle cx="19" cy="4" r="2" /><circle cx="5" cy="20" r="2" /></>) },
      { id: 'theory', label: 'Theory', icon: icon(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>) },
      { id: 'physics', label: 'Physics', icon: icon(<polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />) }
    ]
  },
  {
    name: 'Practice',
    items: [
      { id: 'ear-training', label: 'Ear Training', icon: icon(<><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>) },
      { id: 'rhythm', label: 'Rhythm', icon: icon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>) },
      { id: 'tuner', label: 'Tuner', icon: icon(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" /></>) }
    ]
  },
  {
    name: 'Play',
    items: [
      { id: 'play', label: 'Challenges', icon: icon(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>) },
      { id: 'tabs', label: 'Tabs', icon: icon(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>) },
      { id: 'songs', label: 'Song Hero', icon: icon(<polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9 12 2" />) }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, theme, toggleTheme }) => {
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

  // When the nav is the horizontal bar used on narrow screens it can scroll
  // past the active item, leaving no on-screen sign of which lab you are in.
  // Only nudge it when it actually scrolls, so the vertical desktop rail is
  // left alone.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;
    active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeTab]);

  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
      {/* Logo plate — a square silk-screened badge, the way a desk carries the
          manufacturer's mark above the channels. Doubles as the collapse
          control, as it always has. */}
      <div className="console-brand">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="console-plate"
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>
        {!collapsed && <h1 className="console-wordmark">CADENZA</h1>}
      </div>

      {/* Channels. Only the live one is marked — a single orange bar down its
          left edge. Collapsed, the group headings become hairlines: the
          grouping survives, the words do not. */}
      <nav className="sidebar-nav" ref={navRef}>
        {GROUPS.map((group, i) => (
          <div className="channel-group" key={group.name ?? i}>
            {group.name && <span className="channel-group-label">{group.name}</span>}
            {group.items.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`channel${isActive ? ' is-live' : ''}`}
                  title={item.label}
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="channel-icon">{item.icon}</span>
                  {!collapsed && <span className="channel-label">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        onClick={toggleTheme}
        className="theme-toggle"
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{ alignSelf: collapsed ? 'center' : 'flex-start' }}
      >
        {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
      </button>
    </aside>
  );
};
