// Taking a chord out of the chord book.
//
// The book is built from two places: the chords your songs ask for, and the
// ones you added or rated by hand. Removing one therefore means one of three
// things, and the screen asks which:
//
// - a chord only you put there is simply forgotten;
// - a chord a song asks for can be taken out of that song's chord line, which
//   is the right answer when the line was wrong (a note like "single strum"
//   read as a chord, a typo);
// - or it can just be hidden from the book, leaving the songs as they are.
//
// Hidden chords live on this device (localStorage), like the rest of the
// book's per-device settings.

import { useSyncExternalStore } from 'react';
import { chordKey } from './chordbook';
import { getSongs, songChords, updateSong, type Song } from './library';
import { timeChart } from './chart';
import { stripChord } from './songText';

const KEY = 'cadenza-hidden-chords';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

let hidden = load();
const listeners = new Set<() => void>();

function save(next: Set<string>) {
  hidden = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* this session only */ }
  listeners.forEach(l => l());
}

export const hideChord = (key: string) => save(new Set([...hidden, key]));
export const unhideChord = (key: string) => save(new Set([...hidden].filter(k => k !== key)));
export const unhideAll = () => save(new Set());

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => hidden;
export const useHiddenChords = (): Set<string> => useSyncExternalStore(subscribe, snapshot);

/** Songs whose chord line asks for this chord. */
export const songsWithChord = (key: string): Song[] =>
  getSongs().filter(song => songChords(song).some(symbol => chordKey(symbol) === key));

/** Songs whose written chart (lyrics with chords over them) uses it. Charts aren't edited from here. */
export const chartsWithChord = (key: string): Song[] =>
  getSongs().filter(song => {
    if (!song.chart || song.chart.lines.length === 0) return false;
    const parsed = timeChart(song.chart.lines, song.chart.beatsPerBar, song.chart.transpose);
    return parsed.chords.some(symbol => chordKey(symbol) === key);
  });

/**
 * Takes the chord out of every song's chord line. Returns an undo that puts
 * each line back exactly as it was.
 */
export async function removeFromSongs(key: string): Promise<() => Promise<void>> {
  const before = songsWithChord(key).map(song => ({ id: song.id, chordsRaw: song.chordsRaw }));
  for (const { id, chordsRaw } of before) {
    await updateSong(id, { chordsRaw: stripChord(chordsRaw, token => chordKey(token) === key) });
  }
  return async () => {
    for (const { id, chordsRaw } of before) await updateSong(id, { chordsRaw });
  };
}
