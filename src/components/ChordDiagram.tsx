import React from 'react';
import { voicingBaseFret } from '../utils/chords';

interface ChordDiagramProps {
  // GUITAR_STRINGS order (index 0 = high e … 5 = low E), null = muted string
  frets: (number | null)[];
  fingers: (number | null)[]; // 0 = open, 1 = index … 4 = pinky
  onClick?: () => void;
  scale?: number; // 1 = default size
  /**
   * Keep the fret-number column even when this shape does not need one.
   *
   * For somewhere that shows one diagram after another in the same place: the
   * column is 38px wide at stage size, so a loop that alternates an open shape
   * with a barred one would otherwise shunt everything beside it sideways on
   * every change.
   */
  reserveFret?: boolean;
}

const FRET_ROWS = 5;

// Chord boxes are read with the low E on the left, so the drawing order is the
// reverse of GUITAR_STRINGS.
const GAP = 20;
const X0 = 26;
const Y0 = 30;
const ROW = 22;
const stringX = (appIdx: number) => X0 + (5 - appIdx) * GAP;
const BOX_RIGHT = X0 + 5 * GAP;
const BOX_BOTTOM = Y0 + FRET_ROWS * ROW;

export const ChordDiagram: React.FC<ChordDiagramProps> = ({ frets, fingers, onClick, scale = 1, reserveFret = false }) => {
  const baseFret = voicingBaseFret(frets);
  const showNut = baseFret === 1;

  // Room to the left for the position marker, and only when there is one. It
  // has to be legible from where a guitar is actually played, which is a metre
  // further away than a screen is designed for, and "which fret" is the one
  // thing about a barre shape you cannot work out from the picture.
  const gutter = showNut && !reserveFret ? 0 : 30;
  const width = BOX_RIGHT + 14 + gutter;

  // Same finger on several strings at the same fret = a barre, drawn as a bar.
  const barres: { finger: number; fret: number; from: number; to: number }[] = [];
  for (let finger = 1; finger <= 4; finger++) {
    const held = frets
      .map((f, i) => ({ f, i }))
      .filter(({ f, i }) => fingers[i] === finger && f !== null && f > 0);
    if (held.length < 2) continue;
    const fret = held[0].f as number;
    if (!held.every(h => h.f === fret)) continue;
    const idxs = held.map(h => h.i);
    barres.push({ finger, fret, from: Math.min(...idxs), to: Math.max(...idxs) });
  }
  // Strings the bar itself already covers. Membership is by finger and fret,
  // not by lying between the bar's ends — the other fingers of a barre chord
  // sit on strings inside that span and still need their own dots.
  const barred = new Set(
    barres.flatMap(b => frets.map((_, i) => i).filter(i => fingers[i] === b.finger && frets[i] === b.fret))
  );

  const rowY = (fret: number) => Y0 + (fret - baseFret + 0.5) * ROW;

  const line = 'rgba(var(--surface-tint-rgb), 0.3)';
  const dot = 'var(--primary)';
  const dotText = 'var(--text-on-primary)';

  return (
    <svg
      viewBox={`${-gutter} 0 ${width} ${BOX_BOTTOM + 8}`}
      width={width * 0.78 * scale}
      height={(BOX_BOTTOM + 8) * 0.78 * scale}
      role="img"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'block', overflow: 'visible' }}
    >
      {/* Frets */}
      {Array.from({ length: FRET_ROWS + 1 }, (_, r) => (
        <line
          key={`f${r}`}
          x1={X0}
          x2={BOX_RIGHT}
          y1={Y0 + r * ROW}
          y2={Y0 + r * ROW}
          stroke={line}
          strokeWidth={r === 0 && showNut ? 5 : 1.4}
          strokeLinecap="round"
        />
      ))}

      {/* Strings, thicker toward the low E as on the real instrument */}
      {frets.map((_, i) => (
        <line
          key={`s${i}`}
          x1={stringX(i)}
          x2={stringX(i)}
          y1={Y0}
          y2={BOX_BOTTOM}
          stroke={line}
          strokeWidth={0.9 + i * 0.22}
        />
      ))}

      {/* Position marker when the shape sits up the neck */}
      {!showNut && (
        <text x={X0 - 10} y={Y0 + ROW * 0.85} textAnchor="end" fill="var(--text-primary)">
          <tspan fontSize="23" fontWeight="700">{baseFret}</tspan>
          <tspan fontSize="12" fontWeight="600" fill="var(--text-muted)" dx="1.5">fr</tspan>
        </text>
      )}

      {/* Open (o) and muted (x) markers above the nut */}
      {frets.map((f, i) =>
        f === null ? (
          <g key={`m${i}`} stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
            <line x1={stringX(i) - 4.5} y1={Y0 - 18} x2={stringX(i) + 4.5} y2={Y0 - 9} />
            <line x1={stringX(i) + 4.5} y1={Y0 - 18} x2={stringX(i) - 4.5} y2={Y0 - 9} />
          </g>
        ) : f === 0 ? (
          <circle key={`m${i}`} cx={stringX(i)} cy={Y0 - 13.5} r="4.6" fill="none" stroke="var(--text-secondary)" strokeWidth="1.6" />
        ) : null
      )}

      {/* Barres */}
      {barres.map((b, i) => (
        <rect
          key={`b${i}`}
          x={Math.min(stringX(b.from), stringX(b.to)) - 8}
          y={rowY(b.fret) - 8}
          width={Math.abs(stringX(b.to) - stringX(b.from)) + 16}
          height={16}
          rx={8}
          fill={dot}
        />
      ))}

      {/* Finger dots — the ones under a barre are already covered by the bar */}
      {frets.map((f, i) =>
        f !== null && f > 0 && !barred.has(i) ? (
          <circle key={`d${i}`} cx={stringX(i)} cy={rowY(f)} r="8" fill={dot} />
        ) : null
      )}

      {/* Finger numbers — once per barre, once per free finger */}
      {barres.map((b, i) => (
        <text
          key={`bn${i}`}
          x={(stringX(b.from) + stringX(b.to)) / 2}
          y={rowY(b.fret) + 4}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={dotText}
        >
          {b.finger}
        </text>
      ))}
      {frets.map((f, i) =>
        f !== null && f > 0 && fingers[i] && !barred.has(i) ? (
          <text
            key={`n${i}`}
            x={stringX(i)}
            y={rowY(f) + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={dotText}
          >
            {fingers[i]}
          </text>
        ) : null
      )}
    </svg>
  );
};

export default ChordDiagram;
