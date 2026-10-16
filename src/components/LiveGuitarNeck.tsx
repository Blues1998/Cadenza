import React, { useMemo } from 'react';
import type { ChordVoicing } from '../utils/chords';
import type { StrumPattern } from '../utils/strum';

interface LiveGuitarNeckProps {
  voicing: ChordVoicing | null;
  chordSymbol: string | null;
  nextChordSymbol?: string | null;
  capo: number | null;
  activeSlot: number;
  pattern: StrumPattern | null;
  isPlaying: boolean;
  stroke: 'D' | 'U' | 'X' | '-' | null;
  beat: number;
  beatsPerBar: number;
}

// Low E (row 0) to High e (row 5)
const STRING_ROWS = [
  { name: 'E', voicingIndex: 5, gauge: 3.2, openMidi: 40 },
  { name: 'A', voicingIndex: 4, gauge: 2.7, openMidi: 45 },
  { name: 'D', voicingIndex: 3, gauge: 2.2, openMidi: 50 },
  { name: 'G', voicingIndex: 2, gauge: 1.7, openMidi: 55 },
  { name: 'B', voicingIndex: 1, gauge: 1.3, openMidi: 59 },
  { name: 'e', voicingIndex: 0, gauge: 0.9, openMidi: 64 }
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const getNoteName = (midi: number): string => NOTE_NAMES[midi % 12];

export const LiveGuitarNeck: React.FC<LiveGuitarNeckProps> = ({
  voicing,
  chordSymbol,
  nextChordSymbol,
  capo,
  activeSlot,
  pattern,
  isPlaying,
  stroke,
  beat,
  beatsPerBar
}) => {
  // Determine fret span to display: 5 frets starting from base fret
  const frettedVals = useMemo(() => {
    return voicing?.frets.filter((f): f is number => typeof f === 'number' && f > 0) ?? [];
  }, [voicing]);

  const minFret = frettedVals.length > 0 ? Math.min(...frettedVals) : 1;
  const maxFret = frettedVals.length > 0 ? Math.max(...frettedVals) : 1;
  const baseFret = maxFret > 4 ? minFret : 1;
  const numFrets = 5;

  const frets = useMemo(() => {
    return Array.from({ length: numFrets }, (_, i) => baseFret + i);
  }, [baseFret]);

  const activeStroke = isPlaying && stroke && stroke !== '-' ? stroke : null;
  const barNum = Math.max(1, Math.floor(beat / Math.max(1, beatsPerBar)) + 1);
  const beatNum = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar + 1;

  return (
    <div className="live-guitar-view">
      <div className="guitar-head-status">
        <div className="guitar-chord-badge">
          <span className="guitar-chord-label">Holding</span>
          <span className="guitar-chord-name readout">{chordSymbol ?? '—'}</span>
          {voicing && <span className="guitar-chord-voicing">{voicing.label}</span>}
          {capo && capo > 0 && <span className="guitar-capo-chip readout">Capo {capo}</span>}
          {nextChordSymbol && (
            <span className="guitar-next-chip readout" title="Next chord coming up">
              Next: <strong>{nextChordSymbol}</strong>
            </span>
          )}
          {isPlaying && (
            <span className="guitar-capo-chip readout" style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)' }}>
              Bar {barNum} · Beat {beatNum}
            </span>
          )}
        </div>

        {/* Live Strum Action Banner */}
        <div className="guitar-action-badge">
          <div className={`strum-stroke-indicator${activeStroke ? ` is-${activeStroke.toLowerCase()}` : ''}`}>
            {activeStroke === 'D' && (
              <>
                <span className="stroke-arrow">↓</span>
                <span className="stroke-text">DOWNSTROKE</span>
              </>
            )}
            {activeStroke === 'U' && (
              <>
                <span className="stroke-arrow">↑</span>
                <span className="stroke-text">UPSTROKE</span>
              </>
            )}
            {activeStroke === 'X' && (
              <>
                <span className="stroke-arrow">✕</span>
                <span className="stroke-text">CHUCK / MUTE</span>
              </>
            )}
            {!activeStroke && isPlaying && (
              <>
                <span className="stroke-arrow">~</span>
                <span className="stroke-text">RINGING</span>
              </>
            )}
            {!isPlaying && (
              <>
                <span className="stroke-arrow">▶</span>
                <span className="stroke-text">READY</span>
              </>
            )}
          </div>

          {/* Strum Rhythm Tape */}
          {pattern && (
            <div className="live-strum-tape" aria-hidden="true">
              {pattern.steps.map((s, idx) => {
                const isCurrent = isPlaying && activeSlot >= 0 && activeSlot % pattern.steps.length === idx;
                return (
                  <div
                    key={idx}
                    className={`tape-cell${isCurrent ? ' is-active' : ''}${s === '-' ? ' is-rest' : ''}`}
                  >
                    <span className="tape-step">{s === '-' ? '·' : s}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Visual Guitar Neck & Fretboard */}
      <div className="guitar-neck-box">
        <div className="guitar-neck">
          {/* Nut or Base Fret Marker */}
          <div className={`neck-nut${baseFret > 1 ? ' is-fret' : ''}`}>
            {baseFret > 1 ? (
              <span className="base-fret-number readout">{baseFret}fr</span>
            ) : (
              <span className="nut-cap">NUT</span>
            )}
          </div>

          {/* Capo bar overlay if within visible range */}
          {capo && capo >= baseFret && capo < baseFret + numFrets && (
            <div
              className="neck-capo-bar"
              style={{
                left: `${((capo - baseFret + 0.5) / numFrets) * 100}%`
              }}
              title={`Capo on fret ${capo}`}
            >
              <span className="capo-bar-label">CAPO {capo}</span>
            </div>
          )}

          {/* Fret wire columns */}
          <div className="neck-frets">
            {frets.map(f => (
              <div key={f} className="neck-fret-col">
                <span className="fret-num-sub readout">{f}</span>
                {/* Standard fret inlay dot */}
                {[3, 5, 7, 9].includes(f) && <span className="neck-inlay-dot" />}
                {f === 12 && (
                  <span className="neck-inlay-double">
                    <span className="neck-inlay-dot" />
                    <span className="neck-inlay-dot" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* The 6 Guitar Strings (Low E to High e) */}
          <div className="neck-strings">
            {STRING_ROWS.map((row, rowIdx) => {
              const fretVal = voicing ? voicing.frets[row.voicingIndex] : null;
              const fingerVal = voicing ? voicing.fingers[row.voicingIndex] : null;
              const isOpen = fretVal === 0;
              const isMuted = fretVal === null || fretVal === undefined;
              const isFretted = typeof fretVal === 'number' && fretVal > 0;

              // Audio vibration effect when strumming
              const isStringActive = isPlaying && activeStroke !== null && (
                activeStroke === 'D' ||
                (activeStroke === 'U' && rowIdx >= 2) ||
                activeStroke === 'X'
              );

              // Calculate note name
              const noteMidi = typeof fretVal === 'number' ? row.openMidi + fretVal : null;
              const noteName = noteMidi !== null ? getNoteName(noteMidi) : '';

              return (
                <div key={row.name} className="neck-string-row">
                  {/* String tuning label & Nut status (○ / ✕) */}
                  <div className="string-nut-indicator">
                    <span className="string-name readout">{row.name}</span>
                    {isMuted && <span className="nut-marker is-muted" title="Muted">✕</span>}
                    {isOpen && (
                      <span
                        className={`nut-marker is-open${isStringActive ? ' is-pulsing' : ''}`}
                        title={`Open ${row.name} string`}
                      >
                        ○
                      </span>
                    )}
                  </div>

                  {/* The string wire line */}
                  <div
                    className={`string-wire${isStringActive ? ' is-vibrating' : ''}`}
                    style={{ height: `${row.gauge}px` }}
                  />

                  {/* Fretted Dot */}
                  {isFretted && fretVal >= baseFret && fretVal < baseFret + numFrets && (
                    <div
                      className={`fret-finger-dot${isStringActive ? ' is-struck' : ''}`}
                      style={{
                        left: `${((fretVal - baseFret + 0.5) / numFrets) * 100}%`
                      }}
                      title={`Fret ${fretVal} (${noteName}) - Finger ${fingerVal ?? ''}`}
                    >
                      <span className="finger-num">{fingerVal ?? ''}</span>
                      <span className="finger-note">{noteName}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
