import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUITAR_STRINGS, midiToNoteName } from '../utils/musicTheory';
import { useNotePress } from '../hooks/useNotePress';

interface FretboardProps {
  activeMidis?: number[];
  highlightCorrectMidis?: number[];
  rootMidis?: number[]; // the scale/chord root — drawn in its own color
  interactive?: boolean;
  onPlayNote?: (midi: number) => void;
  showAllNoteNames?: boolean; // Highlight all notes on the neck
}

const FRETS_COUNT = 12; // 0 (open) to 12

// Real frets follow the 12th-root-of-two rule: the distance from the nut to
// fret n, as a fraction of scale length, is 1 - 2^(-n/12). That's what makes
// a fretboard taper — each fret is narrower than the last moving up the neck.
const fretPosition = (n: number): number => 1 - Math.pow(2, -n / 12);
const NECK_SPAN = fretPosition(FRETS_COUNT);

// Width of each fret cell as a % of the fretted area (excludes the nut column)
const FRET_WIDTH_PCT = Array.from({ length: FRETS_COUNT }, (_, i) => {
  const fret = i + 1;
  return ((fretPosition(fret) - fretPosition(fret - 1)) / NECK_SPAN) * 100;
});

// Center point of a fret cell as a % of the fretted area — used to place inlays
const fretCenterPct = (fret: number): number =>
  (((fretPosition(fret - 1) + fretPosition(fret)) / 2) / NECK_SPAN) * 100;

// Left edge of the vibrating length, as a % of the fretted area: fretting at
// fret n stops the string against that fret's wire, so everything to the right
// of it rings and everything to the left is dead. Fret 0 is the open string,
// stopped by the nut, which is the left edge of the area.
const fretEdgePct = (fret: number): number => (fretPosition(fret) / NECK_SPAN) * 100;

// Fret marker configuration: which frets have inlay dots
const getFretDots = (fret: number): 'single' | 'double' | null => {
  if (fret === 12) return 'double';
  if ([3, 5, 7, 9].includes(fret)) return 'single';
  return null;
};

// How long each string's ring-out is drawn for, indexed like GUITAR_STRINGS:
// high E first, down to low E. Heavier strings ring longer, which is also what
// the audio engine does — it stretches a note's decay for lower pitches. These
// have to stay in step with the --ring-dur values on .ring-1 … .ring-6, or the
// element is unmounted part-way through its own animation.
const RING_MS = [850, 950, 1050, 1200, 1350, 1500];

interface Strike {
  id: number;
  stringIdx: number;
  fret: number;
}

