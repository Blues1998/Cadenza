// Every chord there is, arranged the ways a guitarist actually looks for one.
//
// A flat list of a hundred and thirty-two chords is a data dump. The four
// arrangements here are the four questions people arrive with, and each one is
// a different page of the same book:
//
//   Root        "what else can I play in A?"        — twelve groups
//   Quality     "show me the minor sevenths"        — one group per shape family
//   Difficulty  "what can I learn this week?"       — three groups, easiest first
//   Key         "what chords are in A minor?"       — the seven that belong together
//
// The last one is the one that matters for playing songs, and it is the reason
// this list is not just a reference: a key is a set of chords that turn up in
// each other's company, so filling in the gaps in one key unlocks whole songs
// rather than single chords.
//
// Nothing here reads the chord book. The catalogue is the same for everybody;
// what you can play of it is a separate fact laid over the top.

import {
  CHORD_TYPES,
  getScaleChords,
  getVoicings,
  type ChordTypeId,
  type DifficultyTier
} from './chords';
import { NOTE_NAMES, SCALE_FORMULAS, type ScaleFormula } from './musicTheory';
import { normalizeChordSymbol } from './songText';

export type GroupBy = 'root' | 'quality' | 'difficulty' | 'key';

export const GROUP_LABEL: Record<GroupBy, string> = {
  root: 'Root',
  quality: 'Quality',
  difficulty: 'Difficulty',
  key: 'Key'
};

/** Sharp spelling above, flat below — the same fret, written two ways. */
export const FLAT_NAMES: Record<string, string> = {
  'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭'
};

export const noteLabel = (name: string): string =>
  FLAT_NAMES[name] ? `${name} / ${FLAT_NAMES[name]}` : name;

/**
 * The types the catalogue lists, in the order they are usually met.
 *
 * Every one of them can be written as a symbol and read back as the same
 * chord. A type that only round-trips one way would put cards in the
 * catalogue that the chord book could not file.
 */
export const CATALOGUE_TYPES: ChordTypeId[] = [
  'maj', 'min', 'dom7', 'maj7', 'min7', 'dim', 'm7b5', 'dim7', 'aug', 'mMaj7', 'augMaj7'
];

export interface CatalogueChord {
  symbol: string;
  rootPc: number;
  rootName: string;
  typeId: ChordTypeId;
  typeName: string;
  /** How hard the easiest known shape is, and which band that puts it in. */
  difficulty: number;
  tier: DifficultyTier;
  /** Set only in a key grouping: 'i', 'IV', 'vii°'. */
  numeral?: string;
}

export interface ChordGroup {
  id: string;
  title: string;
  subtitle?: string;
  chords: CatalogueChord[];
}

const symbolFor = (rootName: string, typeId: ChordTypeId): string =>
  normalizeChordSymbol(rootName + CHORD_TYPES[typeId].suffix);

const describe = (rootPc: number, typeId: ChordTypeId, numeral?: string): CatalogueChord => {
  const rootName = NOTE_NAMES[rootPc];
  const easiest = getVoicings(rootPc, typeId, rootName)[0];
  return {
    symbol: symbolFor(rootName, typeId),
    rootPc,
    rootName,
    typeId,
    typeName: CHORD_TYPES[typeId].name,
    difficulty: easiest?.difficulty ?? 99,
    tier: easiest?.tier ?? 'hard',
    numeral
  };
};

let cache: CatalogueChord[] | null = null;

/** Every root against every type. Built once — placing shapes is not free. */
export function allChords(): CatalogueChord[] {
  if (cache) return cache;
  const out: CatalogueChord[] = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const typeId of CATALOGUE_TYPES) out.push(describe(rootPc, typeId));
  }
  cache = out;
  return out;
}

const TIER_TITLE: Record<DifficultyTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
};

const TIER_NOTE: Record<DifficultyTier, string> = {
  easy: 'Open shapes and three-finger grips',
  medium: 'Barres and wider stretches',
  hard: 'Full barres high on the neck'
};

export function groupChords(chords: CatalogueChord[], by: GroupBy): ChordGroup[] {
  if (by === 'quality') {
    return CATALOGUE_TYPES
      .map(typeId => ({
        id: typeId,
        title: CHORD_TYPES[typeId].name,
        subtitle: CHORD_TYPES[typeId].intervals.join(' · ') + ' semitones',
        chords: chords.filter(c => c.typeId === typeId)
      }))
      .filter(g => g.chords.length > 0);
  }

  if (by === 'difficulty') {
    return (['easy', 'medium', 'hard'] as DifficultyTier[])
      .map(tier => ({
        id: tier,
        title: TIER_TITLE[tier],
        subtitle: TIER_NOTE[tier],
        chords: chords.filter(c => c.tier === tier).sort((a, b) => a.difficulty - b.difficulty)
      }))
      .filter(g => g.chords.length > 0);
  }

  // Root, and the fallback for a key grouping with no key chosen.
  return NOTE_NAMES
    .map((name, rootPc) => ({
      id: name,
      title: noteLabel(name),
      chords: chords.filter(c => c.rootPc === rootPc)
    }))
    .filter(g => g.chords.length > 0);
}

export interface KeyChoice {
  rootPc: number;
  scaleName: string;
  sevenths: boolean;
}

/**
 * The chords that belong to one key, in scale order with their numerals.
 *
 * Built on the same harmoniser the theory screens use, so a key here means
 * exactly what it means everywhere else in the app — including the part where
 * a pentatonic borrows its parent scale's chords, since stacking thirds on
 * five notes gives sonorities nobody calls chords.
 */
export function keyGroup(choice: KeyChoice): ChordGroup | null {
  const scale: ScaleFormula | undefined = SCALE_FORMULAS.find(s => s.name === choice.scaleName);
  if (!scale) return null;
  const set = getScaleChords(choice.rootPc, scale, choice.sevenths, SCALE_FORMULAS);
  if (set.chords.length === 0) return null;

  const chords = set.chords.map(sc => ({
    ...describe(sc.rootPc, sc.type.id, sc.numeral),
    // The spelled root from the harmoniser, so a key of F shows Bb and not A#.
    symbol: normalizeChordSymbol(sc.symbol),
    rootName: sc.rootName
  }));

  return {
    id: `key-${choice.rootPc}-${choice.scaleName}`,
    title: `${NOTE_NAMES[choice.rootPc]} ${choice.scaleName}`,
    subtitle: set.borrowedFrom
      ? `Harmonised from ${set.borrowedFrom} · ${set.scaleNotes.join(' ')}`
      : set.scaleNotes.join(' '),
    chords
  };
}
