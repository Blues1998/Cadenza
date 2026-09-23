import React from 'react';

// Shared line-icon set, matching the stroke-based style already used in
// Sidebar.tsx and elsewhere (24x24 viewBox, round caps/joins, currentColor).
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
});

export const IconCheck: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} {...props}><polyline points="20 6 9 17 4 12" /></svg>
);

export const IconCheckCircle: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12.5 11 15.5 16 9" />
  </svg>
);

export const IconCircle: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9" /></svg>
);

export const IconX: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({ size = 12, ...props }) => (
  <svg {...base(size)} {...props} strokeWidth={2.5}><polygon points="5 3 19 12 5 21 5 3" /></svg>
);

export const IconStop: React.FC<IconProps> = ({ size = 12, ...props }) => (
  <svg {...base(size)} {...props} strokeWidth={2.5}><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg>
);

export const IconSpeaker: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
    <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
    <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
    <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M21 12.6A9 9 0 1 1 11.4 3a7 7 0 0 0 9.6 9.6Z" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({ size = 12, ...props }) => (
  <svg {...base(size)} {...props} strokeWidth={2.5}>
    <rect x="6" y="4.5" width="4" height="15" rx="1.4" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.4" />
  </svg>
);

/**
 * How a chord sits in your hands, as one mark.
 *
 * Three states of the same ring — empty, half, full — rather than three
 * different pictures. The shape carries the answer on its own, which is what
 * lets the word beside it go away; and because it is one object being filled
 * rather than three lamps, the control reads as a dial you turn.
 */
export const IconComfort: React.FC<IconProps & { state: 'solid' | 'shaky' | 'none' }> = ({ size = 13, state, ...props }) => (
  <svg {...base(size)} strokeWidth={2.4} {...props}>
    <circle cx="12" cy="12" r="7.8" />
    {state === 'shaky' && <path d="M12 4.2a7.8 7.8 0 0 1 0 15.6z" fill="currentColor" stroke="none" />}
    {state === 'solid' && <circle cx="12" cy="12" r="7.8" fill="currentColor" stroke="none" />}
  </svg>
);

/**
 * A record, and only a record.
 *
 * Kept for the one number in the app that goes up, so that a personal best
 * always looks like a personal best wherever it turns up — on the card that
 * sets it, and on the shelf beside the loop that holds it.
 */
export const IconBest: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} {...props}>
    <polyline points="3 17.5 8.5 11.5 13 15 21 6.5" />
    <polyline points="16 6.5 21 6.5 21 11.5" />
  </svg>
);

/**
 * The click, as the thing that makes it.
 *
 * `lean` is which side the arm is on — the caller hands it the beat, and the
 * arm alternates, so the mark on the control keeps the time the control is
 * setting. Nought is upright, which is where a metronome sits when it is off.
 * `swingMs` is one beat, so the travel takes exactly as long as a beat does
 * and the swing reads as tempo rather than as decoration.
 */
export const IconMetronome: React.FC<IconProps & { lean?: -1 | 0 | 1; swingMs?: number }> = ({
  size = 15,
  lean = 0,
  swingMs = 400,
  ...props
}) => (
  <svg {...base(size)} strokeWidth={1.9} {...props}>
    <path d="M9.2 3.5h5.6l4.2 17H5z" />
    <line x1="5.8" y1="15.5" x2="18.2" y2="15.5" />
    <line
      className="metro-arm"
      x1="12"
      y1="19"
      x2="12"
      y2="6"
      style={{
        transform: `rotate(${lean * 19}deg)`,
        transformOrigin: '12px 19px',
        transition: `transform ${swingMs}ms cubic-bezier(0.37, 0, 0.63, 1)`
      }}
    />
  </svg>
);

/**
 * Where to press to set a tempo by hand.
 *
 * Rings rather than a hand or a drum: what the control does is take the
 * moment of a press, and a target is the only mark that means "the instant
 * you touch here" without borrowing an idea from somewhere else.
 */
export const IconTap: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} strokeWidth={1.9} {...props}>
    <circle cx="12" cy="12" r="9.2" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * One mark for every "you are about to hear something" in the app.
 *
 * It had four words — Hear it, Sound on, Listen, and a bare play triangle that
 * also meant "start the exercise" two buttons along. A cone with waves means
 * one thing, and `live` is whether the waves are moving, so the mark reports
 * the state instead of the label having to change.
 */
export const IconSounding: React.FC<IconProps & { live?: boolean }> = ({ size = 15, live = false, ...props }) => (
  <svg {...base(size)} strokeWidth={1.9} className={`sounding${live ? ' is-live' : ''}`} {...props}>
    <path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z" />
    <path className="sounding-wave is-near" d="M15.4 9.6a4 4 0 0 1 0 4.8" />
    <path className="sounding-wave is-far" d="M18.1 7.2a7.8 7.8 0 0 1 0 9.6" />
  </svg>
);

/**
 * How many beats there are in a bar.
 *
 * Deliberately still. This row already has a swinging arm and a rippling
 * target on it, and a third moving thing would make the one control you read
 * mid-bar the hardest to read.
 */
export const IconBeats: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} strokeWidth={1.9} {...props}>
    <line x1="4" y1="5.5" x2="20" y2="5.5" />
    <line x1="4" y1="5.5" x2="4" y2="18.5" />
    <line x1="9.3" y1="5.5" x2="9.3" y2="18.5" />
    <line x1="14.7" y1="5.5" x2="14.7" y2="18.5" />
    <line x1="20" y1="5.5" x2="20" y2="18.5" />
  </svg>
);

