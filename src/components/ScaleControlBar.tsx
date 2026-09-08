import React from 'react';
import { Term } from './Term';
import { Segmented } from './Segmented';
import { NOTE_NAMES, CHORD_QUALITIES, SCALE_FORMULAS } from '../utils/musicTheory';
import type { ScaleFormula } from '../utils/musicTheory';
import { SCALE_FEELINGS, CHORD_FEELINGS } from '../utils/glossary';
import { prettyNote } from '../utils/chords';

interface ScaleControlBarProps {
  root: string;
  onRootChange: (root: string) => void;
  octave: number;
  onOctaveChange: (octave: number) => void;
  scale: ScaleFormula;
  onScaleChange: (scale: ScaleFormula) => void;
  chordQuality: number; // index into CHORD_QUALITIES, or -1 for scale mode
  onChordQualityChange: (index: number) => void;
  onPlay: () => void;
}

const OCTAVES = [
  { value: 2, label: 'Low' },
  { value: 3, label: 'Mid' },
  { value: 4, label: 'High' }
];

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// Everything the rest of the page reacts to, in one bar that stays pinned to
// the top of the viewport. The page below is several screens tall, so a
// control you have to scroll back to is a control you stop using.
export const ScaleControlBar: React.FC<ScaleControlBarProps> = ({
  root,
  onRootChange,
  octave,
  onOctaveChange,
  scale,
  onScaleChange,
  chordQuality,
  onChordQualityChange,
  onPlay
}) => {
  const chordMode = chordQuality !== -1;
  const selectionName = chordMode
    ? `${prettyNote(root)} ${CHORD_QUALITIES[chordQuality].name}`
    : `${prettyNote(root)} ${scale.name}`;

  return (
    <div className="lab-toolbar">
      {/* Root note + octave + play */}
      <div className="toolbar-row">
        <span className="toolbar-label">
          <Term k="rootNote">Key</Term>
        </span>
        <div className="note-strip" role="group" aria-label="Root note">
          {NOTE_NAMES.map(note => (
            <button
              key={note}
              type="button"
              onClick={() => onRootChange(note)}
              aria-pressed={root === note}
              title={`Root note ${prettyNote(note)}`}
              className={`note-key${note.includes('#') ? ' is-accidental' : ''}${root === note ? ' is-selected' : ''}`}
            >
              {prettyNote(note)}
            </button>
          ))}
        </div>

        <span className="toolbar-label" style={{ marginLeft: 'auto' }}>
          <Term k="octave">Octave</Term>
        </span>
        <Segmented value={octave} onChange={onOctaveChange} options={OCTAVES} ariaLabel="Octave" />

        <button
          type="button"
          onClick={onPlay}
          className={`btn ${chordMode ? 'btn-secondary' : 'btn-primary'}`}
          style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
        >
          <PlayIcon />
          Play <span className="hide-sm">{selectionName}</span>
        </button>
      </div>

      {/* Scale or chord — one list at a time, so the mode is never ambiguous */}
      <div className="toolbar-row">
        <Segmented
          value={chordMode}
          onChange={(wantChords) => onChordQualityChange(wantChords ? Math.max(0, chordQuality) : -1)}
          tone={chordMode ? 'secondary' : 'primary'}
          options={[
            { value: false, label: <Term k="scale">Scale</Term> },
            { value: true, label: <Term k="chordQuality">Chord</Term> }
          ]}
          ariaLabel="What to explore"
        />

        <div className="pill-row">
          {chordMode
            ? CHORD_QUALITIES.map((chord, idx) => (
                <button
                  key={chord.name}
                  type="button"
                  onClick={() => onChordQualityChange(idx)}
                  aria-pressed={chordQuality === idx}
                  title={`${chord.name} (${chord.symbols[0]})`}
                  className={`pill is-secondary${chordQuality === idx ? ' is-selected' : ''}`}
                >
                  {CHORD_FEELINGS[chord.name] ?? chord.name}
                </button>
              ))
            : SCALE_FORMULAS.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => onScaleChange(s)}
                  aria-pressed={scale.name === s.name}
                  title={s.name}
                  className={`pill${scale.name === s.name ? ' is-selected' : ''}`}
                >
                  {SCALE_FEELINGS[s.name]?.feeling ?? s.name}
                </button>
              ))}
        </div>
      </div>
    </div>
  );
};

export default ScaleControlBar;
