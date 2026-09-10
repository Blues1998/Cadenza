// Where you are, written down somewhere the browser can see it.
//
// Everything lives behind a hash. The built site is served from a project
// subpath on GitHub Pages with no server-side rewriting, so a real path like
// /theory would 404 on reload — the one moment an address most needs to work.
// A hash never reaches a server, so refresh, Back and a pasted link all behave
// the same whether the app is on Pages, on a file:// copy, or on localhost.
//
// The slugs are not the internal tab ids. Two of the ids read as the wrong
// thing in an address bar — 'library' is the song list and 'songs' is the
// rhythm game — and an address is something people read.

import type { ActiveTab } from '../components/navGroups';

export interface Route {
  tab: ActiveTab;
  /** Only ever set on the songs route: which song is open. */
  songId: string | null;
}

export const HOME: Route = { tab: 'dashboard', songId: null };

// Exhaustive by type rather than by care: adding a destination to the rail
// without giving it an address stops the build.
const SLUG: Record<ActiveTab, string> = {
  dashboard: 'home',
  journey: 'journey',
  theory: 'theory',
  physics: 'physics',
  library: 'songs',
  chordbook: 'chords',
  'ear-training': 'ear-training',
  rhythm: 'rhythm',
  tuner: 'tuner',
  play: 'challenges',
  tabs: 'tabs',
  songs: 'song-hero'
};

const TAB_BY_SLUG = new Map<string, ActiveTab>(
  (Object.entries(SLUG) as [ActiveTab, string][]).map(([tab, slug]) => [slug, tab])
);

// A song id is ours — a timestamp and some random — but it is decoded on the
// way back in, and anything at all can be typed into an address bar.
const decode = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

export function toHash(route: Route): string {
  const slug = SLUG[route.tab];
  return route.tab === 'library' && route.songId
    ? `#/${slug}/${encodeURIComponent(route.songId)}`
    : `#/${slug}`;
}

/**
 * An address, however it arrives, as somewhere to be.
 *
 * Anything unreadable resolves to Home rather than to a blank screen: a stale
 * bookmark from before a rename is a wrong address, not an error, and the app
 * tidies the bar to match what it actually showed you.
 */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const tab = parts[0] ? TAB_BY_SLUG.get(decode(parts[0]).toLowerCase()) : undefined;
  if (!tab) return HOME;
  return {
    tab,
    songId: tab === 'library' && parts[1] ? decode(parts[1]) : null
  };
}
