import React, { useMemo, useState } from 'react';
import { Segmented } from './Segmented';
import { audio } from '../utils/audio';
import { keyGroup, noteLabel } from '../utils/catalogue';
import { comfortOf, preferredVoicing } from '../utils/chordbook';
import { NOTE_NAMES } from '../utils/musicTheory';
import { readChordLine } from '../utils/songText';

type Mode = 'major' | 'minor';

const MODES: { value: Mode; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' }
];

// The picker offers two of the six scales the app harmonises. Building a
// progression is not the place to meet the harmonic minor: the catalogue below
// still has every one of them, and anything at all can be typed by name.
const SCALE_OF: Record<Mode, string> = {
  major: 'Major (Ionian)',
  minor: 'Natural Minor (Aeolian)'
};

interface ChordPaletteProps {
  /** Put these chords on the end of the loop, in the order given. */
  onAdd: (symbols: string[]) => void;
}

/**
 * Where the next chord comes from.
 *
 * Quick play used to be filled from the chord book underneath it — press a
 * card on the page and it lands in the loop. That reads well as a sentence and
 * badly as a screen: a chord card is a thing for meeting a chord, two hundred
 * pixels of fretboard diagram and comfort marks, and a wall of them is a
 * terrible place to go looking for the four you already know you want. The
 * panel ended up taking the top of the screen and the picking took the rest.
 *
 * So the picking is in here now, and it is small, because a progression is not
 * a search problem. Two routes:
 *
 *   A key.   Seven chords that belong together, with their numerals, one press
 *            each. Nearly every progression anybody practises is a walk around
 *            one of these, and "the fourth chord of A minor" is a thing you can
 *            find in a row of seven far faster than "Dm" in a list of a hundred.
 *
 *   A line.  "Am Em F G", typed or pasted, in one go. Nothing beats knowing
 *            what you want and saying so, and progressions are written down
 *            like this everywhere they are written down at all.
 *
 * The chord cards on the page still work as they did. They are just no longer
 * the only way in, which is what made them a problem.
 */
export const ChordPalette: React.FC<ChordPaletteProps> = ({ onAdd }) => {
  // A minor, where the catalogue opens too — the key a guitar falls into.
  const [rootPc, setRootPc] = useState(9);
  const [mode, setMode] = useState<Mode>('minor');
  const [sevenths, setSevenths] = useState(false);
  const [typed, setTyped] = useState('');

  const group = useMemo(
    () => keyGroup({ rootPc, scaleName: SCALE_OF[mode], sevenths }),
    [rootPc, mode, sevenths]
  );

  // Heard as it is added. Pressing a chord you are not sure of should tell you
  // what it is, and the whole panel is about hearing things.
  const add = (symbol: string) => {
    const voicing = preferredVoicing(symbol);
    if (voicing) audio.playStrum(voicing.midis, 1.6, 0.03);
    onAdd([symbol]);
  };

  const written = useMemo(() => readChordLine(typed), [typed]);
  // A chord with no shape would go in silently and stay silent, which looks
  // like the app losing it. Said out loud instead, and left out.
  const playable = useMemo(() => written.filter(symbol => preferredVoicing(symbol) !== null), [written]);
  const lost = written.length - playable.length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playable.length === 0) return;
    onAdd(playable);
    setTyped('');
  };

  return (
    <div className="palette">
      <div className="palette-bar">
        <label className="catalogue-field">
          <span className="field-label">Key</span>
          <select
            className="select-field"
            value={rootPc}
            onChange={e => setRootPc(Number(e.target.value))}
            aria-label="Key"
          >
            {NOTE_NAMES.map((name, pc) => <option key={name} value={pc}>{noteLabel(name)}</option>)}
          </select>
        </label>
        <Segmented<Mode> value={mode} onChange={setMode} options={MODES} ariaLabel="Major or minor" size="sm" />
        <label className="chart-toggle">
          <input type="checkbox" checked={sevenths} onChange={e => setSevenths(e.target.checked)} />
          Sevenths
        </label>
        {group?.subtitle && <span className="palette-notes readout">{group.subtitle}</span>}
      </div>

      {group && (
        <div className="palette-chords">
          {group.chords.map(chord => (
            <button
              key={chord.symbol + chord.numeral}
              type="button"
              className={`palette-chord is-${comfortOf(chord.symbol)}`}
              onClick={() => add(chord.symbol)}
              title={`Add ${chord.symbol} to the loop`}
              aria-label={`Add ${chord.symbol} to the loop`}
            >
              {/* The numeral first, small: it is the part that says why this
                  chord is next to that one, and it is the same seven whatever
                  key you turn the dial to. */}
              <span className="palette-numeral">{chord.numeral}</span>
              <span className="palette-name">{chord.symbol}</span>
            </button>
          ))}
        </div>
      )}

      <form className="palette-write" onSubmit={submit}>
        <input
          className="text-field"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="Am Em F G"
          aria-label="Write a progression"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={playable.length === 0}>
          Add{playable.length > 1 ? ` ${playable.length}` : ''}
        </button>
        {/* Empty, this says what the field takes; filled, it says what the
            field was understood to say. Both are the same question — "what
            will pressing Add do" — so they are the same line. */}
        <span className="palette-read readout">
          {written.length === 0
            ? 'spaces, arrows or dashes — a whole progression at once'
            : playable.join(' · ')}
          {lost > 0 && <span className="palette-lost"> · {lost} not a chord we know</span>}
        </span>
      </form>
    </div>
  );
};

export default ChordPalette;
