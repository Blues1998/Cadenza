// A song's chart: the words, the chords, and where in the bar each change
// lands.
//
// The timeline is bars and beats, not seconds. There is no recording in this
// app to sync against, and a guitarist does not think "the F arrives at 14.6
// seconds" — they think "the F is the second bar". Bars and beats are also
// exact, transposable, and still true when you slow the tempo down to practise,
// which a list of timestamps is not.
//
// The chart is stored as the text that was typed and parsed on the way out, the
// same way a song's chord line is. Nothing is lost in a round trip, editing is
// just editing the text, and there is no second copy of the same fact to drift.
//
// The notation is the one every chord sheet already uses: the chord in square
// brackets, immediately before the syllable it lands on.
//
//   Verse:
//   [Am]Sing a word or two [F]here
//   [C]And the line goes [G]on
//
// One chord holds one bar unless the line says otherwise with bar lines:
//
//   [Am]words [F]more | [C]next bar
//
// — everything between two bar lines is one bar, and the chords inside it share
// that bar's beats equally. A line ending in a colon with no chords in it is a
// section heading.

export interface ChartChord {
  symbol: string;
  /** Beats from the start of the song. */
  beat: number;
}

/** A run of lyric text with the chord that starts it, for chord-over-word rendering. */
export interface ChartSegment {
  chord: string | null;
  text: string;
}

export interface ChartLine {
  index: number;
  section: string;
  startBeat: number;
  beats: number;
  chords: ChartChord[];
  segments: ChartSegment[];
  /** True when the line carries chords but no words — an intro, a turnaround. */
  instrumental: boolean;
}

export interface ParsedChart {
  lines: ChartLine[];
  sections: string[];
  totalBeats: number;
  chordCount: number;
  /** Every distinct chord in the chart, first appearance first. */
  chords: string[];
}

export interface ChartSettings {
  tempo: number;
  beatsPerBar: number;
  countInBars: number;
}

export const DEFAULT_CHART: ChartSettings = { tempo: 80, beatsPerBar: 4, countInBars: 1 };

export const TEMPO_MIN = 30;
export const TEMPO_MAX = 220;

const CHORD_TOKEN = /\[([^\]]{1,20})\]/g;

// Defined further down with the rest of the transposing; hoisted, so parseChart
// can use it without the file having to open on pitch arithmetic.

/** The chords and text of one bar's worth of source, in the order they appear. */
function readBar(text: string, transpose = 0): { chords: string[]; segments: ChartSegment[] } {
  const segments: ChartSegment[] = [];
  const chords: string[] = [];
  let cursor = 0;
  let pending: string | null = null;
  CHORD_TOKEN.lastIndex = 0;
  for (let m = CHORD_TOKEN.exec(text); m; m = CHORD_TOKEN.exec(text)) {
    const before = text.slice(cursor, m.index);
    if (before || pending !== null) segments.push({ chord: pending, text: before });
    pending = transposeSymbol(m[1].trim(), transpose);
    chords.push(pending);
    cursor = m.index + m[0].length;
  }
  const tail = text.slice(cursor);
  if (tail || pending !== null) segments.push({ chord: pending, text: tail });
  return { chords, segments };
}

/**
 * Reads a chart's source into lines with beats on them.
 *
 * Forgiving throughout: an empty line is skipped, a line with no chords still
 * takes its bar so the words stay in time, and a bracket holding something we
 * cannot name is kept as written. Nothing here rejects input — a chart being
 * written is a chart that is half finished most of the time.
 */
