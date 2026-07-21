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

// Beginner-friendly explanations of guitar tab technique markings (hammer-on,
// slide, palm mute, etc.), shown as tooltips via the <Term> component — same
// pattern as GLOSSARY above, just pointed at tab notation instead of theory.
export interface TabTechniqueEntry {
  symbol: string;
  title: string;
  definition: string;
}

export const TAB_TECHNIQUES: Record<string, TabTechniqueEntry> = {
  hammerOn: {
    symbol: 'H',
    title: 'Hammer-On',
    definition:
      'Pick the first note, then sound the next (higher) note just by tapping the fret with your fretting finger — no second pick needed. Gives a smooth, slurred feel.'
  },
  pullOff: {
    symbol: 'P',
    title: 'Pull-Off',
    definition:
      'The reverse of a hammer-on: while holding a fretted note, pick it, then flick the finger off to sound a lower note underneath — again, no second pick.'
  },
  slide: {
    symbol: 'sl',
    title: 'Slide',
    definition:
      'Pick the first note, then slide your fretting finger along the string to the next note without picking again. The pitch glides smoothly between the two.'
  },
  bend: {
    symbol: 'b',
    title: 'Bend',
    definition:
      "Push or pull the string sideways across the fret to raise its pitch without moving to a new fret — that expressive, vocal-like guitar sound."
  },
  bendRelease: {
    symbol: 'r',
    title: 'Bend Release',
    definition: 'After bending a string up, let it relax back down to its original pitch while still holding the note.'
  },
  vibrato: {
    symbol: '~',
    title: 'Vibrato',
    definition:
      "Wiggle the fretted note slightly and repeatedly so the pitch wavers — adds warmth and expression, like a singer's voice shaking on a held note."
  },
  palmMute: {
    symbol: 'PM',
    title: 'Palm Mute',
    definition:
      'Rest the edge of your picking-hand palm lightly on the strings near the bridge while picking, for a muted, percussive "chugging" tone.'
  },
  letRing: {
    symbol: 'let ring',
    title: 'Let Ring',
    definition:
      "Let the note keep ringing out instead of stopping it — don't mute the string, allow it to sustain even as you move on to the next note."
  },
  ghostNote: {
    symbol: '( )',
    title: 'Ghost Note',
    definition: 'A very quietly played note, barely audible — shown in parentheses. Felt more as rhythm than heard as a clear pitch.'
  },
  deadNote: {
    symbol: 'x',
    title: 'Dead Note / Mute',
    definition: 'Lightly touch the string without pressing it to a fret, then pick it — you get a percussive click or thud instead of a clear pitch.'
  },
  harmonic: {
    symbol: '◇',
    title: 'Harmonic',
    definition:
      'Touch the string very lightly at an exact point (instead of pressing down) to ring out a bell-like, chiming overtone instead of the normal fretted pitch.'
  },
  tie: {
    symbol: '⌣',
    title: 'Tie',
    definition: 'Hold the first note through into the next instead of picking again — the two notes join into one continuous sound.'
  },
  staccato: {
    symbol: '.',
    title: 'Staccato',
    definition: 'Cut the note short and detached rather than letting it ring out — the opposite of let-ring.'
  },
  trill: {
    symbol: 'tr',
    title: 'Trill',
    definition: 'Rapidly alternate back and forth between two notes, over and over, for a fluttering, ornamental effect.'
  },
  tremoloPicking: {
    symbol: '≡',
    title: 'Tremolo Picking',
    definition:
      'Pick the same note extremely fast, repeatedly, for a sustained, shimmering, rapid-fire sound — famous in pieces like "Recuerdos de la Alhambra."'
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
