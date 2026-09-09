import React from 'react';

// The rail's contents, kept out of Sidebar.tsx so that both the sidebar and
// the phone swipe gesture can read the same structure without a component
// file having to export a constant — which breaks Fast Refresh.
export type ActiveTab = 'dashboard' | 'journey' | 'ear-training' | 'theory' | 'play' | 'physics' | 'rhythm' | 'tuner' | 'tabs' | 'songs' | 'library' | 'chordbook';

const icon = (path: React.ReactNode) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

// Ten destinations in one undifferentiated column read as a pile. Grouped by
// what you are actually doing — reading about it, drilling it, or playing —
// the rail becomes three short lists, which is a length the eye can take in
// without scanning.
export const GROUPS: { name?: string; items: { id: ActiveTab; label: string; icon: React.ReactNode }[] }[] = [
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
      // First in the group: the month's songs are what practice actually is,
      // and the drills below are what you reach for when one of them is
      // fighting you.
      { id: 'library', label: 'Songs', icon: icon(<><line x1="3" y1="6" x2="16" y2="6" /><line x1="3" y1="12" x2="12" y2="12" /><line x1="3" y1="18" x2="12" y2="18" /><path d="M21 15V5l-4 1" /><circle cx="18.5" cy="16" r="2.5" /></>) },
      // A chord box: the nut, three strings, and three fingers on it. The dots
      // are last in the markup and separate from the grid so they can land on
      // it one at a time.
      { id: 'chordbook', label: 'Chords', icon: icon(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="6" y1="6" x2="6" y2="19" /><line x1="12" y1="6" x2="12" y2="19" /><line x1="18" y1="6" x2="18" y2="19" /><circle cx="6" cy="11" r="1.7" fill="currentColor" stroke="none" /><circle cx="18" cy="11" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none" /></>) },
      // Band, then the near cup, then the far one — three paths rather than
      // the usual two, because a pulse cannot travel across a pair of cups
      // drawn as one shape.
      { id: 'ear-training', label: 'Ear Training', icon: icon(<><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /></>) },
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
