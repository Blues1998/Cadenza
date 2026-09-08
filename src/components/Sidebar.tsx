import React, { useEffect, useRef, useState } from 'react';
import type { Theme } from '../hooks/useTheme';
import type { ActiveTab } from './navGroups';
import { IconSun, IconMoon } from './Icons';
import { GROUPS } from './navGroups';

export type { ActiveTab } from './navGroups';


interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

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
