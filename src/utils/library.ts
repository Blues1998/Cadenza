// The song library, the practice log, and the challenge that ties them
// together. This is the whole domain: no React, no DOM, no formatting — so the
// same store can back a different screen later, or sync to something remote,
// without any of that leaking in here.
//
// Three entities, deliberately separate:
//
//   Song      what you are learning         (one per row of the tracker)
//   Session   one sitting at the guitar     (one per row of the practice log)
//   Challenge the month-long frame          (September, thirty days)
//
// The one relationship worth stating out loud is between a song's day and the
// challenge. A challenge could keep its own day → song index, and the spec
// asked for one, but then the same fact is written in two places and they can
// disagree the first time a song is moved to another day. The song's `day` is
// the single authority; `assignmentsFor` below derives the index on demand.
//
// The other is practice minutes. A song carries `practiceMinutes` — the total
// that came in from the tracker before sessions existed — and sessions add to
// it. Nothing ever folds a session back into that number, so the two can be
// summed without double counting, and an imported total is never mistaken for
// a session that was actually logged.

import { clearStore, deleteRecord, putRecords, readAll, storageKind } from './db';
import { parseProgressions, uniqueChords } from './songText';
import { SEED_CHALLENGE, SEED_SONGS } from '../data/septemberSeed';

export type SongStatus = 'learning' | 'playable' | 'solid' | 'complete';

export const STATUS_LABEL: Record<SongStatus, string> = {
  learning: 'Learning',
  playable: 'Playable',
  solid: 'Solid',
  complete: 'Complete'
};

export const STATUS_ORDER: SongStatus[] = ['learning', 'playable', 'solid', 'complete'];

export interface Song {
  id: string;
  title: string;
  artist: string;
  /** Day of the challenge this song sits on, 1-based. null = in the library but not on the calendar. */
  day: number | null;
  /** ISO yyyy-mm-dd of that day, kept alongside so a song still has a date if the challenge is deleted. */
  date: string | null;
  key: string;
  capo: number | null;
  /** As typed: "A min -> E min | C maj -> G maj". Parsed on read, never on write. */
  chordsRaw: string;
  strumming: string;
  status: SongStatus;
  confidence: number;      // 0–10
  practiceMinutes: number; // imported baseline; sessions are counted on top
  notes: string;
  revisit: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PracticeSession {
  id: string;
  songId: string;
  date: string;          // ISO yyyy-mm-dd, local
  startedAt: number;     // epoch ms
  sessionNumber: number; // per song, 1-based — the practice log's "Session #"
  minutes: number;
  chordsNote: string;
  strummingNote: string;
  singingNote: string;
  problemArea: string;
  nextAction: string;
}

export interface Challenge {
  id: string;
  name: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;   // ISO yyyy-mm-dd
  dayCount: number;
}

const CHANGE_EVENT = 'cadenza-library-change';
const SEEDED_SETTING = 'seeded-september';

interface Setting { id: string; value: unknown }

// ---------------------------------------------------------------------------
// Dates. Everything is local — a practice session belongs to the day you were
// sitting in, not to whatever UTC thought at the time.
// ---------------------------------------------------------------------------

export function isoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const dayDiff = (a: string, b: string): number =>
  Math.round((dateFromIso(a).getTime() - dateFromIso(b).getTime()) / 86400000);

export const today = (): string => isoDate();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let songs: Song[] = [];
let sessions: PracticeSession[] = [];
let challenge: Challenge | null = null;
let ready = false;
let readyPromise: Promise<void> | null = null;
let kind: 'indexeddb' | 'local' = 'indexeddb';

const announce = () => window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

export function subscribeLibrary(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

export const isReady = (): boolean => ready;
export const storageLabel = (): string => (kind === 'indexeddb' ? 'IndexedDB' : 'Local storage');

const newId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
};

export function initLibrary(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    kind = await storageKind();
    const [loadedSongs, loadedSessions, loadedChallenges, settings] = await Promise.all([
      readAll<Song>('songs'),
      readAll<PracticeSession>('sessions'),
      readAll<Challenge>('challenges'),
      readAll<Setting>('settings')
    ]);
    songs = loadedSongs;
    sessions = loadedSessions;
    challenge = loadedChallenges[0] ?? null;

    // First run on this machine: bring in the September tracker, so the app
    // opens on the real month rather than on an empty shell that has to be
    // typed back in. Flagged in settings, so clearing the library on purpose
    // does not silently refill it.
    const seeded = settings.find(s => s.id === SEEDED_SETTING);
    if (!seeded && songs.length === 0 && !challenge) {
      songs = SEED_SONGS.map(s => ({ ...s }));
      challenge = { ...SEED_CHALLENGE };
      await Promise.all([
        putRecords('songs', songs),
        putRecords('challenges', [challenge]),
        putRecords('settings', [{ id: SEEDED_SETTING, value: true }])
      ]);
    }
    ready = true;
    announce();
  })();
  return readyPromise;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export const getSongs = (): Song[] => songs;
