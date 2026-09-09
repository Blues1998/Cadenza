// September's tracker, as it stands in the workbook this app replaces.
//
// This is real practice history, not sample data — eight songs entered, two
// finished, 860 minutes, confidence still low on the recent ones. It is
// written in once, on the first run on a machine, so the app opens on the
// month already in progress rather than on an empty shell. After that it is
// ordinary library data: editable, exportable, and never written again.
//
// Kept verbatim where the workbook was verbatim. The chord lines in
// particular are left exactly as they were typed — the bars separating verse
// from chorus, the mixed "A min" and "Am" spellings, the aside on the last
// chord of Lo Maan Liya. songText.ts is what reads them.

import type { Challenge, Song } from '../utils/library';

const CHALLENGE_ID = 'challenge-september-2026';

// Day 1 is 1 September; the tracker's dates run consecutively from there.
const DAY_ONE = '2026-09-01';

const dateForDay = (day: number): string => {
  const d = new Date(2026, 8, day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// A plausible moment inside the day it happened, so the records sort sensibly
// against sessions logged later with real clock times.
const stampFor = (day: number): number => new Date(2026, 8, day, 20, 0, 0).getTime();

interface SeedRow {
  day: number;
  title: string;
  artist: string;
  key: string;
  capo: number;
  chordsRaw: string;
  status: Song['status'];
  practiceMinutes: number;
  confidence: number;
  strumming: string;
}

const ROWS: SeedRow[] = [
  {
    day: 1,
    title: 'Sitaare',
    artist: 'Arijit Singh',
    key: 'B♭ minor',
    capo: 1,
    chordsRaw: 'A min → F maj → G maj → E maj',
    status: 'complete',
    practiceMinutes: 60,
    confidence: 8,
    strumming: 'DD UUD DDU'
  },
  {
    day: 2,
    title: 'Tera Mera Rishta',
    artist: 'Mustafa Zahid',
    key: 'E minor',
    capo: 0,
    chordsRaw: 'Em → D → C → Em',
    status: 'complete',
    practiceMinutes: 600,
    confidence: 7,
    strumming: 'DD UUD DDU'
  },
  {
    day: 3,
    title: 'Labon Ko',
    artist: 'KK',
    key: 'A minor',
    capo: 0,
    chordsRaw: 'A min → G maj → F maj | E maj → D min → G maj',
    status: 'learning',
    practiceMinutes: 60,
    confidence: 5,
    strumming: 'DD UUD DDU'
  },
  {
    day: 4,
    title: 'Kabhi Jo Badal Barse',
    artist: 'Arijit Singh',
    key: 'C minor',
    capo: 3,
    chordsRaw: 'A min → G maj → F maj → G maj | A min → G maj → E min | D min → G maj → F maj',
    status: 'learning',
    practiceMinutes: 60,
    confidence: 5,
    strumming: 'DD UUD DDU'
  },
  {
    day: 5,
    title: 'Toh Fir Aao',
    artist: 'Mustafa Zahid',
    key: 'A minor',
    capo: 0,
    chordsRaw: 'A min → G maj → F maj',
    status: 'learning',
    practiceMinutes: 30,
    confidence: 3,
    strumming: 'DD UUD DDU'
  },
  {
    day: 6,
    title: 'Jo Tum Mere Ho',
    artist: 'Anuv Jain',
    key: 'A minor',
    capo: 4,
    chordsRaw: 'A min → E min → F maj → G maj',
    status: 'learning',
    practiceMinutes: 5,
    confidence: 3,
    strumming: 'DD UUD DDU'
  },
  {
    day: 7,
    title: 'Lo Maan Liya',
    artist: 'Arijit Singh',
    key: 'F♯ minor',
    capo: 2,
    chordsRaw: 'E min -> C maj -> B7 -> E min | E min -> A min -> B7 -> E min | E min -> C -> B7 -> G(single strum)',
    status: 'learning',
    practiceMinutes: 30,
    confidence: 2,
    strumming: 'D/ DU/'
  },
  {
    day: 8,
    title: 'Tu Har Lamha',
    artist: 'Arijit Singh',
    key: 'D minor',
    capo: 5,
    chordsRaw: 'A min -> E min -> F maj -> G maj | C maj -> E min -> F maj > C maj -> G maj',
    status: 'learning',
    practiceMinutes: 15,
    confidence: 2,
    strumming: ''
  }
];

export const SEED_SONGS: Song[] = ROWS.map(row => ({
  id: `sep-${String(row.day).padStart(2, '0')}`,
  title: row.title,
  artist: row.artist,
  day: row.day,
  date: dateForDay(row.day),
  key: row.key,
  capo: row.capo,
  chordsRaw: row.chordsRaw,
  strumming: row.strumming,
  status: row.status,
  confidence: row.confidence,
  practiceMinutes: row.practiceMinutes,
  notes: '',
  revisit: false,
  // No charts in the seed. The words to these are the user's to type; the app
  // ships the tool, not anybody's lyrics.
  chart: null,
  createdAt: stampFor(row.day),
  updatedAt: stampFor(row.day)
}));

export const SEED_CHALLENGE: Challenge = {
  id: CHALLENGE_ID,
  name: 'September · Song a Day',
  startDate: DAY_ONE,
  endDate: dateForDay(30),
  dayCount: 30
};
