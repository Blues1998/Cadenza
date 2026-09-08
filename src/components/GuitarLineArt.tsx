import React from 'react';

// A single-stroke acoustic guitar, drawn rather than photographed, sitting
// behind the dashboard hero. The brief for this design is that the musical
// content supplies the visual richness — this is the chrome's one indulgence,
// and it is a line drawing at low contrast so it reads as watermark rather
// than as decoration competing with the text.
export const GuitarLineArt: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 200 460"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    >
      {/* Headstock */}
      <path d="M86 14 h28 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-28 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6 z" />
      {[24, 34, 44].map(y => (
        <React.Fragment key={y}>
          <line x1="74" y1={y} x2="80" y2={y} />
          <line x1="120" y1={y} x2="126" y2={y} />
        </React.Fragment>
      ))}

      {/* Neck, with the frets a player actually counts by */}
      <line x1="88" y1="60" x2="88" y2="196" />
      <line x1="112" y1="60" x2="112" y2="196" />
      {[78, 96, 114, 132, 150, 168, 186].map(y => (
        <line key={y} x1="88" y1={y} x2="112" y2={y} />
      ))}
      {/* Position inlays at the 3rd, 5th and 7th */}
      {[105, 141, 177].map(y => (
        <circle key={y} cx="100" cy={y} r="1.6" fill="currentColor" stroke="none" />
      ))}

      {/* Body: upper bout, waist, lower bout */}
      <path d="M100 194
               C133 194 152 214 152 244
               C152 262 141 273 141 288
               C141 307 159 319 159 349
               C159 394 132 424 100 424
               C68 424 41 394 41 349
               C41 319 59 307 59 288
               C59 273 48 262 48 244
               C48 214 67 194 100 194 Z" />

      {/* Soundhole and rosette */}
      <circle cx="100" cy="266" r="23" />
      <circle cx="100" cy="266" r="28" strokeOpacity="0.5" />

      {/* Bridge and saddle */}
      <path d="M78 344 h44 a4 4 0 0 1 4 4 v10 a4 4 0 0 1 -4 4 h-44 a4 4 0 0 1 -4 -4 v-10 a4 4 0 0 1 4 -4 z" />

      {/* Six strings running the length of the instrument */}
      {[90.5, 94, 97.5, 102.5, 106, 109.5].map(x => (
        <line key={x} x1={x} y1="60" x2={x} y2="344" strokeOpacity="0.55" />
      ))}
    </g>
  </svg>
);

export default GuitarLineArt;