export function parseChart(source: string, beatsPerBar = 4, transpose = 0): ParsedChart {
  const lines: ChartLine[] = [];
  const sections: string[] = [];
  const seenChords = new Set<string>();
  const chords: string[] = [];
  let section = '';
  let beat = 0;
  let index = 0;

  for (const raw of source.split('\n')) {
    const text = raw.trim();
    if (!text) continue;

    // A heading: ends in a colon and has no chords of its own.
    if (text.endsWith(':') && !text.includes('[')) {
      section = text.slice(0, -1).trim();
      if (section && !sections.includes(section)) sections.push(section);
      continue;
    }

    // A leading or trailing bar line is punctuation, not an empty bar.
    const bars = text.includes('|')
      ? text.split('|').map(part => part.trim()).filter(part => part !== '')
      : [text];

    const lineChords: ChartChord[] = [];
    const segments: ChartSegment[] = [];
    let barCount = 0;

    if (text.includes('|')) {
      // Explicit bars: whatever is between two bar lines is one bar, and the
      // chords inside share that bar's beats.
      for (const bar of bars) {
        const read = readBar(bar, transpose);
        // The bar line is a marker, and whatever spacing was typed around it is
        // cosmetic — but the words either side of it are still separate words.
        // Each bar is trimmed and the boundary gets exactly one space back,
        // otherwise "na na | na" came out as "na nana" or "na na  na"
        // depending on how the line happened to be spaced.
        if (barCount > 0 && segments.length > 0) {
          const last = segments[segments.length - 1];
          if (!/\s$/.test(last.text)) last.text += ' ';
        }
        const start = beat + barCount * beatsPerBar;
        const step = read.chords.length > 0 ? beatsPerBar / read.chords.length : 0;
        read.chords.forEach((symbol, i) => lineChords.push({ symbol, beat: start + i * step }));
        segments.push(...read.segments);
        barCount += 1;
      }
    } else {
      // No bar lines: one chord holds one bar, which is how a chord sheet reads
      // when nobody has written the bars in.
      const read = readBar(text, transpose);
      read.chords.forEach((symbol, i) => lineChords.push({ symbol, beat: beat + i * beatsPerBar }));
      segments.push(...read.segments);
      barCount = Math.max(1, read.chords.length);
    }

    for (const c of lineChords) {
      if (seenChords.has(c.symbol)) continue;
      seenChords.add(c.symbol);
      chords.push(c.symbol);
    }

    // A line of nothing but bar lines has no bars to give it a length. It
    // cannot be timed and there is nothing to show, so it is not a line.
    if (barCount === 0) continue;

    const words = segments.map(s => s.text).join('').trim();
    const beats = barCount * beatsPerBar;
    lines.push({
      index,
      section,
      startBeat: beat,
      beats,
      chords: lineChords,
      segments,
      instrumental: words === '' && lineChords.length > 0
    });
    index += 1;
    beat += beats;
  }

  return {
    lines,
    sections,
    totalBeats: beat,
    chordCount: lines.reduce((n, l) => n + l.chords.length, 0),
    chords
  };
}

/** Every chord in the chart in playing order, flattened across lines. */
export function chartChords(chart: ParsedChart): ChartChord[] {
  return chart.lines.flatMap(l => l.chords);
}

/** The line being sung at this beat, or null before the first / after the last. */
export function lineAtBeat(chart: ParsedChart, beat: number): ChartLine | null {
  for (const line of chart.lines) {
    if (beat >= line.startBeat && beat < line.startBeat + line.beats) return line;
  }
  return null;
}

/** What you should be holding now, and what is coming. */
export function chordsAtBeat(chart: ParsedChart, beat: number): { current: ChartChord | null; next: ChartChord | null } {
  const all = chartChords(chart);
  let current: ChartChord | null = null;
  let next: ChartChord | null = null;
  for (const chord of all) {
    if (chord.beat <= beat + 1e-6) current = chord;
    else { next = chord; break; }
  }
  return { current, next };
}

export const beatsToSeconds = (beats: number, tempo: number): number => (beats * 60) / tempo;

