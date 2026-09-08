import React, { useMemo, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { Term } from './Term';
import { SCALE_FORMULAS, NOTE_NAMES } from '../utils/musicTheory';
import type { ScaleFormula } from '../utils/musicTheory';
import { getScaleChords, getVoicings, prettyNote } from '../utils/chords';
import type { ChordVoicing, DifficultyTier, ScaleChord } from '../utils/chords';

interface ScaleChordsProps {
  rootName: string;          // a NOTE_NAMES entry, from the explorer above
  scale: ScaleFormula;
  onStrum: (midis: number[]) => void;
}

const TIER_COLOR: Record<DifficultyTier, string> = {
  easy: 'var(--success)',
  medium: 'var(--warning)',
  hard: 'var(--danger)'
};

const TIER_LABEL: Record<DifficultyTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Tricky'
};

const TierBadge: React.FC<{ tier: DifficultyTier }> = ({ tier }) => (
  <span
    style={{
      fontSize: '0.6rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: TIER_COLOR[tier],
      border: `1px solid ${TIER_COLOR[tier]}`,
      borderRadius: '8px',
      padding: '1px 7px',
      whiteSpace: 'nowrap'
    }}
  >
    {TIER_LABEL[tier]}
  </span>
);

// One fingering: the box, what it's called, and how hard it is. `compact` is
// used for the alternates, which sit two-up inside a card.
const VoicingCard: React.FC<{
  voicing: ChordVoicing;
  onStrum: (m: number[]) => void;
  compact?: boolean;
}> = ({ voicing, onStrum, compact = false }) => (
  <div
    onClick={() => onStrum(voicing.midis)}
    title="Click to hear it strummed"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.3rem',
      padding: compact ? '0.4rem 0.25rem 0.5rem' : '0.5rem 0.4rem 0.6rem',
      borderRadius: '8px',
      cursor: 'pointer',
      background: 'var(--surface-2)',
      flex: compact ? '1 1 92px' : '0 0 auto',
      minWidth: compact ? '92px' : '116px',
      maxWidth: compact ? '124px' : undefined
    }}
  >
    <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={compact ? 0.78 : 1} />
    <span style={{ fontSize: compact ? '0.64rem' : '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
      {voicing.label}
    </span>
    <TierBadge tier={voicing.tier} />
    {voicing.substituteFor && (
      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
        plays {prettyNote(voicing.substituteFor)} instead
      </span>
    )}
  </div>
);

const ChordCard: React.FC<{ chord: ScaleChord; onStrum: (m: number[]) => void }> = ({ chord, onStrum }) => {
  const [expanded, setExpanded] = useState(false);
  const voicings = useMemo(
    () => getVoicings(chord.rootPc, chord.type.id, chord.rootName),
    [chord.rootPc, chord.type.id, chord.rootName]
  );

  if (voicings.length === 0) return null;
  const [easiest, ...rest] = voicings;

  return (
    <div
      className="glass-card"
      style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{prettyNote(chord.symbol)}</strong>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>{chord.numeral}</span>
      </div>

      <span className="readout" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        {chord.noteNames.map(prettyNote).join(' · ')}
      </span>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <VoicingCard voicing={easiest} onStrum={onStrum} />
      </div>

      {rest.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="btn"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', justifyContent: 'center' }}
        >
          {expanded ? 'Hide' : `${rest.length} other way${rest.length === 1 ? '' : 's'} to play it`} {expanded ? '▴' : '▾'}
        </button>
      )}

      {expanded && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.4rem',
            justifyContent: 'center',
            paddingTop: '0.6rem'
          }}
        >
          {rest.map(v => (
            <VoicingCard key={v.id} voicing={v} onStrum={onStrum} compact />
          ))}
        </div>
      )}
    </div>
  );
};

export const ScaleChords: React.FC<ScaleChordsProps> = ({ rootName, scale, onStrum }) => {
  const [sevenths, setSevenths] = useState(false);

  const rootPc = Math.max(0, NOTE_NAMES.indexOf(rootName));
  const { chords, scaleNotes, borrowedFrom } = useMemo(
    () => getScaleChords(rootPc, scale, sevenths, SCALE_FORMULAS),
    [rootPc, scale, sevenths]
  );

  return (
    <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>
            Chords in {prettyNote(scaleNotes[0] ?? rootName)} {scale.name}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '52ch' }}>
            Every chord built from this scale's own notes, with a fingering you can play.
            Click any box to hear it strummed — the numbers are which finger goes where
            (1 = index, 4 = pinky), <strong>×</strong> means don't play that string.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setSevenths(false)}
            className={`btn ${!sevenths ? 'btn-secondary' : ''}`}
            style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
          >
            Triads
          </button>
          <button
            onClick={() => setSevenths(true)}
            className={`btn ${sevenths ? 'btn-secondary' : ''}`}
            style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
          >
            <Term k="seventhChord">7th chords</Term>
          </button>
        </div>
      </div>

      {borrowedFrom && (
        <p
          style={{
            fontSize: '0.76rem',
            color: 'var(--text-secondary)',
            background: 'var(--surface-2)',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            lineHeight: 1.5,
            margin: 0
          }}
        >
          {scale.name} has too few notes to build chords from on its own — these come from
          its parent <strong style={{ color: 'var(--text-primary)' }}>{borrowedFrom}</strong>, which is what
          players actually solo over with it.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: '0.85rem', alignItems: 'start' }}>
        {chords.map(chord => (
          <ChordCard key={chord.degree} chord={chord} onStrum={onStrum} />
        ))}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
        Stuck on a shape? Open “other ways to play it” — the list runs easiest first, and
        seventh chords also offer the plain triad underneath, which is what most players
        substitute when the full shape is out of reach.
      </p>
    </section>
  );
};

export default ScaleChords;
