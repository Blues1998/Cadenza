// Song Hero chart data: hand-authored, simplified arrangements of a small
// set of famous, recognizable tunes, playable via the app's own keyboard
// mapping (useComputerKeyboardInstrument for piano charts,
// useGuitarChordKeyboard for guitar charts) rather than real notation.
//
// IMPORTANT — these are best-effort simplified arrangements from general
// familiarity with each piece, not transcriptions verified against a
// professional score. Every event is written as a plain note-name + octave
// + beat position (not raw MIDI/timestamps) specifically so a human can
// proofread and correct one here without needing to touch any other file.
// Confidence varies per song — see each chart's `sourceNote`.

export type ChartInstrument = 'piano' | 'guitar';

interface SongMeta {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  timeSignature: number; // beats per bar
  countInBars: number;   // metronome lead-in bars before beat 0
  sourceNote: string;    // shown in the UI — arrangement/accuracy caveat
}

// One note, in plain note-name + octave + beat position — a human
// proofreading against sheet music can read this directly.
export interface PianoNoteEvent {
  beat: number;           // quarter-note beats from song start (0 = downbeat)
  noteName: string;       // e.g. 'F#', 'Eb' — matches musicTheory's note-name spellings
  octave: number;         // combined via noteNameToMidi(noteName, octave)
  durationBeats: number;  // Listen-mode note length + highway bar length; NOT used for judging (onset-only)
}
export interface PianoChart extends SongMeta {
  instrument: 'piano';
  homeOctave: number;     // useComputerKeyboardInstrument is locked here for the whole song
  notes: PianoNoteEvent[];
}

// One strum, referencing an existing GUITAR_CHORD_SHAPES id — grading
// reuses useGuitarChordKeyboard's heldShape state directly, no fret math here.
export interface GuitarStrumEvent {
  beat: number;
  chordId: string;          // one of 'C'|'G'|'D'|'A'|'E'|'Am'|'Em'|'Dm'
  direction: 'down' | 'up'; // display-only in v1, not graded
}
export interface GuitarChart extends SongMeta {
  instrument: 'guitar';
  strums: GuitarStrumEvent[];
}

export type SongChart = PianoChart | GuitarChart;

// ---------------------------------------------------------------------
// Hedwig's Theme — Harry Potter (John Williams)
// The famous celesta opening phrase. Transposed to fit one playable
// octave window (C4-C5) rather than its original register — the melodic
// shape (a rising leap answered by a stepwise fall) is the recognizable
// part, and that's preserved.
// ---------------------------------------------------------------------
const HEDWIG: PianoChart = {
  id: 'hedwig',
  title: "Hedwig's Theme",
  subtitle: 'Harry Potter — John Williams',
  bpm: 128,
  timeSignature: 3,
  countInBars: 2,
  homeOctave: 4,
  sourceNote: 'Simplified, best-effort arrangement of the opening phrase, transposed to fit one playable octave — not a verified transcription.',
  instrument: 'piano',
  notes: [
    { beat: 0,  noteName: 'Eb', octave: 4, durationBeats: 1 },
    { beat: 1,  noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 2,  noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 3,  noteName: 'C',  octave: 5, durationBeats: 3 },
    { beat: 6,  noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 7,  noteName: 'Ab', octave: 4, durationBeats: 1 },
    { beat: 8,  noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 9,  noteName: 'F',  octave: 4, durationBeats: 3 },
    { beat: 12, noteName: 'Eb', octave: 4, durationBeats: 1 },
    { beat: 13, noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 14, noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 15, noteName: 'C',  octave: 5, durationBeats: 3 },
    { beat: 18, noteName: 'C',  octave: 5, durationBeats: 1 },
    { beat: 19, noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 20, noteName: 'Ab', octave: 4, durationBeats: 1 },
    { beat: 21, noteName: 'G',  octave: 4, durationBeats: 3 },
    { beat: 24, noteName: 'Eb', octave: 4, durationBeats: 1 },
    { beat: 25, noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 26, noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 27, noteName: 'C',  octave: 5, durationBeats: 3 },
    { beat: 30, noteName: 'C',  octave: 5, durationBeats: 1 },
    { beat: 31, noteName: 'Bb', octave: 4, durationBeats: 1 },
    { beat: 32, noteName: 'Ab', octave: 4, durationBeats: 1 },
    { beat: 33, noteName: 'Ab', octave: 4, durationBeats: 3 },
    { beat: 36, noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 37, noteName: 'F',  octave: 4, durationBeats: 1 },
    { beat: 38, noteName: 'Eb', octave: 4, durationBeats: 1 },
    { beat: 39, noteName: 'D',  octave: 4, durationBeats: 3 },
    { beat: 42, noteName: 'Eb', octave: 4, durationBeats: 1 },
    { beat: 43, noteName: 'F',  octave: 4, durationBeats: 1 },
    { beat: 44, noteName: 'G',  octave: 4, durationBeats: 1 },
    { beat: 45, noteName: 'C',  octave: 4, durationBeats: 3 },
  ],
};