/**
 * The one door to everywhere.
 *
 * Twelve destinations, nine template levels and every song need a way in that
 * is not a list, and ⌘K is only a door if you own a keyboard — on a phone the
 * panel had no handle at all.
 */
export const IconJump: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg {...base(size)} strokeWidth={2.1} {...props}>
    <circle className="jumpmark-ring" cx="10.5" cy="10.5" r="6.5" />
    <line x1="15.4" y1="15.4" x2="20.5" y2="20.5" />
  </svg>
);

/**
 * Your library, leaving or arriving.
 *
 * One drawing for the pair, because they are one idea in two directions:
 * the arrow drops out of the tray to write a file and rises into it to read
 * one. Two unrelated glyphs beside each other would make them look like two
 * unrelated jobs.
 */
export const IconTray: React.FC<IconProps & { dir: 'out' | 'in' }> = ({ size = 15, dir, ...props }) => (
  <svg {...base(size)} strokeWidth={2} className={`tray is-${dir}`} {...props}>
    <path d="M4 15.5v2.8a1.7 1.7 0 0 0 1.7 1.7h12.6a1.7 1.7 0 0 0 1.7-1.7v-2.8" />
    <g className="tray-arrow">
      {dir === 'out'
        ? <><line x1="12" y1="3.6" x2="12" y2="14.4" /><polyline points="7.6 10 12 14.4 16.4 10" /></>
        : <><line x1="12" y1="14.4" x2="12" y2="3.6" /><polyline points="7.6 8 12 3.6 16.4 8" /></>}
    </g>
  </svg>
);

/**
 * The only thing in this app that takes something away for good.
 *
 * It was the plainest element on the song page — a bare text link under the
 * notes. A destructive action should not be the quietest mark on a screen,
 * and it should not be the loudest either: muted until you reach for it, and
 * then unmistakable.
 */
export const IconTrash: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg {...base(size)} strokeWidth={2} className="trash" {...props}>
    <g className="trash-lid">
      <line x1="3.8" y1="6.2" x2="20.2" y2="6.2" />
      <path d="M9.4 6.2V4.6a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6" />
    </g>
    <path d="M6.2 6.2h11.6l-.9 13a1.6 1.6 0 0 1-1.6 1.5H8.7a1.6 1.6 0 0 1-1.6-1.5z" />
  </svg>
);

/**
 * The marks on a song page's section headings.
 *
 * A song page is a tall stack of identical uppercase labels, so finding
 * "Chart" meant reading rather than glancing. One 14px glyph per heading makes
 * the page scannable by shape.
 *
 * Deliberately still — eight animated marks on one page is a fairground, and
 * these are wayfinding rather than events. One component rather than nine
 * exports because they are one idea: the shapes a song is made of.
 */
export type SectionKind =
  | 'next' | 'chords' | 'fit' | 'strumming' | 'confidence'
  | 'practice' | 'chart' | 'session' | 'notes';

const SECTION: Record<SectionKind, React.ReactNode> = {
  // The carry from last time: something pointing forward.
  next: <><line x1="4" y1="12" x2="18" y2="12" /><polyline points="12.5 6.5 19 12 12.5 17.5" /></>,
  // A chord box: strings, frets and a finger on one of them.
  chords: <><line x1="6" y1="4" x2="6" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="18" y1="4" x2="18" y2="20" /><line x1="4" y1="8" x2="20" y2="8" /><circle cx="12" cy="13.5" r="2" fill="currentColor" stroke="none" /></>,
  // A capo clamped across the strings. Drawn the other way up from the chord
  // box above it on purpose: at 14px two marks made of the same lines in the
  // same orientation are one mark, and the whole point is scanning by shape.
  fit: <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /><rect x="7" y="3.2" width="4.6" height="17.6" rx="2.3" fill="currentColor" stroke="none" /></>,
  // The arm, down and up.
  strumming: <><line x1="8.5" y1="4" x2="8.5" y2="19" /><polyline points="4.5 14.5 8.5 19 12.5 14.5" /><line x1="15.5" y1="20" x2="15.5" y2="5" /><polyline points="11.5 9.5 15.5 5 19.5 9.5" /></>,
  // A dial, because that is what a nought-to-ten is.
  confidence: <><path d="M4 17a8 8 0 1 1 16 0" /><line x1="12" y1="17" x2="16.5" y2="10.5" /></>,
  // Minutes.
  practice: <><circle cx="12" cy="12" r="8.5" /><polyline points="12 6.8 12 12 15.8 14" /></>,
  // The words, with the changes landing over them.
  chart: <><line x1="4" y1="6" x2="11" y2="6" /><line x1="15" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /></>,
  // A stopwatch: the thing the timer on this page is.
  session: <><circle cx="12" cy="13.5" r="7.5" /><line x1="9.5" y1="2.8" x2="14.5" y2="2.8" /><line x1="12" y1="2.8" x2="12" y2="6" /><polyline points="12 9.5 12 13.5 15 15.5" /></>,
  // What you wrote down.
  notes: <><path d="M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8L9.2 20z" /><line x1="14.2" y1="6.6" x2="18.4" y2="10.8" /></>
};

export const IconSection: React.FC<IconProps & { kind: SectionKind }> = ({ size = 14, kind, ...props }) => (
  <svg {...base(size)} strokeWidth={1.9} className="section-mark" aria-hidden="true" {...props}>
    {SECTION[kind]}
  </svg>
);
