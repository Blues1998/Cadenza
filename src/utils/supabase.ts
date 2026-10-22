import { createClient } from '@supabase/supabase-js';
import type { Song, PracticeSession } from './library';

// Default to the provided Supabase project, with override via Vite env vars
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://zpafclsxndlkhriqtxxw.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kYFhJOiOrJH33N_weQxGrg_YX-gGQ3v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export interface DbSongRow {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  day: number | null;
  date: string | null;
  key: string;
  capo: number | null;
  chords_raw: string;
  strumming: string;
  status: string;
  confidence: number;
  practice_minutes: number;
  notes: string;
  revisit: boolean;
  chart: unknown;
  created_at: number;
  updated_at: number;
}

export function songToDbRow(song: Song, userId: string): DbSongRow {
  return {
    id: song.id,
    user_id: userId,
    title: song.title,
    artist: song.artist ?? '',
    day: song.day ?? null,
    date: song.date ?? null,
    key: song.key ?? '',
    capo: song.capo ?? null,
    chords_raw: song.chordsRaw ?? '',
    strumming: song.strumming ?? '',
    status: song.status ?? 'learning',
    confidence: song.confidence ?? 0,
    practice_minutes: song.practiceMinutes ?? 0,
    notes: song.notes ?? '',
    revisit: Boolean(song.revisit),
    chart: song.chart ?? null,
    created_at: song.createdAt || Date.now(),
    updated_at: song.updatedAt || Date.now()
  };
}

export function dbRowToSong(row: DbSongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist || '',
    day: row.day,
    date: row.date,
    key: row.key || '',
    capo: row.capo,
    chordsRaw: row.chords_raw || '',
    strumming: row.strumming || '',
    status: (row.status as Song['status']) || 'learning',
    confidence: row.confidence ?? 0,
    practiceMinutes: row.practice_minutes ?? 0,
    notes: row.notes || '',
    revisit: Boolean(row.revisit),
    chart: row.chart as Song['chart'],
    createdAt: Number(row.created_at) || Date.now(),
    updatedAt: Number(row.updated_at) || Date.now()
  };
}

export interface DbSessionRow {
  id: string;
  user_id: string;
  song_id: string;
  date: string;
  started_at: number;
  session_number: number;
  minutes: number;
  chords_note: string;
  strumming_note: string;
  singing_note: string;
  problem_area: string;
  next_action: string;
}

export function sessionToDbRow(session: PracticeSession, userId: string): DbSessionRow {
  return {
    id: session.id,
    user_id: userId,
    song_id: session.songId,
    date: session.date,
    started_at: session.startedAt,
    session_number: session.sessionNumber,
    minutes: session.minutes,
    chords_note: session.chordsNote ?? '',
    strumming_note: session.strummingNote ?? '',
    singing_note: session.singingNote ?? '',
    problem_area: session.problemArea ?? '',
    next_action: session.nextAction ?? ''
  };
}

export function dbRowToSession(row: DbSessionRow): PracticeSession {
  return {
    id: row.id,
    songId: row.song_id,
    date: row.date,
    startedAt: Number(row.started_at),
    sessionNumber: Number(row.session_number),
    minutes: Number(row.minutes),
    chordsNote: row.chords_note || '',
    strummingNote: row.strumming_note || '',
    singingNote: row.singing_note || '',
    problemArea: row.problem_area || '',
    nextAction: row.next_action || ''
  };
}