export const getSessions = (): PracticeSession[] => sessions;
export const getChallenge = (): Challenge | null => challenge;
export const getSong = (id: string): Song | undefined => songs.find(s => s.id === id);

export const sessionsForSong = (songId: string): PracticeSession[] =>
  sessions.filter(s => s.songId === songId).sort((a, b) => b.startedAt - a.startedAt);

/** Minutes logged in sessions, on top of whatever the tracker already carried. */
export const sessionMinutes = (songId: string): number =>
  sessions.filter(s => s.songId === songId).reduce((sum, s) => sum + s.minutes, 0);

export const totalMinutes = (song: Song): number => song.practiceMinutes + sessionMinutes(song.id);

export const minutesOn = (songId: string, date: string): number =>
  sessions.filter(s => s.songId === songId && s.date === date).reduce((sum, s) => sum + s.minutes, 0);

/** day → song, derived rather than stored. See the note at the top of the file. */
export function assignmentsFor(c: Challenge | null = challenge): (Song | null)[] {
  const count = c?.dayCount ?? 0;
  const byDay: (Song | null)[] = Array.from({ length: count }, () => null);
  for (const song of songs) {
    if (song.day && song.day >= 1 && song.day <= count) byDay[song.day - 1] = song;
  }
  return byDay;
}

/** Which day of the challenge today is, or null if today is outside it. */
export function currentDay(c: Challenge | null = challenge): number | null {
  if (!c) return null;
  const offset = dayDiff(today(), c.startDate);
  if (offset < 0 || offset >= c.dayCount) return null;
  return offset + 1;
}

export function songForDay(day: number): Song | undefined {
  return songs.find(s => s.day === day);
}

export interface ChallengeProgress {
  challenge: Challenge | null;
  byDay: (Song | null)[];
  entered: number;
  complete: number;
  dayCount: number;
  currentDay: number | null;
  todaySong: Song | undefined;
}

export function challengeProgress(): ChallengeProgress {
  const byDay = assignmentsFor();
  const day = currentDay();
  return {
    challenge,
    byDay,
    entered: byDay.filter(Boolean).length,
    complete: byDay.filter(s => s?.status === 'complete').length,
    dayCount: challenge?.dayCount ?? 0,
    currentDay: day,
    todaySong: day ? byDay[day - 1] ?? undefined : undefined
  };
}

// ---------------------------------------------------------------------------
// Practice, aggregated
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  date: string;
  minutes: number;
  songId: string;
  /** 'session' was timed here; 'tracker' came in with the song's own total. */
  source: 'session' | 'tracker';
}

/**
 * Every minute of practice this app can account for, with a date on it.
 *
 * The tracker's per-song totals are dated to the day that song was worked on,
 * because that is what the column meant. Without them "this week" would read
 * zero next to a song that plainly says 60 minutes, which is worse than
 * approximate — it looks broken.
 */
