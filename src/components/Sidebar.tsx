import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Theme } from '../hooks/useTheme';
import type { ActiveTab } from './navGroups';
import { IconSun, IconMoon } from './Icons';
import { GROUPS } from './navGroups';
import { preloadLab } from '../labs/chunks';

export type { ActiveTab } from './navGroups';


interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

// A row can be running several animations at once — the target's three rings,
// the pulse crossing the headphones — and animationend bubbles up from each of
// them. Only the colour flash ends the flash: every row has one, they are all
// cut to the same length, and taking the class off on the first one to finish
// would dock whatever else was still moving.
const FLASH_CLOCK = 'channelIconFlash';

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

  // The live channel's plate is one element that travels, rather than a
  // background and an orange bar switching off in one row and on in another.
  // Measured off the button itself so the same code serves the vertical rail
  // and the horizontal bar a phone gets — there the plate slides sideways.
  const [plate, setPlate] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // The first placement is a jump. Without this the plate would fly in from
  // the corner of the rail every time the app loads.
  const placed = useRef(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        setPlate(null);
        return;
      }
      setPlate({ x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight });
    };

    measure();
    // The rail changes width when it collapses, the labels reflow when a web
    // font lands, and the bar rewraps when a phone is turned. A plate measured
    // against the old geometry would sit off its row.
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    // The groups and the rows, by selector rather than by walking children —
    // the plate is a child of the nav too, and observing the thing this
    // measurement moves would have it chasing itself.
    for (const el of nav.querySelectorAll('.channel-group, .channel')) observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab, collapsed]);

  useLayoutEffect(() => {
    if (plate) placed.current = true;
  }, [plate]);

  // Entering a row flashes its icon. Driven by a class the row keeps until the
  // animation reports itself finished, rather than by :hover — hung off :hover
  // it is cancelled the instant the pointer leaves, and sweeping down the rail
  // cuts every icon from full orange back to grey mid-flash. A flash is
  // something that happened, not a state the pointer is holding open, so it
  // gets to finish. Several can be running at once, which is what a sweep
  // should look like.
  const [flashing, setFlashing] = useState<ReadonlySet<ActiveTab>>(new Set());

  const startFlash = (id: ActiveTab) => {
    setFlashing(prev => {
      if (prev.has(id)) return prev;   // already running; do not stack
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Pointing at a row is most of a decision, so the lab starts downloading
  // here rather than on the press. By the time the button goes down the screen
  // is usually already in memory and the loading line never appears.
  const enter = (id: ActiveTab) => {
    startFlash(id);
    preloadLab(id);
  };

  const endFlash = (id: ActiveTab) => {
    setFlashing(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

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
        {plate && (
          <span
            className={`channel-plate${placed.current ? ' is-placed' : ''}`}
            style={{ transform: `translate(${plate.x}px, ${plate.y}px)`, width: `${plate.w}px`, height: `${plate.h}px` }}
            aria-hidden="true"
          />
        )}
        {GROUPS.map((group, i) => (
          <div className="channel-group" key={group.name ?? i}>
            {group.name && <span className="channel-group-label">{group.name}</span>}
            {group.items.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`channel${isActive ? ' is-live' : ''}${flashing.has(item.id) ? ' is-flashing' : ''}`}
                  onMouseEnter={() => enter(item.id)}
                  onFocus={() => preloadLab(item.id)}
                  onAnimationEnd={e => {
                    if (e.animationName === FLASH_CLOCK) endFlash(item.id);
                  }}
                  title={item.label}
                  data-nav={item.id}
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
