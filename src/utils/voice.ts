// The singing side of the tuner: how a pitch is named, the range a voice
// covers, and what that means for the songs in the library.
//
// Everything here is kept on this device (localStorage), not in the cloud
// library. A voice range is a fact about one person's throat this month, and
// adding it to the synced song rows would need a database change for data
// nobody else reads.

import { useSyncExternalStore } from 'react';
import { midiToNoteName } from './musicTheory';
import { transposeSymbol } from './chart';
import { fitOptions, songChordUses, type FitOption } from './fit';
import type { Song } from './library';

// ---------------------------------------------------------------------------
// Naming a pitch
// ---------------------------------------------------------------------------

export type Notation = 'names' | 'sargam';

/** A pitch as it should be written: the text, plus octave and variant marks. */
export interface NoteLabel {
  text: string;
  /** Sargam only: -1 mandra (dot below), 0 madhya, +1 taar (dot above); further octaves stack. */
  octave: number;
  /** Sargam only: komal (flattened) Re, Ga, Dha, Ni, written underlined. */
  komal: boolean;
  /** Sargam only: tivra (sharpened) Ma, written with a line above. */
  tivra: boolean;
}

const SARGAM: { text: string; komal?: boolean; tivra?: boolean }[] = [
  { text: 'Sa' },
  { text: 'Re', komal: true },
  { text: 'Re' },
  { text: 'Ga', komal: true },
  { text: 'Ga' },
  { text: 'Ma' },
  { text: 'Ma', tivra: true },
  { text: 'Pa' },
  { text: 'Dha', komal: true },
  { text: 'Dha' },
  { text: 'Ni', komal: true },
  { text: 'Ni' }
];

/** "C#4" → "C♯4": the sharp sign reads better than a hash at display size. */
export const prettyNote = (midi: number): string => {
  const { name, octave } = midiToNoteName(midi);
  return `${name.replace('#', '♯')}${octave}`;
};

/**
 * @param sa The MIDI note of madhya (middle) Sa. Notes below it are mandra,
 *           an octave above it and up are taar.
 */
export function labelFor(midi: number, notation: Notation, sa: number): NoteLabel {
  if (notation === 'names') return { text: prettyNote(midi), octave: 0, komal: false, tivra: false };
  const from = midi - sa;
  const degree = ((from % 12) + 12) % 12;
  const s = SARGAM[degree];
  return { text: s.text, octave: Math.floor(from / 12), komal: !!s.komal, tivra: !!s.tivra };
}

/** The Sa choices offered: G2 to D4 covers where men and women usually set it. */
export const SA_CHOICES: number[] = Array.from({ length: 20 }, (_, i) => 43 + i);

// ---------------------------------------------------------------------------
// The stored voice
// ---------------------------------------------------------------------------

export interface Range {
  low: number;
  high: number;
}

export interface SongRange extends Range {
  capo: number;
}

/**
 * A song's measured range as it sounds now. Measured at one capo; if the capo
 * has moved since, the whole melody has moved with it.
 */
export function songRangeNow(song: { capo: number | null }, stored: SongRange | undefined): Range | null {
  if (!stored) return null;
  const by = (song.capo ?? 0) - stored.capo;
  return { low: stored.low + by, high: stored.high + by };
}

export interface VoiceState {
  notation: Notation;
  sa: number;
  /** Lowest and highest notes sung comfortably, from the range finder. */
  range: Range | null;
  /** Per song id: the lowest and highest notes its melody needs, and the capo it was measured at. */
  songs: Record<string, SongRange>;
}

const KEY = 'cadenza-voice';
const DEFAULT: VoiceState = { notation: 'names', sa: 48, range: null, songs: {} };

function load(): VoiceState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let state: VoiceState = load();
const listeners = new Set<() => void>();

export function setVoice(patch: Partial<VoiceState>): void {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* still works for this session */ }
  listeners.forEach(l => l());
}

