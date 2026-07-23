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
