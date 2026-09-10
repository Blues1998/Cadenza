// A strumming pattern, and what a hand can actually do with it.
//
// Patterns are written the way they are taught — "D D U U D U" — which is a
// shorthand, not a grid. It names the strokes that land, and leaves out the
// ones the hand makes on the way back. Read literally it says six strums in a
// row; read the way it is meant it says the classic eight-slot pattern with
// two of the slots passed over.
//
// The rule here is the one the hand obeys and nothing else: the strumming arm
// never stops moving in eighths, so a down-stroke can only land on a beat and
// an up-stroke can only land between two. Each written stroke therefore takes
// the next slot going its way, and everything skipped is a pass with no
// contact.
//
// That single rule reads every pattern on the app's own reference sheet
// correctly, including the two that mean the same thing:
//
//   D D D D          →  D - D - D - D -     four quarter-note downs
//   D D U U D U      →  D - D U - U D U     the one everybody learns
//   D - D U - U D U  →  D - D U - U D U     the same, written out
//
// It also refuses to lie: "D D" at eighth spacing is not playable, so a
// pattern written that way comes back longer than a bar rather than pretending
// the arm can be in two places. The grid it resolves to is put on screen for
// exactly this reason — the reading is never a secret, and any cell can be
// changed by hand.

/** Down, up, a muted chuck, or a pass with no contact. */
export type Stroke = 'D' | 'U' | 'X' | '-';

/** What clicking a cell steps through. */
export const STROKE_CYCLE: Stroke[] = ['D', 'U', 'X', '-'];

export interface StrumPattern {
  /** One stroke per subdivision, in time order. Always a whole number of bars. */
  steps: Stroke[];
  /** Subdivisions in one beat — 2 is eighths, 4 is sixteenths. */
  perBeat: number;
  /** How many bars the pattern runs before it comes round again. */
  bars: number;
}

/** The pattern a loop gets when nobody has said otherwise. */
export const DEFAULT_PATTERN = 'D D U U D U';

/** A down on every beat: what "strum once a beat" always meant. */
export const PLAIN_PATTERN = 'D D D D';

const STROKE_OF: Record<string, Stroke> = {
  d: 'D', '\u2193': 'D',    // D, or the arrow lesson sheets draw instead
  u: 'U', '\u2191': 'U',
  x: 'X', m: 'X',          // muted, chucked, slapped — one sound
  '-': '-', '.': '-', '_': '-'
};

/**
 * The strokes somebody wrote, in order.
 *
 * Everything that is not a stroke is a separator: spaces, bars, and the
 * counting people write above a pattern ("1 & 2 &") all fall out, so a pattern
 * copied off a lesson sheet with its counting attached still reads.
 */
const tokenize = (text: string): Stroke[] => {
  const out: Stroke[] = [];
  for (const ch of text.toLowerCase()) {
    const stroke = STROKE_OF[ch];
    if (stroke) out.push(stroke);
  }
  return out;
};

/**
 * Where a stroke can land: downs on beats, ups between them.
 *
 * A chuck goes wherever it is next — it is played both ways round — and so
 * does a written rest, which is a pass the writer wanted counted.
 */
const wants = (stroke: Stroke): 'down' | 'up' | 'either' =>
  stroke === 'D' ? 'down' : stroke === 'U' ? 'up' : 'either';

/**
 * A written pattern, placed on the grid a hand would play it on.
 *
 * Returns null for anything with no strokes in it at all, which is how an
 * empty field stays empty rather than becoming a bar of silence.
 */
export function parseStrum(text: string, beatsPerBar = 4): StrumPattern | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  // Sixteenths only when eighths plainly cannot hold what was written. Most
  // patterns are eighths, and reading an eighth pattern as sixteenths would
  // halve its tempo without saying so.
  const perBeat = tokens.length > beatsPerBar * 2 ? 4 : 2;
  const placed: Stroke[] = [];
  let slot = 0;

  for (const token of tokens) {
    const want = wants(token);
    // The arm moves at whatever the grid is: it is down on every other slot,
    // up on the ones between. Sixteenth strumming is the same motion twice as
    // fast, not eighth motion with extra cells.
    if (want !== 'either' && (want === 'down') !== (slot % 2 === 0)) slot += 1;
    while (placed.length < slot) placed.push('-');
    placed.push(token);
    slot = placed.length;
  }

  // Out to the end of the bar it finishes in: a pattern is a length of time,
  // and the rest of that time is part of it.
  const perBar = beatsPerBar * perBeat;
  const bars = Math.max(1, Math.ceil(placed.length / perBar));
  while (placed.length < bars * perBar) placed.push('-');

  return { steps: placed, perBeat, bars };
}

/** The grid, written back out — what the pattern actually resolved to. */
export const formatStrum = (pattern: StrumPattern): string => pattern.steps.join(' ');

/** How many strokes actually land. A pattern of nothing but passes is silence. */
export const strokeCount = (pattern: StrumPattern): number =>
  pattern.steps.filter(s => s !== '-').length;

/** Subdivisions in one bar of this pattern. */
export const perBar = (pattern: StrumPattern): number => pattern.steps.length / pattern.bars;

/**
 * How this slot is counted out loud: "1", "&", "2"…
 *
 * The count is the part people already know, so writing it above the grid
 * means the pattern can be read without the grid having to be explained.
 */
export function countLabel(pattern: StrumPattern, index: number): string {
  const within = index % perBar(pattern);
  const beat = Math.floor(within / pattern.perBeat) + 1;
  const place = within % pattern.perBeat;
  if (place === 0) return String(beat);
  if (pattern.perBeat === 2) return '&';
  return ['', 'e', '&', 'a'][place] ?? '';
}

/** Beats between one subdivision and the next. */
export const slotBeats = (pattern: StrumPattern): number => 1 / pattern.perBeat;

/** Which slot is sounding at this beat, counting on past the end for ever. */
export const slotAtBeat = (pattern: StrumPattern, beat: number): number =>
  Math.floor(beat * pattern.perBeat + 1e-6);

/**
 * Whether a slot falls on a beat rather than between two.
 *
 * Only used for drawing: the beats are the cells that get a heavier edge, so
 * a pattern can be read against the count without the count being written.
 */
export const onBeat = (pattern: StrumPattern, index: number): boolean =>
  index % pattern.perBeat === 0;

/** A pattern with one cell changed, written back as text. */
export function withStroke(pattern: StrumPattern, index: number, stroke: Stroke): string {
  const steps = [...pattern.steps];
  steps[index] = stroke;
  return steps.join(' ');
}
