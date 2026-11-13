// Swing, as one number from 0 to 0.75, and where it puts the off-beat.
//
//   0      straight: two even eighths, the off-beat half way through the beat
//   0.5    shuffle: the triplet feel, long-short 2:1, off-beat at two thirds
//   0.75   heavy swing: dotted, long-short 3:1, off-beat at three quarters

export const SWING_MAX = 0.75;
export const SHUFFLE = 0.5;

/** Where in the beat (0 to 1) the off-beat eighth lands. */
export const swingOffbeat = (amount: number): number => 0.5 + Math.max(0, Math.min(SWING_MAX, amount)) / 3;

export function swingName(amount: number): string {
  if (amount <= 0) return 'Straight';
  if (amount < SHUFFLE - 0.08) return 'Light swing';
  if (amount <= SHUFFLE + 0.08) return 'Shuffle';
  return 'Heavy swing';
}
