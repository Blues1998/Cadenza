// Reading the way chords are actually written down.
//
// A song's chords arrive as a line typed by a person, not as structured data:
// "A min -> E min -> F maj -> G maj | C maj -> E min -> F maj > C maj". The
// bar separates one progression from another (verse, chorus), the arrows run
// left to right through one of them, and the spellings are whatever was to
// hand — "A min", "Am", "B7", "G(single strum)".
//
// Everything here is forgiving on the way in and strict on the way out: a
// token it cannot read is kept verbatim and simply never gets a diagram, which
// is better than dropping a chord someone wrote down on purpose.

import type { ChordTypeId } from './chords';

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6,
  Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

// Every way the workbook and a person write the same quality.
const SUFFIX_ALIASES: [RegExp, string][] = [
  [/^(maj|major|M)$/i, ''],
  [/^(min|minor|m)$/i, 'm'],
  [/^(maj7|major7|M7)$/i, 'maj7'],
  [/^(min7|minor7|m7)$/i, 'm7'],
  [/^(dom7|7)$/i, '7'],
  [/^(dim|diminished|o)$/i, 'dim'],
  [/^(dim7|o7)$/i, 'dim7'],
  [/^(aug|augmented|\+)$/i, 'aug'],
  [/^(m7b5|ø7?|halfdim)$/i, 'm7b5']
];

const TYPE_BY_SUFFIX: Record<string, ChordTypeId> = {
  '': 'maj', m: 'min', '7': 'dom7', maj7: 'maj7', m7: 'min7',
  dim: 'dim', dim7: 'dim7', aug: 'aug', m7b5: 'm7b5'
};

/** "A min" → "Am", "F maj" → "F", "B7" → "B7". Unreadable input comes back trimmed. */
export function normalizeChordSymbol(raw: string): string {
  const text = raw.replace(/[♯]/g, '#').replace(/[♭]/g, 'b').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const m = /^([A-Ga-g])\s*([#b]?)\s*(.*)$/.exec(text);
  if (!m) return text;
  const root = m[1].toUpperCase() + m[2];
  if (NOTE_INDEX[root] === undefined) return text;
  const rest = m[3].trim();
  if (!rest) return root;
  for (const [pattern, suffix] of SUFFIX_ALIASES) {
    if (pattern.test(rest)) return root + suffix;
  }
  // Something we do not model — sus4, add9, an aside like "(single strum)".
  // Keep it whole; it still means something to whoever wrote it.
  return root + (rest.startsWith('(') ? ' ' + rest : rest);
}

/** The progressions on one line, in order, each already normalised. */
export function parseProgressions(raw: string | undefined | null): string[][] {
  if (!raw) return [];
  return raw
    .split('|')
    .map(part =>
      part
        .split(/→|->|>|,|;/)
        .map(token => normalizeChordSymbol(token))
        .filter(Boolean)
    )
    .filter(prog => prog.length > 0);
}

/** Every distinct chord in those progressions, first appearance first. */
export function uniqueChords(progressions: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const prog of progressions) {
    for (const chord of prog) {
      if (seen.has(chord)) continue;
      seen.add(chord);
      out.push(chord);
    }
  }
  return out;
}

/** What a symbol needs to be drawn as a shape, or null if we cannot place it. */
export function chordShape(symbol: string): { rootPc: number; typeId: ChordTypeId; rootName: string } | null {
  const m = /^([A-G][#b]?)(.*)$/.exec(symbol.trim());
  if (!m) return null;
  const rootPc = NOTE_INDEX[m[1]];
  if (rootPc === undefined) return null;
  const typeId = TYPE_BY_SUFFIX[m[2].trim()];
  if (!typeId) return null;
  return { rootPc, typeId, rootName: m[1] };
}

/** "5th fret" → 5, "0th fret" → 0, "" → null. */
export function parseCapo(raw: string | undefined | null): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const m = /(\d+)/.exec(String(raw));
  return m ? Number(m[1]) : null;
}

export const capoLabel = (capo: number | null | undefined): string =>
  capo === null || capo === undefined ? 'No capo' : capo === 0 ? 'No capo' : `Capo ${capo}`;

/** "D minor · Capo 5" — the one line that says how to pick the guitar up. */
export function songSubtitle(key: string | undefined, capo: number | null | undefined): string {
  const parts = [key?.trim(), capoLabel(capo)].filter(Boolean) as string[];
  return parts.join(' · ');
}
