// A song's chart: the words, the chords, and where in the bar each change
// lands.
//
// The timeline is bars and beats, not seconds. There is no recording in this
// app to sync against, and a guitarist does not think "the F arrives at 14.6
// seconds" — they think "the F is the second bar". Bars also stay true when the
// tempo is dragged down to something playable, which a list of timestamps does
// not, and slowing a song down is most of what practising one is.
//
// The chart is stored as structure, not as text: a list of lines, each a list
// of words, each word optionally carrying the chord that starts on it. Text is
// what comes in from a chord sheet and what goes back out — it is a format, not
// the truth. Storing the structure is what lets a chord be changed by clicking
// the chord, rather than by finding it in a paragraph of brackets.
//
// One chord holds one bar unless the line says otherwise. A line's `bars` is
// explicit and editable; the chords inside it are spread evenly across those
// bars unless a chord names its own beat.

export interface ChartWord {
  text: string;
  /** The chord that starts on this word, if any. */
  chord?: string;
  /** Beats from the start of the line. Absent means "share the line evenly". */
  beat?: number;
}

export interface ChartLineRecord {
  id: string;
  kind: 'lyric' | 'section';
  /** Section heading text, for kind 'section'. */
  label?: string;
  words?: ChartWord[];
  bars?: number;
}

export interface ChartChord {
  symbol: string;
  /** Beats from the start of the song. */
  beat: number;
  /** Which line and which word this came from, so the editor can find it again. */
  lineId: string;
  wordIndex: number;
}

/** A run of lyric text with the chord that starts it, for chord-over-word rendering. */
export interface ChartSegment {
  chord: string | null;
  text: string;
}

