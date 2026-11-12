import React from 'react';
import type { ActiveTab } from '../utils/route';

// The rail's contents, kept out of Sidebar.tsx so that both the sidebar and
// the phone swipe gesture can read the same structure without a component
// file having to export a constant, which breaks Fast Refresh.
//
// The destinations themselves are declared next to the addresses they answer
// to, and re-exported from here because this is where the rest of the app has
// always taken them from.
export type { ActiveTab };

const icon = (path: React.ReactNode) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

// Five places, the way a phone app is shaped: what to do today, your songs,
// practice, the tuner, and you. Everything that used to be its own rail entry
//chords, rhythm, ear training, challenges, the journey, theory, lives under
// Practice now, grouped by whether it trains your hands and ears or explains
// why. Twelve equal entries made a new player choose before they had been
// helped; five are a map.
//
// GROUPS is the whole catalogue (search, page icons and labels read it). The
// first group is the main navigation; the named groups are Practice's
// contents; Tools are reachable but not navigation.
type Item = { id: ActiveTab; label: string; icon: React.ReactNode; blurb?: string };

export const GROUPS: { name?: string; items: Item[] }[] = [
  {
    items: [
      { id: 'dashboard', label: 'Today', icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) },
      { id: 'library', label: 'Songs', icon: icon(<><line x1="3" y1="6" x2="16" y2="6" /><line x1="3" y1="12" x2="12" y2="12" /><line x1="3" y1="18" x2="12" y2="18" /><path d="M21 15V5l-4 1" /><circle cx="18.5" cy="16" r="2.5" /></>) },
      // A target: practice is aiming at something.
      { id: 'practice', label: 'Practice', icon: icon(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>) },
      { id: 'tuner', label: 'Tuner', icon: icon(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" /></>) },
      { id: 'me', label: 'Me', icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>) }
    ]
  },
  {
    name: 'Drills',
    items: [
      // A chord box: the nut, three strings, and three fingers on it.
      { id: 'chordbook', label: 'Chords', blurb: 'Rate the chords your songs need, and drill the changes', icon: icon(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="6" y1="6" x2="6" y2="19" /><line x1="12" y1="6" x2="12" y2="19" /><line x1="18" y1="6" x2="18" y2="19" /><circle cx="6" cy="11" r="1.7" fill="currentColor" stroke="none" /><circle cx="18" cy="11" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none" /></>) },
      { id: 'rhythm', label: 'Rhythm', blurb: 'Metronome, strumming groove and timing practice', icon: icon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>) },
      // Band, then the near cup, then the far one.
      { id: 'ear-training', label: 'Ear Training', blurb: 'Hear an interval or a chord and name it', icon: icon(<><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /></>) },
      { id: 'play', label: 'Challenges', blurb: 'Play scales and intervals; the mic checks you', icon: icon(<><polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9 12 2" /></>) }
    ]
  },
  {
    name: 'Understand',
    items: [
      { id: 'journey', label: 'Journey', blurb: 'Fifteen short steps from your first note to the beat', icon: icon(<><path d="M4 20h4l4-16h4" /><circle cx="19" cy="4" r="2" /><circle cx="5" cy="20" r="2" /></>) },
      { id: 'theory', label: 'Theory', blurb: 'Scales, keys and the chords that belong together', icon: icon(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>) },
      { id: 'physics', label: 'Sound Physics', blurb: 'Why notes sound the way they do, and why some agree', icon: icon(<polyline points="2 12 5 12 8 4 12 20 15 9 17 12 22 12" />) }
    ]
  },
  {
    name: 'Tools',
    items: [
      { id: 'tabs', label: 'Tab Player', blurb: 'Open a Guitar Pro or MusicXML file', icon: icon(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>) }
    ]
  }
];

/** The main navigation: the tab bar on a phone, the rail on a desktop. */
export const PRIMARY = GROUPS[0].items;

/** What Practice holds, in its groups. */
export const PRACTICE_GROUPS = GROUPS.filter(group => group.name === 'Drills' || group.name === 'Understand');

const ALL = GROUPS.flatMap(group => group.items);
export const navItem = (id: ActiveTab): Item => ALL.find(item => item.id === id)!;

/** Which of the five a page sits under, what the nav shows as current. */
export function parentTab(tab: ActiveTab): ActiveTab {
  if (PRIMARY.some(item => item.id === tab)) return tab;
  if (tab === 'tabs') return 'library';
  return 'practice';
}
