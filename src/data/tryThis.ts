import type { ActiveTab } from '../components/navGroups';

export interface Prompt {
  text: string;
  tab: ActiveTab;
}

// One small thing to go and do. Each one is a minute or two at the instrument
// and lands somewhere in the app that can actually help you do it — a prompt
// with nowhere to go is a slogan.
//
// Chosen by the date rather than at random, so it is the same all day: a
// suggestion that changes every time the page repaints is noise, and you can
// never come back to the one you meant to try.
export const PROMPTS: Prompt[] = [
  { text: 'Play the A minor pentatonic without looking at your hand.', tab: 'theory' },
  { text: 'Name every interval you hear for two minutes straight.', tab: 'ear-training' },
  { text: 'Set 60 BPM and play one clean downstroke per beat.', tab: 'rhythm' },
  { text: 'Tune by ear first. Then check how close you got.', tab: 'tuner' },
  { text: 'Change Am → F ten times without stopping.', tab: 'play' },
  { text: 'Find every C on the fretboard in under a minute.', tab: 'theory' },
  { text: 'Hum the root while you strum the chord.', tab: 'ear-training' },
  { text: "Play today's progression at half speed, perfectly.", tab: 'rhythm' },
  { text: 'Read one bar of tab, look away, play it back.', tab: 'tabs' },
  { text: 'Sing the melody while you strum. Badly is fine.', tab: 'songs' }
];

export function promptForDate(date = new Date()): Prompt {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return PROMPTS[dayOfYear % PROMPTS.length];
}
