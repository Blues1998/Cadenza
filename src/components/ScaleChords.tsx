import React, { useEffect, useMemo, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { Term } from './Term';
import { SCALE_FORMULAS, NOTE_NAMES, CHORD_QUALITIES, noteNameToMidi } from '../utils/musicTheory';
import type { ScaleFormula } from '../utils/musicTheory';
import { CHORD_FEELINGS, shortScaleName } from '../utils/glossary';
import { CHORD_TYPES, getScaleChords, getVoicings, prettyNote } from '../utils/chords';
import type { ChordVoicing, DifficultyTier, ScaleChord } from '../utils/chords';
import { Segmented } from './Segmented';

interface ScaleChordsProps {
  rootName: string;          // a NOTE_NAMES entry, from the key bar
  scale: ScaleFormula;
  /** A chord of the key was played: counts toward the Journey. */
  onStrum: (midis: number[]) => void;
  /** Anything else this tab sounds. */
  onSound: (midis: number[]) => void;
}

const TIER_LABEL: Record<DifficultyTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Tricky' };

const PlayIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20" /></svg>
);

const qualityWord = (chord: ScaleChord): string => CHORD_TYPES[chord.type.id].name;

/**
 * The chords of the key on the bar, as chips. One is open at a time: its
 * easiest shape, its notes, and every other way to play it a tap away.
 * Under them, the two things that only make sense next to a key's chords:
 * how the fifth chord pulls home, and any other chord type built on the key.
 */