// ---------------------------------------------------------------------
// Game of Thrones — Main Title (Ramin Djawadi)
// The driving repeated-cell cello ostinato under a rising four-chord
// vamp (i-VI-III-VII), rather than the ostinato+horn-melody combined —
// piano mode is single-line, so this picks the most recognizable line.
// ---------------------------------------------------------------------
const GAME_OF_THRONES: PianoChart = {
  id: 'got',
  title: 'Game of Thrones',
  subtitle: 'Main Title — Ramin Djawadi',
  bpm: 136,
  timeSignature: 4,
  countInBars: 2,
  homeOctave: 4,
  sourceNote: 'Simplified ostinato capturing the driving repeated-note rhythm over the theme\'s rising chord sequence — not a full multi-part transcription.',
  instrument: 'piano',
  notes: (() => {
    // Repeating cell: root-root-fifth (eighth, eighth, quarter) played
    // twice per bar, cycling through Cm - Ab - Eb - Bb, run twice through.
    const cells: { root: string; aux: string }[] = [
      { root: 'C',  aux: 'G'  },
      { root: 'Ab', aux: 'Eb' },
      { root: 'Eb', aux: 'Bb' },
      { root: 'Bb', aux: 'F'  },
    ];
    const events: PianoNoteEvent[] = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      cells.forEach((cell, i) => {
        const barStart = (cycle * cells.length + i) * 4;
        events.push(
          { beat: barStart,       noteName: cell.root, octave: 4, durationBeats: 0.5 },
          { beat: barStart + 0.5, noteName: cell.root, octave: 4, durationBeats: 0.5 },
          { beat: barStart + 1,   noteName: cell.aux,  octave: 4, durationBeats: 1 },
          { beat: barStart + 2,   noteName: cell.root, octave: 4, durationBeats: 0.5 },
          { beat: barStart + 2.5, noteName: cell.root, octave: 4, durationBeats: 0.5 },
          { beat: barStart + 3,   noteName: cell.aux,  octave: 4, durationBeats: 1 },
        );
      });
    }
    return events;
  })(),
};

// ---------------------------------------------------------------------
// Senya — Naruto Shippuden OST
// LOWER CONFIDENCE than the other three: this is a deeper OST cut, not
// one of the series' most universally-covered tracks. What follows is a
// generic slow, plaintive stepwise minor-key phrase capturing the mood
// this piece is known for, NOT a confident note-for-note transcription —
// treat this one as a placeholder that most needs a correction pass.
// ---------------------------------------------------------------------
const SENYA: PianoChart = {
  id: 'senya',
  title: 'Senya',
  subtitle: 'Naruto Shippuden OST',
  bpm: 72,
  timeSignature: 4,
  countInBars: 1,
  homeOctave: 4,
  sourceNote: 'Placeholder arrangement — a generic slow, plaintive minor-key phrase in the mood of this piece. Lower confidence than the other songs here; most in need of correction against a real recording.',
  instrument: 'piano',
  notes: [
    { beat: 0,  noteName: 'C',  octave: 5, durationBeats: 2 },
    { beat: 2,  noteName: 'Bb', octave: 4, durationBeats: 2 },
    { beat: 4,  noteName: 'Ab', octave: 4, durationBeats: 2 },
    { beat: 6,  noteName: 'G',  octave: 4, durationBeats: 2 },
    { beat: 8,  noteName: 'F',  octave: 4, durationBeats: 2 },
    { beat: 10, noteName: 'Eb', octave: 4, durationBeats: 2 },
    { beat: 12, noteName: 'D',  octave: 4, durationBeats: 2 },
    { beat: 14, noteName: 'C',  octave: 4, durationBeats: 2 },
    { beat: 16, noteName: 'Eb', octave: 4, durationBeats: 2 },
    { beat: 18, noteName: 'F',  octave: 4, durationBeats: 2 },
    { beat: 20, noteName: 'G',  octave: 4, durationBeats: 2 },
    { beat: 22, noteName: 'Ab', octave: 4, durationBeats: 2 },
    { beat: 24, noteName: 'Bb', octave: 4, durationBeats: 2 },
    { beat: 26, noteName: 'C',  octave: 5, durationBeats: 2 },
    { beat: 28, noteName: 'C',  octave: 5, durationBeats: 4 },
    { beat: 32, noteName: 'Bb', octave: 4, durationBeats: 2 },
    { beat: 34, noteName: 'Ab', octave: 4, durationBeats: 2 },
    { beat: 36, noteName: 'G',  octave: 4, durationBeats: 2 },
    { beat: 38, noteName: 'F',  octave: 4, durationBeats: 2 },
    { beat: 40, noteName: 'Eb', octave: 4, durationBeats: 2 },
    { beat: 42, noteName: 'D',  octave: 4, durationBeats: 2 },
    { beat: 44, noteName: 'C',  octave: 4, durationBeats: 4 },
  ],
};

// ---------------------------------------------------------------------
// Tuyo — Narcos theme (Rodrigo Amarante)
// A repeating minor-key chord vamp. Adapted to fit only the 8 open-chord
// shapes this app supports (no Bb/F barre shapes) — Dm-C-Am-Em stands in
// for the real progression's exact chords. The chord sequence is the
// higher-confidence part; the strum pattern is a simple generic down/up,
// not an attempt at the record's actual fingerpicking.
// ---------------------------------------------------------------------
const TUYO: GuitarChart = {
  id: 'tuyo',
  title: 'Tuyo',
  subtitle: 'Narcos Main Title — Rodrigo Amarante',
  bpm: 100,
  timeSignature: 3,
  countInBars: 2,
  sourceNote: 'Chord progression adapted to fit this app\'s 8 open-chord shapes (Dm-C-Am-Em stands in for the real changes), with a simple generic strum pattern rather than the record\'s actual fingerpicking — not a verified transcription.',
  instrument: 'guitar',
  strums: (() => {
    const progression = ['Dm', 'C', 'Am', 'Em'];
    const events: GuitarStrumEvent[] = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      progression.forEach((chordId, i) => {
        const barStart = (cycle * progression.length + i) * 3;
        events.push(
          { beat: barStart,       chordId, direction: 'down' },
          { beat: barStart + 1.5, chordId, direction: 'up' },
        );
      });
    }
    return events;
  })(),
};

export const SONG_CHARTS: SongChart[] = [HEDWIG, GAME_OF_THRONES, SENYA, TUYO];
