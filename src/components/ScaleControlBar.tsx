import React from 'react';
import { NOTE_NAMES, SCALE_FORMULAS } from '../utils/musicTheory';
import type { ScaleFormula } from '../utils/musicTheory';
import { SCALE_FEELINGS, shortScaleName } from '../utils/glossary';
import { prettyNote } from '../utils/chords';

export type TheoryTab = 'scale' | 'chords' | 'keys';

const TABS: { id: TheoryTab; label: string }[] = [
  { id: 'scale', label: 'Scale' },
  { id: 'chords', label: 'Chords' },
  { id: 'keys', label: 'Keys' }
];

interface ScaleControlBarProps {
  root: string;
  onRootChange: (root: string) => void;
  scale: ScaleFormula;
  onScaleChange: (scale: ScaleFormula) => void;
  onPlay: () => void;
  tab: TheoryTab;
  onTab: (tab: TheoryTab) => void;
}

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// Three choices drive the whole page: the key, its mood, and Play. They stay
// pinned with the tabs, so every tab answers to the same key.
export const ScaleControlBar: React.FC<ScaleControlBarProps> = ({
  root,
  onRootChange,
  scale,
  onScaleChange,
  onPlay,
  tab,
  onTab
}) => {
  const feeling = SCALE_FEELINGS[scale.name]?.feeling ?? scale.name;

  return (
    <div className="theory-keybar">
      <div className="note-strip" role="group" aria-label="Key">
        {NOTE_NAMES.map(note => (
          <button
            key={note}
            type="button"
            onClick={() => onRootChange(note)}
            aria-pressed={root === note}
            className={`note-key${note.includes('#') ? ' is-accidental' : ''}${root === note ? ' is-selected' : ''}`}
          >
            {prettyNote(note)}
          </button>
        ))}
      </div>

      <div className="theory-keybar-row">
        {/* A real select, so a phone shows its own picker. */}
        <label className="theory-mood">
          <span className="theory-mood-text">
            {feeling} <small>{shortScaleName(scale.name)}</small>
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <select
            value={scale.name}
            aria-label="Mood"
            onChange={e => {
              const next = SCALE_FORMULAS.find(s => s.name === e.target.value);
              if (next) onScaleChange(next);
            }}
          >
            {SCALE_FORMULAS.map(s => (
              <option key={s.name} value={s.name}>
                {SCALE_FEELINGS[s.name]?.feeling ?? s.name} · {shortScaleName(s.name)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onPlay} className="btn btn-primary theory-play" aria-label={`Play ${prettyNote(root)} ${shortScaleName(scale.name)}`}>
          <PlayIcon />
          Play
        </button>
      </div>

      <div className="theory-tabs" role="tablist" aria-label="Theory">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`theory-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`theory-panel-${t.id}`}
            className={`theory-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScaleControlBar;
