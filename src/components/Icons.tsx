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