export function practiceLedger(): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const song of songs) {
    if (song.practiceMinutes > 0 && song.date) {
      out.push({ date: song.date, minutes: song.practiceMinutes, songId: song.id, source: 'tracker' });
    }
  }
  for (const s of sessions) {
    out.push({ date: s.date, minutes: s.minutes, songId: s.songId, source: 'session' });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface PracticeStats {
  weekMinutes: number;
  totalMinutes: number;
  streakDays: number;
  avgConfidence: number | null;
  songsEntered: number;
  songsComplete: number;
  revisitCount: number;
  sessionCount: number;
}

export function practiceStats(): PracticeStats {
  const ledger = practiceLedger();
  const now = today();

  const weekMinutes = ledger
    .filter(e => {
      const back = dayDiff(now, e.date);
      return back >= 0 && back < 7;
    })
    .reduce((sum, e) => sum + e.minutes, 0);

  const practisedDays = new Set(ledger.filter(e => e.minutes > 0).map(e => e.date));

  // A streak survives today being blank until the day is out — otherwise every
  // morning would report the run broken before you have had a chance to play.
  let streakDays = 0;
  let cursor = practisedDays.has(now) ? 0 : 1;
  if (practisedDays.has(now) || practisedDays.has(shiftIso(now, -1))) {
    for (;;) {
      const date = shiftIso(now, -cursor);
      if (!practisedDays.has(date)) break;
      streakDays++;
      cursor++;
    }
  }

  const scored = songs.filter(s => s.confidence > 0);

  return {
    weekMinutes,
    totalMinutes: ledger.reduce((sum, e) => sum + e.minutes, 0),
    streakDays,
    avgConfidence: scored.length
      ? scored.reduce((sum, s) => sum + s.confidence, 0) / scored.length
      : null,
    songsEntered: songs.length,
    songsComplete: songs.filter(s => s.status === 'complete').length,
    revisitCount: songs.filter(s => s.revisit).length,
    sessionCount: sessions.length
  };
}

function shiftIso(iso: string, days: number): string {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** The song you last actually played, by anything the ledger knows about. */
export function lastPractised(): { song: Song; date: string } | null {
  for (const entry of practiceLedger()) {
    const song = getSong(entry.songId);
    if (song) return { song, date: entry.date };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface SongInput {
  title: string;
  artist?: string;
  day?: number | null;
  key?: string;
  capo?: number | null;
  chordsRaw?: string;
  strumming?: string;
  status?: SongStatus;
  confidence?: number;
  practiceMinutes?: number;
  notes?: string;
  revisit?: boolean;
}

const dateForDay = (day: number | null | undefined): string | null => {
  if (!challenge || !day) return null;
  return shiftIso(challenge.startDate, day - 1);
};

export async function createSong(input: SongInput): Promise<Song> {
  const now = Date.now();
  const day = input.day ?? null;
  const song: Song = {
    id: newId(),
    title: input.title.trim(),
    artist: (input.artist ?? '').trim(),
    day,
    date: dateForDay(day),
    key: (input.key ?? '').trim(),
    capo: input.capo ?? null,
    chordsRaw: (input.chordsRaw ?? '').trim(),
    strumming: (input.strumming ?? '').trim(),
    status: input.status ?? 'learning',
    confidence: input.confidence ?? 0,
    practiceMinutes: input.practiceMinutes ?? 0,
    notes: (input.notes ?? '').trim(),
    revisit: input.revisit ?? false,
    createdAt: now,
    updatedAt: now
  };
  songs = [...songs, song];
  await putRecords('songs', [song]);
  announce();
  return song;
}

export async function updateSong(id: string, patch: Partial<SongInput>): Promise<Song | null> {
  const existing = getSong(id);
  if (!existing) return null;
  const next: Song = { ...existing, ...patch, updatedAt: Date.now() } as Song;
  if (patch.day !== undefined) next.date = dateForDay(patch.day);
  songs = songs.map(s => (s.id === id ? next : s));
  await putRecords('songs', [next]);
  announce();
  return next;
}

export async function deleteSong(id: string): Promise<void> {
  songs = songs.filter(s => s.id !== id);
  const doomed = sessions.filter(s => s.songId === id);
  sessions = sessions.filter(s => s.songId !== id);
  await deleteRecord('songs', id);
  // A session with no song is a row nothing can ever show or explain.
  await Promise.all(doomed.map(s => deleteRecord('sessions', s.id)));
  announce();
}

export interface SessionInput {
  songId: string;
  minutes: number;
  chordsNote?: string;
  strummingNote?: string;
  singingNote?: string;
  problemArea?: string;
  nextAction?: string;
  startedAt?: number;
}

export async function logSession(input: SessionInput): Promise<PracticeSession> {
  const startedAt = input.startedAt ?? Date.now();
  const session: PracticeSession = {
    id: newId(),
    songId: input.songId,
    date: isoDate(new Date(startedAt)),
    startedAt,
    sessionNumber: sessions.filter(s => s.songId === input.songId).length + 1,
    minutes: Math.max(0, Math.round(input.minutes)),
    chordsNote: (input.chordsNote ?? '').trim(),
    strummingNote: (input.strummingNote ?? '').trim(),
    singingNote: (input.singingNote ?? '').trim(),
    problemArea: (input.problemArea ?? '').trim(),
    nextAction: (input.nextAction ?? '').trim()
  };
  sessions = [...sessions, session];
  await putRecords('sessions', [session]);
  announce();
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  sessions = sessions.filter(s => s.id !== id);
  await deleteRecord('sessions', id);
  announce();
}

export async function saveChallenge(next: Challenge): Promise<void> {
  challenge = next;
  await putRecords('challenges', [next]);
  announce();
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export interface LibraryExport {
  format: 'cadenza-library';
  version: 1;
  exportedAt: string;
  songs: Song[];
  sessions: PracticeSession[];
  challenges: Challenge[];
}

export function exportLibrary(): LibraryExport {
  return {
    format: 'cadenza-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    songs,
    sessions,
    challenges: challenge ? [challenge] : []
  };
}

export interface ImportResult {
  ok: boolean;
  message: string;
  songs?: number;
  sessions?: number;
}

/**
 * Replaces the library with the contents of a backup.
 *
 * Replaces rather than merges, on purpose: two exports of the same log would
 * merge into two of every session, and there is no id-stable way to tell a
 * re-import from a genuinely new sitting. Restoring a backup is the operation
 * people actually want, and the caller confirms before this is reached.
 */
export async function importLibrary(raw: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
  const data = parsed as Partial<LibraryExport>;
  if (!data || data.format !== 'cadenza-library' || !Array.isArray(data.songs)) {
    return { ok: false, message: 'That is not a Cadenza library export.' };
  }
  const nextSongs = data.songs.filter(s => s && typeof s.id === 'string' && typeof s.title === 'string');
  const nextSessions = (Array.isArray(data.sessions) ? data.sessions : [])
    .filter(s => s && typeof s.id === 'string' && typeof s.songId === 'string');
  const nextChallenge = (Array.isArray(data.challenges) ? data.challenges : [])[0] ?? null;

  await Promise.all([clearStore('songs'), clearStore('sessions'), clearStore('challenges')]);
  songs = nextSongs;
  sessions = nextSessions;
  challenge = nextChallenge;
  await Promise.all([
    putRecords('songs', songs),
    putRecords('sessions', sessions),
    ...(challenge ? [putRecords('challenges', [challenge])] : []),
    // A restored library is the user's own data; the seed must not come back
    // over the top of it on the next load.
    putRecords('settings', [{ id: SEEDED_SETTING, value: true }])
  ]);
  announce();
  return { ok: true, message: 'Library restored.', songs: songs.length, sessions: sessions.length };
}

/**
 * Every song and every session gone, and the seed does not return.
 *
 * The challenge itself stays. It is the frame rather than the contents — a
 * month with dates on it — and nothing in the app can create one, so throwing
 * it away would leave someone with a library that has no calendar and no way
 * to get one back.
 */
export async function clearLibrary(): Promise<void> {
  await Promise.all([clearStore('songs'), clearStore('sessions')]);
  await putRecords('settings', [{ id: SEEDED_SETTING, value: true }]);
  songs = [];
  sessions = [];
  announce();
}

// ---------------------------------------------------------------------------
// Convenience for the UI
// ---------------------------------------------------------------------------

export const songChords = (song: Song): string[] => uniqueChords(parseProgressions(song.chordsRaw));
export const songProgressions = (song: Song): string[][] => parseProgressions(song.chordsRaw);