export function setSongRange(songId: string, range: Range | null, capo = 0): void {
  const songs = { ...state.songs };
  if (range) songs[songId] = { low: range.low, high: range.high, capo };
  else delete songs[songId];
  setVoice({ songs });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;

export function useVoice(): VoiceState {
  return useSyncExternalStore(subscribe, snapshot);
}

// ---------------------------------------------------------------------------
// What the range says
// ---------------------------------------------------------------------------

// Typical classical ranges. Rough by design: these are labels people
// recognise, not a diagnosis, and the copy says "closest to".
const VOICE_TYPES: { name: string; low: number; high: number }[] = [
  { name: 'bass', low: 40, high: 64 },
  { name: 'baritone', low: 45, high: 69 },
  { name: 'tenor', low: 48, high: 72 },
  { name: 'alto', low: 53, high: 77 },
  { name: 'mezzo-soprano', low: 57, high: 81 },
  { name: 'soprano', low: 60, high: 84 }
];

export function closestVoiceType(range: Range): string {
  let best = VOICE_TYPES[0];
  let bestCost = Infinity;
  for (const t of VOICE_TYPES) {
    const cost = Math.abs(t.low - range.low) + Math.abs(t.high - range.high);
    if (cost < bestCost) { best = t; bestCost = cost; }
  }
  return best.name;
}

/**
 * The lowest and highest notes in a stretch of singing.
 *
 * Percentiles, not the extremes: one cracked note or a breath the detector
 * read as a pitch should not decide which key a song gets moved to.
 */
export function rangeOf(samples: number[]): Range | null {
  if (samples.length < 30) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { low: Math.round(at(0.05)), high: Math.round(at(0.95)) };
}

// ---------------------------------------------------------------------------
// Fitting a song to the voice
// ---------------------------------------------------------------------------

export interface VoiceFit {
  /** Semitones to move the song's pitch: negative is lower. */
  shift: number;
  verdict: 'fits' | 'high' | 'low' | 'wide';
  /** How to play it at the new pitch, the capo and shapes that suit your hands best. */
  option: FitOption | null;
  /** The song's key name moved by the shift, when the key is set and readable. */
  newKey: string | null;
}

/**
 * Where to move a song so its melody sits inside the voice.
 *
 * The smallest move that fits, because every semitone moved is further from
 * the record. When the melody is wider than the voice, it is centred and the
 * verdict says so, no key fixes that, and pretending one does would be worse.
 *
 * Moving the pitch is the opposite promise to the Fit panel (which keeps the
 * pitch and changes the grip), but the guitar side is the same question: at
 * this pitch, which capo puts the easiest shapes under the hands? So it asks
 * fit.ts, treating the shifted song as if it were already played there.
 */
export function voiceFit(song: Song, songRange: Range, voice: Range): VoiceFit {
  const songSpan = songRange.high - songRange.low;
  const voiceSpan = voice.high - voice.low;

  let shift = 0;
  let verdict: VoiceFit['verdict'] = 'fits';
  if (songSpan > voiceSpan) {
    shift = Math.round((voice.low + voice.high - songRange.low - songRange.high) / 2);
    verdict = 'wide';
  } else if (songRange.high > voice.high) {
    shift = voice.high - songRange.high;
    verdict = 'high';
  } else if (songRange.low < voice.low) {
    shift = voice.low - songRange.low;
    verdict = 'low';
  }

  let option: FitOption | null = null;
  if (shift !== 0) {
    const uses = songChordUses(song);
    // fitAt moves the grips by (current capo − new capo). Telling it the song
    // is already at capo+shift makes every option sound `shift` semitones away
    // from where it is now.
    if (uses.length > 0) option = bestForVoice(fitOptions(uses, (song.capo ?? 0) + shift));
  }

  return { shift, verdict, option, newKey: shiftKey(song.key, shift) };
}

// The shapes a guitarist learns first. Used only to break ties: when the
// chord book has nothing to say (nobody has rated these chords), fit.ts ranks
// every capo the same and the lowest wins, which happily proposed C♯ major.
const OPEN = new Set(['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm', 'C7', 'D7', 'E7', 'G7', 'A7', 'B7',
  'Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Dsus2', 'Dsus4', 'Asus2', 'Asus4', 'Esus4']);
const openCount = (option: FitOption) => option.chords.filter(c => OPEN.has(c.to)).length;

/** Fewest chords you can't play, then fewest shaky, then the most open shapes, then the lowest capo. */
function bestForVoice(options: FitOption[]): FitOption | null {
  return [...options].sort((a, b) =>
    a.missing - b.missing || a.shaky - b.shaky || openCount(b) - openCount(a) || a.capo - b.capo
  )[0] ?? null;
}

function shiftKey(key: string, shift: number): string | null {
  const m = /^\s*([A-G])([#b♯♭]?)(.*)$/.exec(key ?? '');
  if (!m || shift === 0) return null;
  const root = m[1] + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2]);
  return transposeSymbol(root, shift).replace('#', '♯').replace(/^([A-G])b/, '$1♭') + m[3];
}
