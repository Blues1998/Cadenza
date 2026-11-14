// Reading the way chords are actually written down.
//
// A song's chords arrive as a line typed by a person, not as structured data:
// "A min -> E min -> F maj -> G maj | C maj -> E min -> F maj > C maj". The
// bar separates one progression from another (verse, chorus), the arrows run
// left to right through one of them, and the spellings are whatever was to
// hand, "A min", "Am", "B7", "G(single strum)".
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
//
// The M forms are matched case-sensitively and on their own lines, because M
// and m are the one place in this notation where case is the whole meaning.
// Folded in with the rest under /i they silently won the match: "Am" came back
// as "A" and "Am7" as "Amaj7". Nothing noticed while every symbol was only
// ever normalised once, straight from what someone typed, but this function
// has to be safe to run on its own output, since a normalised symbol is what
// the chord book files a chord under.
const SUFFIX_ALIASES: [RegExp, string][] = [
  [/^M$/, ''],
  [/^M7$/, 'maj7'],
  [/^(mmaj7|minmaj7|mM7)$/i, 'mMaj7'],
  [/^(augmaj7|augM7|\+maj7)$/i, 'augMaj7'],
  [/^(maj|major)$/i, ''],
  [/^(min|minor|m)$/i, 'm'],
  [/^(maj7|major7)$/i, 'maj7'],
  [/^(min7|minor7|m7)$/i, 'm7'],
  [/^(dom7|7)$/i, '7'],
  [/^(dim|diminished|o)$/i, 'dim'],
  [/^(dim7|o7)$/i, 'dim7'],
  [/^(aug|augmented|\+)$/i, 'aug'],
  [/^(m7b5|ø7?|halfdim)$/i, 'm7b5'],
  // Bare "sus" is sus4 on every chord sheet that writes it.
  [/^sus4?$/i, 'sus4'],
  [/^sus2$/i, 'sus2'],
  [/^(madd9|madd2|minadd9|m2)$/i, 'madd9'],
  [/^(add9|add2|2)$/i, 'add9'],
  [/^5$/, '5'],
  [/^M6$/, '6'],
  [/^(m6|min6|minor6)$/i, 'm6'],
  [/^(6|maj6|major6)$/i, '6'],
  [/^7sus4?$/i, '7sus4'],
  [/^M9$/, 'maj9'],
  [/^(maj9|major9)$/i, 'maj9'],
  [/^(m9|min9|minor9)$/i, 'm9'],
  [/^(9|dom9)$/i, '9'],
  [/^7#9$/i, '7#9']
];

/** Suffixes we don't model but that are still chord qualities, not words. */
const QUALITY_LIKE = /^(sus[24]?|add[0-9]+|maj[0-9]+|m?[0-9]+|[#b][0-9]+|6\/9|m6|5)$/i;

const TYPE_BY_SUFFIX: Record<string, ChordTypeId> = {
  '': 'maj', m: 'min', '7': 'dom7', maj7: 'maj7', m7: 'min7',
  dim: 'dim', dim7: 'dim7', aug: 'aug', m7b5: 'm7b5',
  // Shapes exist for both, so the catalogue can draw them; without these two
  // the symbol could be written but never read back, and a chord you cannot
  // read back is one the chord book cannot file.
  mMaj7: 'mMaj7', augMaj7: 'augMaj7',
  sus2: 'sus2', sus4: 'sus4',
  add9: 'add9', madd9: 'madd9', '5': 'pow5', '6': 'maj6', m6: 'min6',
  '7sus4': 'dom7sus4', '9': 'dom9', m9: 'min9', maj9: 'maj9', '7#9': 'dom7s9'
};

/** "A min" → "Am", "F maj" → "F", "B7" → "B7". Unreadable input comes back trimmed. */
export function normalizeChordSymbol(raw: string): string {
  const text = raw.replace(/[♯]/g, '#').replace(/[♭]/g, 'b').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const m = /^([A-Ga-g])\s*([#b]?)\s*(.*)$/.exec(text);
  if (!m) return text;
  const root = m[1].toUpperCase() + m[2];
  if (NOTE_INDEX[root] === undefined) return text;
  let rest = m[3].trim();
  // Brackets hold one of two things. A quality, "G(add9)", "C(maj7)", is
  // part of the chord and is read like any other suffix. Anything else is a
  // note to the player, "G(single strum)", "Am (let ring)", and is not part
  // of the chord at all: kept, it filed "G (single strum)" in the chord book
  // as a chord of its own. The words stay in the song's own text; only the
  // chord is read out of it.
  const bracketed = /^(.*?)\s*\((.*)\)$/.exec(rest);
  if (bracketed) {
    const inner = bracketed[2].trim();
    const isQuality = QUALITY_LIKE.test(inner) || SUFFIX_ALIASES.some(([pattern]) => pattern.test(inner));
    // "Cm(maj7)", "Am(add9)", "E7(#9)": the brackets only group what is
    // written straight after them.
    rest = isQuality ? bracketed[1].trim() + inner : bracketed[1].trim();
  }
  // "A min/C maj" is two chords offered as alternatives, a quality word
  // after the slash says so, where a slash chord ("Am/C", "D/F#") has only a
  // bass note there. The first is the chord; filed whole, the pair became a
  // chord called "Amin/C maj".
  const alternative = /^([^/]*)\/\s*[A-Ga-g][#b]?\s*(maj|min|major|minor|m|M|7|dim|aug|sus)/.exec(rest);
  if (alternative) rest = alternative[1].trim();
  // A slash chord, "D/F#", "Am7/G": the chord is read as usual and the bass
  // note comes along, spelled the same way.
  const slash = /^(.*?)\s*\/\s*([A-Ga-g])\s*([#b]?)$/.exec(rest);
  if (slash) {
    const bass = slash[2].toUpperCase() + slash[3];
    if (NOTE_INDEX[bass] !== undefined) return `${normalizeChordSymbol(root + slash[1])}/${bass}`;
  }
  if (!rest) return root;
  for (const [pattern, suffix] of SUFFIX_ALIASES) {
    if (pattern.test(rest)) return root + suffix;
  }
  // Something we do not model, sus4, add9. Keep it; it still means
  // something to whoever wrote it.
  return root + rest;
}

/**
 * A progression somebody typed, as chord symbols.
 *
 * Written progressions arrive in every notation there is, "Am Em F G",
 * "Am - Em - F - G", "Am → Em → F → G", a line copied out of a chat, and all
 * of them mean the same four chords. So every plausible separator is one:
 * spaces, commas, arrows, bar lines and the dashes people put between chords
 * when they are drawing the movement rather than subtracting anything.
 *
 * A dash on its own is dropped rather than read, which is the one place this
 * differs from the pattern parser next door, where a dash is a real rest.
 */
export function readChordLine(raw: string): string[] {
  return raw
    .split(/[\s,;|]+|→|->|>/)
    .map(token => token.trim())
    .filter(token => token.length > 0 && !/^[-\u2013\u2014]+$/.test(token))
    .map(token => normalizeChordSymbol(token))
    .filter(Boolean);
}

/**
 * "G D Em C" is four chords, the way most people type them, but "A min" and
 * "G (let ring)" are one. A word starts a new chord when it begins with a
 * capital note name, or is a whole lower-case chord on its own ("am", "e7");
 * anything else ("min", "maj7", "(let ring)") belongs to the chord before it.
 */
function splitSpacedChords(part: string): string[] {
  const words = part.trim().split(/\s+/).filter(Boolean);
  const chords: string[] = [];
  for (const word of words) {
    const starts = /^[A-G]/.test(word) || /^[a-g][#b♯♭]?m?\d*$/.test(word);
    if (starts || chords.length === 0) chords.push(word);
    else chords[chords.length - 1] += ` ${word}`;
  }
  return chords;
}

/** The progressions on one line, in order, each already normalised. */
export function parseProgressions(raw: string | undefined | null): string[][] {
  if (!raw) return [];
  return raw
    .split('|')
    .map(part =>
      part
        .split(/→|->|>|,|;/)
        .flatMap(splitSpacedChords)
        .map(token => normalizeChordSymbol(token))
        .filter(Boolean)
    )
    .filter(prog => prog.length > 0);
}

/**
 * A chord line with one chord taken out, and everything else left exactly as
 * it was typed, the spellings, the arrows, the spacing. A progression left
 * empty goes, along with its bar.
 */
export function stripChord(raw: string, isTarget: (token: string) => boolean): string {
  return raw
    .split('|')
    .map(part => {
      const lead = /^\s*/.exec(part)![0];
      const trail = /\s*$/.exec(part)![0];
      const pieces = part.trim().split(/(\s*(?:→|->|>|,|;)\s*)/);
      const tokens = pieces.filter((_, i) => i % 2 === 0);
      const seps = pieces.filter((_, i) => i % 2 === 1);
      const kept = tokens.filter(token => token.trim() && !isTarget(token));
      if (kept.length === 0) return null;
      return lead + kept.join(seps[0] ?? ' -> ') + trail;
    })
    .filter((part): part is string => part !== null)
    .join('|')
    .trim();
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
export interface ChordShape {
  rootPc: number;
  typeId: ChordTypeId;
  rootName: string;
  /** A slash chord's bass note, when it has one. */
  bassPc?: number;
  bassName?: string;
}

export function chordShape(symbol: string): ChordShape | null {
  const m = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(symbol.trim());
  if (!m) return null;
  const rootPc = NOTE_INDEX[m[1]];
  if (rootPc === undefined) return null;
  const typeId = TYPE_BY_SUFFIX[m[2].trim()];
  if (!typeId) return null;
  if (!m[3]) return { rootPc, typeId, rootName: m[1] };
  const bassPc = NOTE_INDEX[m[3]];
  if (bassPc === undefined) return null;
  // "C/C" is just C.
  if (bassPc === rootPc) return { rootPc, typeId, rootName: m[1] };
  return { rootPc, typeId, rootName: m[1], bassPc, bassName: m[3] };
}

/** "5th fret" → 5, "0th fret" → 0, "" → null. */
export function parseCapo(raw: string | undefined | null): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const m = /(\d+)/.exec(String(raw));
  return m ? Number(m[1]) : null;
}

export const capoLabel = (capo: number | null | undefined): string =>
  capo === null || capo === undefined ? 'No capo' : capo === 0 ? 'No capo' : `Capo ${capo}`;

/** "D minor · Capo 5", the one line that says how to pick the guitar up. */
export function songSubtitle(key: string | undefined, capo: number | null | undefined): string {
  const parts = [key?.trim(), capoLabel(capo)].filter(Boolean) as string[];
  return parts.join(' · ');
}
