import React, { useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { audio } from '../utils/audio';
import type { ChordVoicing } from '../utils/chords';
import {
  COMFORT_HINT,
  COMFORT_LABEL,
  COMFORT_ORDER,
  comfortOf,
  preferredVoicing,
  setComfort,
  setPreferredVoicing,
  voicingsFor,
  type ChordComfort
} from '../utils/chordbook';

/**
 * Three states of one hand, as one control.
 *
 * Deliberately not a slider or a five-point scale. The question is asked in
 * passing, while you are looking at a song, and it has to be answerable in the
 * time it takes to notice you got the change wrong again.
 */
export const ComfortMark: React.FC<{
  symbol: string;
  size?: 'sm' | 'md';
}> = ({ symbol, size = 'md' }) => {
  const comfort = comfortOf(symbol);
  return (
    <div className={`comfort comfort-${size}`} role="group" aria-label={`How ${symbol} feels`}>
      {COMFORT_ORDER.map(value => (
        <button
          key={value}
          type="button"
          className={`comfort-btn is-${value}${comfort === value ? ' is-on' : ''}`}
          aria-pressed={comfort === value}
          title={`${COMFORT_LABEL[value]} — ${COMFORT_HINT[value]}`}
          onClick={() => void setComfort(symbol, value)}
        >
          <span className="comfort-dot" aria-hidden="true" />
          <span className="comfort-text">{COMFORT_LABEL[value]}</span>
        </button>
      ))}
    </div>
  );
};

/** The little coloured pill that says where a chord stands, with no controls. */
export const ComfortChip: React.FC<{ symbol: string; comfort?: ChordComfort }> = ({ symbol, comfort }) => {
  const value = comfort ?? comfortOf(symbol);
  return <span className={`comfort-chip is-${value}`}>{COMFORT_LABEL[value]}</span>;
};

interface ChordCardProps {
  symbol: string;
  /** Show the three-state control under the diagram. */
  markable?: boolean;
  /** Let the fingering be chosen from every shape we know. */
  shapes?: boolean;
  /** Anything the caller wants under the name — "in 4 songs", a count. */
  meta?: React.ReactNode;
  scale?: number;
}

/**
 * One chord: what it is called, the shape you have chosen for it, how it sits
 * in your hands, and every other way it could be played.
 *
 * The shape matters as much as the comfort and is usually left out of apps
 * like this. "I can play B" is never true of B — it is true of one grip, and
 * which grip is the difference between a chord you have and a chord you do
 * not. So the choice is stored, and everything that draws or sounds this
 * chord, the play-along included, uses it.
 */
export const ChordCard: React.FC<ChordCardProps> = ({
  symbol, markable = false, shapes = false, meta, scale = 0.62
}) => {
  const [open, setOpen] = useState(false);
  // Counts strikes rather than holding a boolean, so a second press while the
  // first is still ringing starts a new flash instead of doing nothing — the
  // ring is a fresh element each time, keyed on the count.
  const [strikes, setStrikes] = useState(0);
  const voicing = preferredVoicing(symbol);
  const all = voicingsFor(symbol);
  const comfort = comfortOf(symbol);
  const chosenId = voicing?.id ?? null;

  const strum = (v: ChordVoicing) => {
    audio.playStrum(v.midis);
    setStrikes(n => n + 1);
  };

  return (
    <div className={`chordcard is-${comfort}${voicing ? '' : ' is-plain'}${open ? ' is-open' : ''}`}>
      <div className="chordcard-head">
        <span className="chordcard-name">{symbol}</span>
        {meta && <span className="chordcard-meta readout">{meta}</span>}
      </div>

      {voicing ? (
        <button
          type="button"
          className="chordcard-play"
          onClick={() => strum(voicing)}
          title={`Hear ${symbol} — ${voicing.label}`}
          aria-label={`Hear ${symbol} strummed`}
        >
          <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={scale} />
          {/* Taken off when the animation says it is done, not on a timer: only
              one ring exists at a time, so the event always belongs to the one
              on screen. Left in place it would be an invisible element that
              never goes away. */}
          {strikes > 0 && (
            <span
              key={strikes}
              className="chordcard-ring"
              aria-hidden="true"
              onAnimationEnd={() => setStrikes(0)}
            />
          )}
        </button>
      ) : (
        <span className="chordcard-note">no shape stored</span>
      )}

      {voicing && (
        <span className={`chordcard-shape readout tier-${voicing.tier}`}>
          {voicing.substituteFor ? `${voicing.label} · for ${voicing.substituteFor}` : voicing.label}
        </span>
      )}

      {markable && <ComfortMark symbol={symbol} size="sm" />}

      {shapes && all.length > 1 && (
        <button type="button" className="chordcard-more" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? 'Hide shapes' : `${all.length} shapes`}
        </button>
      )}

      {shapes && open && (
        <div className="shapepick" role="radiogroup" aria-label={`Fingerings for ${symbol}`}>
          {all.map(v => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={v.id === chosenId}
              className={`shapepick-item${v.id === chosenId ? ' is-on' : ''}`}
              onClick={() => { strum(v); void setPreferredVoicing(symbol, v.id); }}
              title={`${v.substituteFor ? `${v.label} — played instead of ${v.substituteFor}` : v.label} · press to hear it and keep it`}
            >
              <ChordDiagram frets={v.frets} fingers={v.fingers} scale={0.44} />
              <span className="shapepick-label readout">{v.label}</span>
              <span className={`shapepick-tier tier-${v.tier}`}>{v.tier}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChordCard;
