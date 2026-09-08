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
  idea: string;   // the concept, in one sentence
  task: string;   // exactly what to do, as one instruction
  tab: ActiveTab;
  buttonText: string;
  requirements: LevelRequirement[];
}

export interface JourneyChapter {
  title: string;
  levels: JourneyLevel[];
}

export const XP_PER_LEVEL = 50;

export const JOURNEY: JourneyChapter[] = [
  {
    title: 'Sound & Your Instrument',
    levels: [
      {
        id: 'hear-a-note',
        title: 'Hear what a note is made of',
        idea: 'A note is a stack of overtones. The mix is why a guitar and a flute differ.',
        task: 'Hear two different harmonic presets.',
        tab: 'physics',
        buttonText: 'Sound Physics',
        requirements: [{ event: 'physics-harmonic-played', count: 2 }]
      },
      {
        id: 'wake-the-tuner',
        title: 'Let the app hear you',
        idea: 'The app can name any note you play or sing, live, from the mic.',
        task: 'Allow the mic, then play or sing anything.',
        tab: 'tuner',
        buttonText: 'Tuner',
        requirements: [{ event: 'tuner-pitch-detected', count: 1 }]
      },
      {
        id: 'first-match',
        title: 'Match your first pitch',
        idea: 'In tune means within a few cents of the target — and you can watch yourself land it.',
        task: 'Match one target note in Practice Game.',
        tab: 'tuner',
        buttonText: 'Pitch Game',
        requirements: [{ event: 'tuner-note-matched', count: 1 }]
      }
    ]
  },
  {
    title: 'Scales',
    levels: [
      {
        id: 'happy-vs-sad',
        title: 'Hear happy vs sad',
        idea: 'A scale is a family of notes. Major is happy, minor is sad — same recipe, three notes lowered.',
        task: 'Play Major, then Natural Minor. Hear the mood flip.',
        tab: 'theory',
        buttonText: 'Theory & Scales',
        requirements: [
          { event: 'theory-scale-played:major', count: 1 },
          { event: 'theory-scale-played:minor', count: 1 }
        ]
      },
      {
        id: 'first-climb',
        title: 'Climb a scale on your instrument',
        idea: 'Theory sticks when your hands do it. The app confirms each note by ear.',
        task: 'Finish one Scale Climb round.',
        tab: 'play',
        buttonText: 'Scale Climb',
        requirements: [{ event: 'play-scale-completed', count: 1 }]
      },
      {
        id: 'pentatonic',
        title: 'The five-note shortcut',
        idea: 'Drop two notes and you get the pentatonic — what rock and blues solos are built on.',
        task: 'Climb a pentatonic scale.',
        tab: 'play',
        buttonText: 'Scale Climb',
        requirements: [{ event: 'play-scale-completed:pentatonic', count: 1 }]
      }
    ]
  },
  {
    title: 'Intervals',
    levels: [
      {
        id: 'interval-songs',
        title: 'Every interval has a song',
        idea: 'An interval is the gap between two notes. Famous songs are the cheat codes for spotting them.',
        task: 'Name 3 intervals. Use the song clues.',
        tab: 'ear-training',
        buttonText: 'Ear Training',
        requirements: [{ event: 'ear-interval-correct', count: 3 }]
      },
      {
        id: 'interval-hunt',
        title: 'Find intervals by hand',
        idea: 'One fret is one semitone. A fifth is seven frets — intervals are distances you can see.',
        task: 'Play 2 intervals correctly.',
        tab: 'play',
        buttonText: 'Interval Hunt',
        requirements: [{ event: 'play-interval-completed', count: 2 }]
      }
    ]
  },
  {
    title: 'Chords',
    levels: [
      {
        id: 'chord-flavors',
        title: 'Taste the chord flavors',
        idea: 'A chord is notes at once. Move one and the whole mood flips.',
        task: 'Name 3 chords by their feeling.',
        tab: 'ear-training',
        buttonText: 'Ear Training',
        requirements: [{ event: 'ear-chord-correct', count: 3 }]
      },
      {
        id: 'build-chords',
        title: 'Build chords note by note',
        idea: 'Every triad is root, third, fifth. Build a couple and the formula stops being abstract.',
        task: 'Build 2 chords on your instrument.',
        tab: 'play',
        buttonText: 'Chord Builder',
        requirements: [{ event: 'play-chord-completed', count: 2 }]
      },
      {
        id: 'why-chords-work',
        title: 'See why chords sound good',
        idea: 'Consonance is physics: simple ratios make waves that line up. Beating is out-of-tune, drawn.',
        task: 'Drag the two-tone slider until you lock onto a simple ratio.',
        tab: 'physics',
        buttonText: 'Sound Physics',
        requirements: [{ event: 'physics-ratio-locked', count: 1 }]
      }
    ]
  },
  {
    title: 'Keys & the Circle',
    levels: [
      {
        id: 'meet-the-circle',
        title: 'Meet the circle of fifths',
        idea: 'A key is a home note plus its scale. On the circle, neighbours share almost every note.',
        task: 'Hear the home chord of 3 different keys.',
        tab: 'theory',
        buttonText: 'Circle of Fifths',
        requirements: [{ event: 'theory-circle-key-clicked', count: 3 }]
      },
      {
        id: 'chords-that-belong',
        title: 'Chords that belong together',
        idea: 'Each key owns seven chords. Most songs you know use only those.',
        task: 'Play 4 of them in a row. That is a progression.',
        tab: 'theory',
        buttonText: 'Theory & Scales',
        requirements: [{ event: 'theory-diatonic-played', count: 4 }]
      },
      {
        id: 'walk-the-circle',
        title: 'Walk the whole circle',
        idea: 'Stepping by fifths hits all 12 notes once, because gcd(7, 12) = 1.',
        task: 'Run the +7 walk all the way round.',
        tab: 'physics',
        buttonText: 'Sound Physics',
        requirements: [{ event: 'physics-circle-completed', count: 1 }]
      }
    ]
  },
  {
    title: 'Rhythm',
    levels: [
      {
        id: 'steady-hands',
        title: 'Lock into the beat',
        idea: 'Rhythm is the right moment, not just the right note. Timing is measured in milliseconds.',
        task: 'Land 5 perfect taps — within 45 ms of the beat.',
        tab: 'rhythm',
        buttonText: 'Rhythm Lab',
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