export const Fretboard: React.FC<FretboardProps> = ({
  activeMidis = [],
  highlightCorrectMidis = [],
  rootMidis = [],
  interactive = true,
  onPlayNote,
  showAllNoteNames = false
}) => {
  const playCell = useCallback((midi: number) => {
    if (interactive && onPlayNote) onPlayNote(midi);
  }, [interactive, onPlayNote]);

  const press = useNotePress(playCell);

  // Which note is under a point on screen. Cells carry their own MIDI number so
  // a drag can ask the document what it is over, rather than the fretboard
  // having to work it out from coordinates and fret spacing.
  const midiAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const cell = el?.closest<HTMLElement>('[data-midi]');
    if (!cell || !cell.closest('.fretboard-strings-container')) return null;
    const midi = Number(cell.dataset.midi);
    return Number.isFinite(midi) ? midi : null;
  };

  // Dragging across the strings strums them. Mouse and pen only: on a touch
  // screen the neck is wider than the display and a horizontal drag has to
  // stay available for scrolling it, which is worth more than the gesture.
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null) return;
    press.begin(midi);
    if (e.pointerType !== 'touch') {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi !== null) press.moveTo(midi);
  };

  const handlePointerUp = () => {
    dragging.current = false;
    press.end();
  };

  // A pluck is an event, not a state: the string keeps ringing on screen for
  // its own decay even after the lab has cleared the note from activeMidis
  // (a strummed chord clears after 350ms but sounds for seconds). So strikes
  // are tracked separately and expire on their own timers.
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const soundingRef = useRef<Set<number>>(new Set());
  const nextStrikeId = useRef(0);
  const timers = useRef<number[]>([]);

  const activeKey = activeMidis.join(',');
  useEffect(() => {
    const sounding = new Set(activeMidis);
    const fresh: Strike[] = [];

    GUITAR_STRINGS.forEach((str, stringIdx) => {
      // Only notes that just started count as a pluck. The lowest fret wins:
      // one finger stops the string at one place, and the lowest stopped fret
      // leaves the longest length ringing.
      for (let fret = 0; fret <= FRETS_COUNT; fret++) {
        const midi = str.midi + fret;
        if (sounding.has(midi) && !soundingRef.current.has(midi)) {
          fresh.push({ id: nextStrikeId.current++, stringIdx, fret });
          break;
        }
      }
    });

    soundingRef.current = sounding;
    if (fresh.length === 0) return;

    setStrikes(prev => [...prev, ...fresh]);
    const expiring = new Set(fresh.map(s => s.id));
    const longest = Math.max(...fresh.map(s => RING_MS[s.stringIdx]));
    const timer = window.setTimeout(() => {
      setStrikes(prev => prev.filter(s => !expiring.has(s.id)));
      timers.current = timers.current.filter(t => t !== timer);
    }, longest);
    timers.current.push(timer);
    // activeMidis is a fresh array on every render, so the joined key is what
    // actually tells us the sounding notes changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Nut (Open Strings)</span>
        <span>12th Fret (Octave)</span>
      </div>

      <div
        className="fretboard-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="fretboard-strings-container">

          {/* Inlay position markers, sitting on the wood between strings 3 & 4 */}
          <div className="inlay-layer">
            {Array.from({ length: FRETS_COUNT }, (_, i) => i + 1).map(fret => {
              const dots = getFretDots(fret);
              if (!dots) return null;
              const left = `${fretCenterPct(fret)}%`;
              return dots === 'single' ? (
                <div key={fret} className="inlay-dot" style={{ left, top: '50%' }} />
              ) : (
                <React.Fragment key={fret}>
                  <div className="inlay-dot" style={{ left, top: '32%' }} />
                  <div className="inlay-dot" style={{ left, top: '68%' }} />
                </React.Fragment>
              );
            })}
          </div>

          {/* Render Guitar Strings */}
          {GUITAR_STRINGS.map((str, strIdx) => {
            const stringNum = strIdx + 1; // 1 = high E (thinnest) ... 6 = low E (thickest)
            const ringing = strikes.filter(s => s.stringIdx === strIdx);
            return (
              <div key={strIdx} className={`guitar-string-row${ringing.length > 0 ? ' is-ringing' : ''}`}>

                {/* Visual String line running behind note markers. It fades
                    while the string rings, the way a real one loses its hard
                    edge into the blur of its own movement. */}
                <div className={`guitar-string-line string-thickness-${stringNum}`} />

                {/* Open String Note Label on Headstock */}
                <div className="fret-cell nut-cell" data-midi={str.midi}>
                  <span style={{ cursor: 'pointer', zIndex: 11, color: 'var(--primary)', fontWeight: 'bold' }}>
                    {str.note}
                    <span style={{ fontSize: '0.65rem', verticalAlign: 'sub' }}>{str.octave}</span>
                  </span>

                  {/* Highlight indicator if open string is playing / in scale */}
                  {(activeMidis.includes(str.midi) || rootMidis.includes(str.midi) || highlightCorrectMidis.includes(str.midi)) && (
                    <div
                      className={`guitar-note-marker ${
                        activeMidis.includes(str.midi) ? 'active' :
                        rootMidis.includes(str.midi) ? 'highlight-root' : 'highlight-correct'
                      }`}
                      style={{ position: 'absolute', right: '-12px', top: '8px' }}
                    >
                      {str.note}
                    </div>
                  )}
                </div>

                {/* Render Fret Cells for this String, tapered to real fret spacing */}
                <div className="fret-area">

                  {/* The ring-out. One element per pluck, spanning from the
                      fret that stops the string to the bridge off the right
                      edge, keyed so a repeated strike restarts the decay. */}
                  {ringing.map(strike => (
                    <span
                      key={strike.id}
                      className={`string-ring ring-${stringNum}`}
                      style={{ left: `${fretEdgePct(strike.fret)}%` }}
                      aria-hidden="true"
                    />
                  ))}

                  {Array.from({ length: FRETS_COUNT }).map((_, fIdx) => {
                    const fret = fIdx + 1;
                    const midiNote = str.midi + fret;
                    const noteInfo = midiToNoteName(midiNote);

                    const isActive = activeMidis.includes(midiNote);
                    const isCorrect = highlightCorrectMidis.includes(midiNote);
                    const isRoot = rootMidis.includes(midiNote);

                    const showNote = showAllNoteNames || isActive || isCorrect || isRoot;

                    return (
                      <div
                        key={fret}
                        className="fret-cell"
                        style={{ width: `${FRET_WIDTH_PCT[fIdx]}%` }}
                        data-midi={midiNote}
                      >
                        {showNote && (
                          <div className={`guitar-note-marker ${isActive ? 'active' : isRoot ? 'highlight-root' : isCorrect ? 'highlight-correct' : ''}`}>
                            {noteInfo.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Fret-number ruler, aligned to the same tapered cell widths as
              the strings above so each number sits under its real fret */}
          <div className="fret-ruler-row">
            <div className="fret-ruler-nut">0</div>
            <div className="fret-ruler-area">
              {FRET_WIDTH_PCT.map((pct, i) => (
                <div key={i} className="fret-ruler-cell" style={{ width: `${pct}%` }}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Fretboard;