/** "2:41" — how long the chart runs at this tempo. */
export function chartDuration(totalBeats: number, tempo: number): string {
  const seconds = Math.round(beatsToSeconds(totalBeats, tempo));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Chord sheets as they are found in the wild
// ---------------------------------------------------------------------------

// Nearly every chord sheet on the internet puts the chords on their own line,
// spaced so each one sits above the syllable it lands on:
//
//     Dm            Bb   C
//     Words of the song go here
//
// That survives being read and does not survive being reflowed — the alignment
// is the data, and it is gone the moment the column width changes. So it is
// converted on the way in rather than supported: the column each chord starts
// at is looked up in the line below, and the chord is written into the words at
// that point. After that it is an ordinary chart and nothing downstream has to
// know where it came from.

const CHORD_TOKEN_STRICT =
  /^[A-G][#b]?(?:maj7|maj9|maj|M7|min7|min|m7b5|m7|m9|m6|m|sus2|sus4|sus|add9|dim7|dim|aug|11|13|7|9|6|5)?(?:\/[A-G][#b]?)?$/;

const isChordLine = (line: string): boolean => {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(t => CHORD_TOKEN_STRICT.test(t));
};

/** Does this look like chords stacked over words rather than written into them? */
export function looksLikeAboveLine(text: string): boolean {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isChordLine(lines[i])) continue;
    if (lines[i].includes('[')) return false;
    if (lines[i + 1].trim() !== '' && !isChordLine(lines[i + 1])) return true;
  }
  return false;
}

/** Every chord on a line, with the column it starts at. */
function chordColumns(line: string): { symbol: string; column: number }[] {
  const out: { symbol: string; column: number }[] = [];
  const token = /\S+/g;
  for (let m = token.exec(line); m; m = token.exec(line)) {
    out.push({ symbol: m[0], column: m.index });
  }
  return out;
}

/**
 * Chords-above-words into the inline form.
 *
 * A chord line with words under it is merged into them. A chord line with
 * nothing under it is an instrumental bar and becomes a line of bare chords.
 * Headings and blank lines pass through untouched, and anything that is not a
 * chord line is left exactly as it was — a sheet half in one format and half in
 * the other still comes out readable.
 */
export function convertAboveLine(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isChordLine(line) || line.includes('[')) {
      out.push(line.trimEnd());
      continue;
    }

    const chords = chordColumns(line);
    const below = lines[i + 1];
    const hasWords = below !== undefined && below.trim() !== '' && !isChordLine(below);

    if (!hasWords) {
      // An interlude: the chords are the whole line.
      out.push(chords.map(c => `[${c.symbol}]`).join(''));
      continue;
    }

    // Right to left, so an insertion never moves a column still to be used.
    let merged = below.replace(/\s+$/, '');
    for (let k = chords.length - 1; k >= 0; k--) {
      const { symbol, column } = chords[k];
      const marker = `[${symbol}]`;
      if (column >= merged.length) {
        merged = `${merged}${merged.endsWith(' ') ? '' : ' '}${marker}`;
        continue;
      }
      // Snap to the start of the word the column lands in. Sheets are typed by
      // hand and a chord is routinely a character or two out; taken literally
      // that lands inside a word and cuts it in half, which is never what the
      // person spacing it out meant.
      let at = column;
      while (at > 0 && !/\s/.test(merged[at]) && !/\s/.test(merged[at - 1])) at -= 1;
      merged = merged.slice(0, at) + marker + merged.slice(at);
    }
    out.push(merged.trim());
    i += 1;   // the words have been consumed
  }

  // Collapse the runs of blank lines a pasted sheet is full of.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Transposing
// ---------------------------------------------------------------------------

// The spellings a guitarist reads without stopping. Five flats and two sharps,
// which is what the common guitar keys actually use.
const SPELLING = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PITCH: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6,
  Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

const shiftNote = (note: string, semitones: number): string => {
  const pc = PITCH[note];
  if (pc === undefined) return note;
  return SPELLING[(((pc + semitones) % 12) + 12) % 12];
};

/** "Dm" down five is "Am"; a bass note after a slash moves with it. */
export function transposeSymbol(symbol: string, semitones: number): string {
  if (semitones === 0) return symbol;
  const m = /^([A-G][#b]?)(.*)$/.exec(symbol.trim());
  if (!m || PITCH[m[1]] === undefined) return symbol;
  const rest = m[2].replace(/^\/([A-G][#b]?)/, (_, bass: string) => `/${shiftNote(bass, semitones)}`);
  return shiftNote(m[1], semitones) + rest;
}
