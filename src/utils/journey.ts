// The Guided Journey: a linear beginner curriculum that strings the labs
// together. Each level = one plain-English idea + one concrete task in a lab,
// completed automatically when the lab reports the required progress events.

import type { ActiveTab } from '../components/Sidebar';
import { getProgressCount } from './progress';

export interface LevelRequirement {
  event: string;
  count: number;
}

export interface JourneyLevel {
  id: string;
  title: string;
  idea: string;   // the concept, in two sentences max
  task: string;   // exactly what to do
  tab: ActiveTab;
  buttonText: string;
  requirements: LevelRequirement[];
}

export interface JourneyChapter {
  title: string;
  emoji: string;
  levels: JourneyLevel[];
}

export const XP_PER_LEVEL = 50;

export const JOURNEY: JourneyChapter[] = [
  {
    title: 'Sound & Your Instrument',
    emoji: '🔊',
    levels: [
      {
        id: 'hear-a-note',
        title: 'Hear what a note is made of',
        idea: 'A musical note is not one frequency — it is a stack of overtones, and the mix is why a guitar sounds different from a flute.',
        task: 'In Sound Physics, press "Hear this exact waveform" in the harmonic series explorer. Try two different presets.',
        tab: 'physics',
        buttonText: 'Open Sound Physics',
        requirements: [{ event: 'physics-harmonic-played', count: 2 }]
      },
      {
        id: 'wake-the-tuner',
        title: 'Let the app hear you',
        idea: 'The app can identify any note you play or sing, in real time, from your microphone.',
        task: 'Open the Tuner, allow microphone access, and play or sing any note until it shows up on screen.',
        tab: 'tuner',
        buttonText: 'Open Tuner',
        requirements: [{ event: 'tuner-pitch-detected', count: 1 }]
      },
      {
        id: 'first-match',
        title: 'Match your first pitch',
        idea: 'Playing "in tune" means landing within a few cents of a target frequency — and you can watch yourself do it.',
        task: 'In the Tuner, switch to Practice Game and successfully match one target note.',
        tab: 'tuner',
        buttonText: 'Play the Pitch Game',
        requirements: [{ event: 'tuner-note-matched', count: 1 }]
      }
    ]
  },
  {
    title: 'Scales — Families of Notes',
    emoji: '🎼',
    levels: [
      {
        id: 'happy-vs-sad',
        title: 'Hear happy vs sad',
        idea: 'A scale is a family of notes that belong together. Major sounds happy, minor sounds sad — same recipe, three notes lowered.',
        task: 'In Theory & Scales, play the Major scale sweep, then switch to Natural Minor and play it again. Hear the mood flip.',
        tab: 'theory',
        buttonText: 'Open Theory & Scales',
        requirements: [
          { event: 'theory-scale-played:major', count: 1 },
          { event: 'theory-scale-played:minor', count: 1 }
        ]
      },
      {
        id: 'first-climb',
        title: 'Climb a scale on your instrument',
        idea: 'Theory sticks when your hands do it. The amber marker shows the note to play; the app confirms each one by ear.',
        task: 'In Play Challenges, complete one full Scale Climb round (any scale, any root).',
        tab: 'play',
        buttonText: 'Start Scale Climb',
        requirements: [{ event: 'play-scale-completed', count: 1 }]
      },
      {
        id: 'pentatonic',
        title: 'The five-note shortcut',
        idea: 'Drop two notes from a scale and you get the pentatonic — the foolproof scale rock and blues solos are built on.',
        task: 'In Play Challenges, select a Pentatonic scale in Scale Climb settings and complete a round.',
        tab: 'play',
        buttonText: 'Climb a Pentatonic',
        requirements: [{ event: 'play-scale-completed:pentatonic', count: 1 }]
      }
    ]
  },
  {
    title: 'Intervals — Distances Between Notes',
    emoji: '📏',
    levels: [
      {
        id: 'interval-songs',
        title: 'Every interval has a song',
        idea: 'An interval is the distance between two notes, and each one has a distinct feeling — famous songs are the cheat codes for recognizing them.',
        task: 'In Ear Training (Intervals mode), get 3 answers correct. Use the song-clue cheat sheet freely.',
        tab: 'ear-training',
        buttonText: 'Train Intervals',
        requirements: [{ event: 'ear-interval-correct', count: 3 }]
      },
      {
        id: 'interval-hunt',
        title: 'Find intervals by hand',
        idea: 'On a guitar, one fret = one semitone. A perfect fifth is seven frets — intervals are physical distances you can see.',
        task: 'In Play Challenges → Interval Hunt, answer 2 intervals correctly on your instrument.',
        tab: 'play',
        buttonText: 'Start Interval Hunt',
        requirements: [{ event: 'play-interval-completed', count: 2 }]
      }
    ]
  },
  {
    title: 'Chords — Notes Stacked Up',
    emoji: '🎹',
    levels: [
      {
        id: 'chord-flavors',
        title: 'Taste the chord flavors',
        idea: 'A chord is several notes at once, and tiny spacing changes flip its whole mood: happy, sad, tense, dreamy.',
        task: 'In Ear Training (Chords mode), identify 3 chords correctly by their feeling.',
        tab: 'ear-training',
        buttonText: 'Train Chords',
        requirements: [{ event: 'ear-chord-correct', count: 3 }]
      },
      {
        id: 'build-chords',
        title: 'Build chords note by note',
        idea: 'Every triad is just root + third + fifth. Build them yourself and the formulas stop being abstract.',
        task: 'In Play Challenges → Chord Builder, complete 2 chords on your instrument.',
        tab: 'play',
        buttonText: 'Start Chord Builder',
        requirements: [{ event: 'play-chord-completed', count: 2 }]
      },
      {
        id: 'why-chords-work',
        title: 'See why chords sound good',
        idea: 'Consonance is physics: frequencies in simple ratios like 3:2 make waves that line up. Beating is what "out of tune" literally looks like.',
        task: 'In Sound Physics, turn the two-tone sound on and drag the slider until you lock onto a simple ratio.',
        tab: 'physics',
        buttonText: 'Explore Ratios',
        requirements: [{ event: 'physics-ratio-locked', count: 1 }]
      }
    ]
  },
  {
    title: 'Keys & the Circle of Fifths',
    emoji: '🧭',
    levels: [
      {
        id: 'meet-the-circle',
        title: 'Meet the circle of fifths',
        idea: 'A key is a home note plus its scale. The circle arranges all 12 keys so that neighbors share almost all their notes.',
        task: 'In Theory & Scales, click 3 different keys on the Circle of Fifths and hear their home chords.',
        tab: 'theory',
        buttonText: 'Explore the Circle',
        requirements: [{ event: 'theory-circle-key-clicked', count: 3 }]
      },
      {
        id: 'chords-that-belong',
        title: 'Chords that belong together',
        idea: 'Each key owns seven chords built from its own notes. Most songs you know use only those — that is why they sound coherent.',
        task: 'In Theory & Scales, click 4 of the "chords that belong" buttons in a row — congratulations, that is a chord progression.',
        tab: 'theory',
        buttonText: 'Play Key Chords',
        requirements: [{ event: 'theory-diatonic-played', count: 4 }]
      },
      {
        id: 'walk-the-circle',
        title: 'Walk the whole circle',
        idea: 'Stepping by fifths (+7 semitones) visits all 12 notes exactly once, because gcd(7, 12) = 1. The circle of fifths is modular arithmetic.',
        task: 'In Sound Physics, run the (n + 7) mod 12 walk to completion with step size +7.',
        tab: 'physics',
        buttonText: 'Walk the Circle',
        requirements: [{ event: 'physics-circle-completed', count: 1 }]
      }
    ]
  },
  {
    title: 'Rhythm — Music in Time',
    emoji: '⏱️',
    levels: [
      {
        id: 'steady-hands',
        title: 'Lock into the beat',
        idea: 'Rhythm is hitting the right moment, not just the right note. The app measures your timing to the millisecond.',
        task: 'In the Rhythm Lab game, land 5 PERFECT taps (within 45 ms of the beat).',
        tab: 'rhythm',
        buttonText: 'Open Rhythm Lab',
        requirements: [{ event: 'rhythm-perfect-tap', count: 5 }]
      }
    ]
  }
];

export const ALL_LEVELS: JourneyLevel[] = JOURNEY.flatMap(c => c.levels);

export function isLevelComplete(level: JourneyLevel): boolean {
  return level.requirements.every(req => getProgressCount(req.event) >= req.count);
}

// Levels unlock strictly in order; the current level is the first incomplete one
export function getCurrentLevelIndex(): number {
  for (let i = 0; i < ALL_LEVELS.length; i++) {
    if (!isLevelComplete(ALL_LEVELS[i])) return i;
  }
  return ALL_LEVELS.length; // journey finished
}

// Requirement progress for a level as [met, needed]
export function levelProgress(level: JourneyLevel): [number, number] {
  const met = level.requirements.reduce(
    (acc, req) => acc + Math.min(getProgressCount(req.event), req.count), 0
  );
  const needed = level.requirements.reduce((acc, req) => acc + req.count, 0);
  return [met, needed];
}
