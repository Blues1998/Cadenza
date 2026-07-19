// Beginner-friendly explanations of music theory terms, shown as tooltips
// via the <Term> component. Kept in one place so every lab can reuse them.

export interface GlossaryEntry {
  title: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  rootNote: {
    title: 'Root Note',
    definition:
      "The 'home base' note. The scale or chord is built starting from this note, and melodies feel finished when they land back on it."
  },
  octave: {
    title: 'Octave',
    definition:
      'How high or low the note sits. Going up one octave means the same note name, just higher — like a child and an adult singing the same song.'
  },
  scale: {
    title: 'Scale',
    definition:
      'A family of notes that sound good together. Songs pick their melody notes from a scale the way a painting picks from a color palette.'
  },
  scaleFormula: {
    title: 'Scale Formula',
    definition:
      'The recipe of steps between the notes. Changing the recipe changes the mood — that is the whole difference between happy Major and sad Minor.'
  },
  chordQuality: {
    title: 'Chord Quality',
    definition:
      "A chord is several notes played at once. Its 'quality' is the flavor — the spacing between the notes decides whether it sounds happy, sad, tense, or dreamy."
  },
  circleOfFifths: {
    title: 'Circle of Fifths',
    definition:
      'A map of all 12 musical keys. Keys next to each other on the circle share almost all their notes, so they blend well — distant keys sound like a bigger jump.'
  },
  musicalKey: {
    title: 'Key',
    definition:
      "The home neighborhood of a song: one home note plus the scale built on it. 'Key of C' means C is home and the song mostly uses C-major-scale notes."
  },
  relativeMinor: {
    title: 'Relative Minor',
    definition:
      'The sad-sounding twin of a major key. It uses exactly the same notes, but treats a different note as home — which flips the mood from bright to moody.'
  },
  accidentals: {
    title: 'Accidentals (♯ / ♭)',
    definition:
      'How many sharps (♯) or flats (♭) a key uses — roughly, how many black piano keys are involved. C major uses none, which is why it is the beginner favorite.'
  },
  diatonicChords: {
    title: 'Chords in this Key',
    definition:
      "The seven chords built using only this key's notes. Most songs use just these — that is why they sound like they belong together. Try clicking a few in a row!"
  },
  romanNumerals: {
    title: 'Roman Numerals (I, ii, V…)',
    definition:
      'Shorthand for which note of the key a chord is built on (I = 1st note, V = 5th). UPPERCASE = happy major, lowercase = sad minor, ° = tense diminished.'
  }
};

// Feeling-based names for chord qualities. Wording matches the Ear Training
// lab's beginner labels so the app speaks one consistent language.
export const CHORD_FEELINGS: Record<string, string> = {
  'Major Triad': 'Happy',
  'Minor Triad': 'Sad',
  'Diminished Triad': 'Mysterious',
  'Augmented Triad': 'Tense',
  'Major 7th': 'Dreamy',
  'Minor 7th': 'Mellow',
  'Dominant 7th': 'Bluesy',
  'Half-Diminished 7th': 'Complex',
  'Diminished 7th': 'Suspenseful'
};

// Feeling-based names and one-line listening guides for the Theory lab scales.
export interface ScaleFeeling {
  feeling: string;
  listenFor: string;
}

export const SCALE_FEELINGS: Record<string, ScaleFeeling> = {
  'Major (Ionian)': {
    feeling: 'Happy & Bright',
    listenFor: 'the cheerful, sunny sound most children’s songs and pop choruses use.'
  },
  'Natural Minor (Aeolian)': {
    feeling: 'Sad & Moody',
    listenFor: 'the melancholy sound of sad ballads — same recipe as major, but with three notes lowered.'
  },
  'Harmonic Minor': {
    feeling: 'Dramatic & Exotic',
    listenFor: 'a mysterious, almost Middle-Eastern twist created by one raised note near the top.'
  },
  'Pentatonic Major': {
    feeling: 'Simple & Cheerful',
    listenFor: 'a foolproof five-note version of major — campfire songs and country riffs live here.'
  },
  'Pentatonic Minor': {
    feeling: 'Cool & Rock-ready',
    listenFor: 'the go-to five-note scale for rock and blues guitar solos.'
  },
  'Blues Scale': {
    feeling: 'Gritty & Soulful',
    listenFor: 'pentatonic minor plus one extra ‘blue note’ that adds the signature bluesy sting.'
  }
};