export const ScaleChords: React.FC<ScaleChordsProps> = ({ rootName, scale, onStrum, onSound }) => {
  const [sevenths, setSevenths] = useState(false);
  const [open, setOpen] = useState(0);
  const [allShapes, setAllShapes] = useState(false);
  const [quality, setQuality] = useState(4); // Major 7th, the first one past the triads

  const rootPc = Math.max(0, NOTE_NAMES.indexOf(rootName));
  const { chords, scaleNotes, borrowedFrom } = useMemo(
    () => getScaleChords(rootPc, scale, sevenths, SCALE_FORMULAS),
    [rootPc, scale, sevenths]
  );
  useEffect(() => { setOpen(0); setAllShapes(false); }, [rootPc, scale, sevenths]);

  const chord = chords[Math.min(open, chords.length - 1)];
  const voicings = useMemo(
    () => (chord ? getVoicings(chord.rootPc, chord.type.id, chord.rootName) : []),
    [chord]
  );
  const keyName = `${prettyNote(scaleNotes[0] ?? rootName)} ${shortScaleName(borrowedFrom ?? scale.name).toLowerCase()}`;

  const pick = (i: number) => {
    setOpen(i);
    setAllShapes(false);
    const c = chords[i];
    const v = c ? getVoicings(c.rootPc, c.type.id, c.rootName)[0] : null;
    if (v) onStrum(v.midis);
  };

  // The fifth chord as a dominant 7th, then home: the pull every key has.
  const tonic = chords[0];
  const fifthPc = (rootPc + 7) % 12;
  const dominant = `${prettyNote(NOTE_NAMES[fifthPc])}7`;
  const resolve = () => {
    const v7 = getVoicings(fifthPc, 'dom7').find(v => !v.substituteFor);
    const home = tonic ? getVoicings(tonic.rootPc, tonic.type.id, tonic.rootName)[0] : null;
    if (v7) onSound(v7.midis);
    if (home) setTimeout(() => onSound(home.midis), 1300);
  };

  const built = CHORD_QUALITIES[quality];
  const builtNotes = built.intervals.map(iv => prettyNote(NOTE_NAMES[(rootPc + iv) % 12]));
  const playBuilt = () => {
    const base = noteNameToMidi(rootName, 3);
    onSound(built.intervals.map(iv => base + iv));
  };

  return (
    <section className="glass-panel theory-card">
      <div className="theory-card-head">
        <h3 className="theory-card-title">Chords in {keyName}</h3>
        <Segmented<boolean>
          value={sevenths}
          onChange={setSevenths}
          ariaLabel="Chord size"
          size="sm"
          options={[
            { value: false, label: 'Triads' },
            { value: true, label: '7ths' }
          ]}
        />
      </div>

      {borrowedFrom && (
        <p className="theory-note">
          This scale has too few notes to build chords from, so these come from {shortScaleName(borrowedFrom).toLowerCase()}, which is what players use with it.
        </p>
      )}

      <div className="theory-chips" role="group" aria-label="Chords in the key">
        {chords.map((c, i) => (
          <button
            key={c.degree}
            type="button"
            className={`theory-chip${i === open ? ' is-open' : ''}`}
            onClick={() => pick(i)}
            aria-pressed={i === open}
          >
            <span className="theory-chip-name">{prettyNote(c.symbol)}</span>
            <span className="theory-chip-num readout">{c.numeral}</span>
          </button>
        ))}
      </div>

      {chord && voicings.length > 0 && (
        <div className="theory-chord">
          <button type="button" className="theory-chord-shape" onClick={() => onStrum(voicings[0].midis)} aria-label={`Hear ${prettyNote(chord.symbol)}`}>
            <ChordDiagram frets={voicings[0].frets} fingers={voicings[0].fingers} scale={0.8} />
          </button>
          <div className="theory-chord-text">
            <span className="theory-chord-name">{prettyNote(chord.symbol)}</span>
            <span className="theory-chord-sub">{qualityWord(chord)} · {chord.numeral} of the key</span>
            <span className="theory-chord-notes readout">{chord.noteNames.map(prettyNote).join('  ')}</span>
            <span className="theory-chord-sub">{voicings[0].label} · {TIER_LABEL[voicings[0].tier]}</span>
          </div>
          <button type="button" className="theory-hear" onClick={() => onStrum(voicings[0].midis)} aria-label={`Hear ${prettyNote(chord.symbol)}`}>
            <PlayIcon size={14} />
          </button>
        </div>
      )}

      {voicings.length > 1 && (
        <>
          <button type="button" className="theory-more" onClick={() => setAllShapes(v => !v)} aria-expanded={allShapes}>
            {allShapes ? 'Fewer shapes' : `${voicings.length - 1} more ${voicings.length === 2 ? 'shape' : 'shapes'}`}
          </button>
          {allShapes && (
            <div className="theory-shapes">
              {voicings.slice(1).map((v: ChordVoicing) => (
                <button key={v.id} type="button" className="theory-shape" onClick={() => onStrum(v.midis)} title="Hear this shape">
                  <ChordDiagram frets={v.frets} fingers={v.fingers} scale={0.62} />
                  <span>{v.substituteFor ? `${v.label}, plays ${prettyNote(v.substituteFor)}` : v.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="theory-note">
        <Term k="romanNumerals">Numerals</Term>: uppercase is major, lowercase minor, ° tense. Play a few in a row and you have a progression.
      </p>

      <div className="theory-rows">
        <div className="theory-row">
          <span className="theory-row-text">
            <span>Hear tension resolve</span>
            <small>{dominant} pulls home to {tonic ? prettyNote(tonic.symbol) : prettyNote(rootName)}</small>
          </span>
          <button type="button" className="btn" onClick={resolve}><PlayIcon size={11} />Play</button>
        </div>
        <div className="theory-row">
          <span className="theory-row-text">
            <span>Build any chord on {prettyNote(rootName)}</span>
            <small className="readout">{builtNotes.join('  ')}</small>
          </span>
          <label className="theory-select">
            <select value={quality} onChange={e => setQuality(Number(e.target.value))} aria-label="Chord type">
              {CHORD_QUALITIES.map((q, i) => (
                <option key={q.name} value={i}>{q.name}{CHORD_FEELINGS[q.name] ? ` · ${CHORD_FEELINGS[q.name]}` : ''}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={playBuilt} aria-label={`Play ${prettyNote(rootName)} ${built.name}`}><PlayIcon size={11} /></button>
        </div>
      </div>
    </section>
  );
};

export default ScaleChords;
