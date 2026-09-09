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

/** The chords and text of one bar's worth of source, in the order they appear. */
function readBar(text: string): { chords: string[]; segments: ChartSegment[] } {
  const segments: ChartSegment[] = [];
  const chords: string[] = [];
  let cursor = 0;
  let pending: string | null = null;
  CHORD_TOKEN.lastIndex = 0;
  for (let m = CHORD_TOKEN.exec(text); m; m = CHORD_TOKEN.exec(text)) {
    const before = text.slice(cursor, m.index);
    if (before || pending !== null) segments.push({ chord: pending, text: before });
    pending = m[1].trim();
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
export function parseChart(source: string, beatsPerBar = 4): ParsedChart {
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
        const read = readBar(bar);
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
      const read = readBar(text);
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