export interface ChartLine {
  index: number;
  id: string;
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

let idSeed = 0;
export const newLineId = (): string => `l${Date.now().toString(36)}${(idSeed++).toString(36)}`;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** How long a line lasts, in bars, when nobody has said. */
export const defaultBars = (words: ChartWord[]): number =>
  Math.max(1, words.filter(w => w.chord).length);

/**
 * Lays the stored lines out on a beat grid.
 *
 * Chords with no beat of their own share the line evenly, which is what a chord
 * sheet means when it prints four chords over one line. A chord that names a
 * beat keeps it — that is the escape hatch for the change that lands on the
 * "and" of three.
 */
export function timeChart(lines: ChartLineRecord[], beatsPerBar = 4, transpose = 0): ParsedChart {
  const out: ChartLine[] = [];
  const sections: string[] = [];
  const seen = new Set<string>();
  const chords: string[] = [];
  let section = '';
  let beat = 0;
  let index = 0;

  for (const record of lines) {
    if (record.kind === 'section') {
      section = (record.label ?? '').trim();
      if (section && !sections.includes(section)) sections.push(section);
      continue;
    }

    const words = record.words ?? [];
    const bars = Math.max(1, record.bars ?? defaultBars(words));
    const beats = bars * beatsPerBar;
    const withChords = words.map((w, i) => ({ w, i })).filter(({ w }) => w.chord);

    const lineChords: ChartChord[] = [];
    withChords.forEach(({ w, i }, n) => {
      const symbol = transposeSymbol(w.chord as string, transpose);
      const offset = w.beat ?? (n * beats) / withChords.length;
      lineChords.push({ symbol, beat: beat + offset, lineId: record.id, wordIndex: i });
      if (seen.has(symbol)) return;
      seen.add(symbol);
      chords.push(symbol);
    });
    lineChords.sort((a, b) => a.beat - b.beat);

    const segments: ChartSegment[] = words.map((w, i) => ({
      chord: w.chord ? transposeSymbol(w.chord, transpose) : null,
      text: w.text + (i < words.length - 1 && w.text !== '' ? ' ' : '')
    }));

    out.push({
      index,
      id: record.id,
      section,
      startBeat: beat,
      beats,
      chords: lineChords,
      segments,
      instrumental: words.every(w => w.text.trim() === '') && lineChords.length > 0
    });
    index += 1;
    beat += beats;
  }

  return {
    lines: out,
    sections,
    totalBeats: beat,
    chordCount: out.reduce((n, l) => n + l.chords.length, 0),
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

// Nearly every chord sheet puts the chords on their own line, spaced so each one
// sits above the syllable it lands on. That survives being read and does not
// survive being reflowed — the alignment is the data, and it is gone the moment
// the column width changes. So it is converted on the way in rather than
// supported.

const CHORD_TOKEN_STRICT =
  /^[A-G][#b]?(?:maj7|maj9|maj|M7|min7|min|m7b5|m7|m9|m6|m|sus2|sus4|sus|add9|dim7|dim|aug|11|13|7|9|6|5)?(?:\/[A-G][#b]?)?$/;

export const isChordSymbol = (token: string): boolean => CHORD_TOKEN_STRICT.test(token.trim());

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
 * Headings and blank lines pass through untouched.
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

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Text in, text out
// ---------------------------------------------------------------------------

const CHORD_TOKEN = /\[([^\]]{1,24})\]/g;

// Ultimate Guitar marks its sections with brackets too — [Verse 1], [Chorus] —
// which is the same punctuation this format uses for chords. A bracket holding
// something that is not a chord is a heading.
const isSectionBracket = (line: string): boolean => {
  const m = /^\[([^\]]{1,40})\]$/.exec(line.trim());
  return m !== null && !isChordSymbol(m[1]);
};

/** One line of inline text into words, with each chord attached to the word it starts. */
function wordsFromLine(text: string): ChartWord[] {
  const pending: string[] = [];
  const words: ChartWord[] = [];
  let cursor = 0;

  const pushWords = (chunk: string) => {
    for (const piece of chunk.split(/\s+/)) {
      if (piece === '') continue;
      const word: ChartWord = { text: piece };
      if (pending.length > 0) word.chord = pending.shift();
      words.push(word);
    }
  };

  CHORD_TOKEN.lastIndex = 0;
  for (let m = CHORD_TOKEN.exec(text); m; m = CHORD_TOKEN.exec(text)) {
    pushWords(text.slice(cursor, m.index));
    pending.push(m[1].trim());
    cursor = m.index + m[0].length;
  }
  pushWords(text.slice(cursor));

  // Chords with no word left to sit on — a change at the end of a line. They get
  // an empty word so they still have somewhere to live and something to click.
  for (const chord of pending) words.push({ text: '', chord });
  return words;
}

/**
 * A pasted sheet into stored lines.
 *
 * Bar lines are read if they are there: a line written with them takes its bar
 * count from them, and the chords inside each bar keep their share of it.
 */
export function linesFromText(text: string, beatsPerBar = 4): ChartLineRecord[] {
  const out: ChartLineRecord[] = [];

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (isSectionBracket(line)) {
      out.push({ id: newLineId(), kind: 'section', label: line.slice(1, -1).trim() });
      continue;
    }
    if (line.endsWith(':') && !line.includes('[')) {
      out.push({ id: newLineId(), kind: 'section', label: line.slice(0, -1).trim() });
      continue;
    }

    if (!line.includes('|')) {
      const words = wordsFromLine(line);
      if (words.length === 0) continue;
      out.push({ id: newLineId(), kind: 'lyric', words, bars: defaultBars(words) });
      continue;
    }

    // Explicit bars. Each bar's chords share it, so their beats are written down
    // rather than left to the even spread across the line.
    const bars = line.split('|').map(b => b.trim()).filter(Boolean);
    const words: ChartWord[] = [];
    bars.forEach((bar, barIndex) => {
      const barWords = wordsFromLine(bar);
      const chordCount = barWords.filter(w => w.chord).length;
      let n = 0;
      for (const w of barWords) {
        if (w.chord) {
          w.beat = barIndex * beatsPerBar + (n * beatsPerBar) / Math.max(1, chordCount);
          n += 1;
        }
        words.push(w);
      }
    });
    if (words.length === 0) continue;
    out.push({ id: newLineId(), kind: 'lyric', words, bars: Math.max(1, bars.length) });
  }

  return out;
}

/** Stored lines back to the inline text, for copying out or editing by hand. */
export function linesToText(lines: ChartLineRecord[]): string {
  return lines
    .map(line => {
      if (line.kind === 'section') return `${line.label ?? ''}:`;
      return (line.words ?? [])
        .map(w => (w.chord ? `[${w.chord}]` : '') + w.text)
        .join(' ')
        .replace(/\s+$/, '');
    })
    .join('\n');
}

/** Kept for charts stored before the structure existed. */
export function parseChart(source: string, beatsPerBar = 4, transpose = 0): ParsedChart {
  return timeChart(linesFromText(source, beatsPerBar), beatsPerBar, transpose);
}

// ---------------------------------------------------------------------------
// What a sheet says about itself
// ---------------------------------------------------------------------------

export interface SheetMeta {
  capo?: number;
  key?: string;
  tempo?: number;
}

/**
 * The header lines a chord site puts above the song.
 *
 * Read rather than trusted: these are typed by whoever uploaded the tab, so
 * anything found is offered for the user to accept and never applied silently.
 */
export function extractMeta(text: string): SheetMeta {
  const meta: SheetMeta = {};
  const head = text.split('\n').slice(0, 40).join('\n');

  const capoNone = /capo\s*[:\-]?\s*(?:none|no capo)/i.test(head);
  const capo = /capo\s*[:\-]?\s*(?:on\s*)?(\d{1,2})(?:\s*(?:st|nd|rd|th)?\s*fret)?/i.exec(head);
  if (capoNone) meta.capo = 0;
  else if (capo) meta.capo = Number(capo[1]);

  const key = /\bkey\s*[:\-]\s*([A-G][#b]?\s*(?:maj(?:or)?|min(?:or)?|m)?)/i.exec(head);
  if (key) meta.key = key[1].trim().replace(/\s+/g, ' ');

  const tempo = /\b(?:tempo|bpm)\s*[:\-]?\s*(\d{2,3})\b/i.exec(head)
    ?? /\b(\d{2,3})\s*bpm\b/i.exec(head);
  if (tempo) {
    const n = Number(tempo[1]);
    if (n >= TEMPO_MIN && n <= TEMPO_MAX) meta.tempo = n;
  }

  return meta;
}

/** Header and credit lines, dropped so they do not become the first verse. */
export function stripHeaders(text: string): string {
  const skip = /^\s*(capo|key|tempo|bpm|tuning|artist|song|title|album|by|chords?\s+by|tabbed\s+by|difficulty|strumming(\s+pattern)?|author|version)\s*[:\-]/i;
  return text
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => !skip.test(line))
    .join('\n')
    .trim();
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
