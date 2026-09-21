import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordPalette } from './ChordPalette';
import { comfortOf } from '../utils/chordbook';
import { useLibrary } from '../hooks/useLibrary';
import { makeSlot, type Slot } from '../utils/loop';
import {
  LOOP_LEVELS,
  LOOP_TEMPLATES,
  templateBars,
  templateChords,
  templateHasBarre,
  templateSlots,
  type LoopTemplate
} from '../utils/loopTemplates';
import {
  deleteSavedLoop,
  forgetLoop,
  getPlayedLoops,
  getSavedLoops,
  loopPattern,
  loopSlots,
  savedPattern,
  savedSlots,
  whenLabel,
  type PlayedLoop,
  type SavedLoop
} from '../utils/loopbook';

type Tab = 'chords' | 'templates' | 'saved' | 'recent';

export interface LoopSetup {
  tempo: number;
  beatsPerBar: number;
  /** The strumming pattern, as written. */
  pattern?: string;
  /**
   * What this loop was called where it came from.
   *
   * Only so the save field can open with something already in it. A loop that
   * arrived as "Andalusian" and had a chord moved is still most easily named
   * by starting from "Andalusian", and a field you have to fill from nothing
   * every time is a field that gets filled with "asdf".
   */
  name?: string;
}

interface LoopShelfProps {
  /** Replace the loop with this one and take its tempo and metre. */
  onUse: (slots: Slot[], setup: LoopSetup) => void;
  /** Put these chords on the end of what is already there. */
  onAppend: (slots: Slot[]) => void;
  /**
   * Shut the open drawer, because the loop has started.
   *
   * Everything on this shelf is for deciding what to play, and that is decided
   * by the time anybody presses play — after which it is a screenful of things
   * to read instead of the two you need. Put back on stop, and put back open
   * at whatever it was showing: pressing stop is going back to the workbench,
   * and making someone re-find their place in a ladder of drills after every
   * run is a toll on the thing they are here to do.
   */
  shut?: boolean;
  /**
   * Something was just saved — open the saved drawer so it can be seen.
   *
   * A counter rather than a flag, because saving twice over the same name is
   * two events that both have to land, and "has this already been shown" is
   * not answerable from a boolean that is true both times.
   */
  reveal?: number;
}

const distinct = (chords: [string, number][]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [symbol] of chords) {
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
};

const newCount = (symbols: string[]): number => symbols.filter(s => comfortOf(s) === 'none').length;

/**
 * Which rung to open on: the first one that asks for a chord you have not
 * marked, which is the edge of what you can already play.
 *
 * A ladder that always opens at the bottom is a ladder someone with four
 * months of practice scrolls past every time. This uses the chord book to
 * guess where they are and is only a default — the rail is right there.
 */
function suggestedLevel(): number {
  for (const { level } of LOOP_LEVELS) {
    const templates = LOOP_TEMPLATES.filter(t => t.level === level);
    if (templates.some(t => newCount(templateChords(t)) > 0)) return level;
  }
  return LOOP_LEVELS[LOOP_LEVELS.length - 1].level;
}

const Chips: React.FC<{ symbols: string[] }> = ({ symbols }) => (
  <span className="loopcard-chords">
    {symbols.map((symbol, i) => (
      <span key={`${symbol}-${i}`} className={`chordchip is-${comfortOf(symbol)}`}>{symbol}</span>
    ))}
  </span>
);

/**
 * Where the next chords come from.
 *
 * Four drawers under the loop, one open at a time: the chords of a key, a
 * progression worth practising, one you kept, or one you merely played. They
 * are one strip rather than four panels because they answer the same question
 * and you only ever ask it once — and because quick play has to stay one
 * glance tall or it takes the screen away from everything it sits on top of.
 *
 * Saved sits before Recent because it is the deliberate one: everything in it
 * is there because somebody named it, and everything in Recent is there
 * because somebody pressed play. When you are looking for a loop, the one you
 * meant to keep is the likelier answer.
 *
 * It opens on the chords, always. The shelves are for when you want a
 * suggestion; the picker is for the other nine times out of ten, and a picker
 * you have to open first is a picker that has already cost you the press it
 * was meant to save.
 */
export const LoopShelf: React.FC<LoopShelfProps> = ({ onUse, onAppend, shut = false, reveal = 0 }) => {
  useLibrary();   // recent loops are written by the panel above; redraw when they change
  const [tab, setTab] = useState<Tab | null>('chords');
  const [level, setLevel] = useState(suggestedLevel);

  // Mirrored on render so the effect can read the current tab without taking
  // it as a dependency — depending on it would park the drawer every time
  // somebody merely changed which one was open.
  const open = useRef(tab);
  open.current = tab;
  const parked = useRef<Tab | null>(null);
  useEffect(() => {
    if (shut) {
      parked.current = open.current;
      setTab(null);
    } else if (parked.current !== null) {
      setTab(parked.current);
      parked.current = null;
    }
  }, [shut]);

  // Saving puts you in front of what you saved. Nothing else on the page says
  // it worked, and a store that swallows things silently is a store nobody
  // trusts with the thing they wanted kept.
  useEffect(() => {
    if (reveal > 0) {
      setTab('saved');
      parked.current = null;
    }
  }, [reveal]);

  const recent = getPlayedLoops();
  const saved = getSavedLoops();
  const templates = useMemo(() => LOOP_TEMPLATES.filter(t => t.level === level), [level]);

  const press = (next: Tab) => setTab(cur => (cur === next ? null : next));

  const loadTemplate = (t: LoopTemplate) =>
    onUse(templateSlots(t), { tempo: t.tempo, beatsPerBar: t.beatsPerBar, name: t.name });
  const loadLoop = (loop: PlayedLoop) =>
    onUse(loopSlots(loop), { tempo: loop.tempo, beatsPerBar: loop.beatsPerBar, pattern: loopPattern(loop) });
  const loadSaved = (loop: SavedLoop) =>
    onUse(savedSlots(loop), {
      tempo: loop.tempo,
      beatsPerBar: loop.beatsPerBar,
      pattern: savedPattern(loop),
      name: loop.name
    });

  return (
    <div className="quickplay-shelf">
      <div className="quickplay-tabs">
        <button
          type="button"
          className={`qtab${tab === 'chords' ? ' is-on' : ''}`}
          onClick={() => press('chords')}
          aria-expanded={tab === 'chords'}
        >
          Chords
        </button>
        <button
          type="button"
          className={`qtab${tab === 'templates' ? ' is-on' : ''}`}
          onClick={() => press('templates')}
          aria-expanded={tab === 'templates'}
        >
          Templates
        </button>
        <button
          type="button"
          className={`qtab${tab === 'saved' ? ' is-on' : ''}`}
          onClick={() => press('saved')}
          aria-expanded={tab === 'saved'}
          disabled={saved.length === 0}
          title={saved.length === 0 ? 'Name a loop with Save and it is kept here for good' : undefined}
        >
          Saved
          {saved.length > 0 && <span className="qtab-count">{saved.length}</span>}
        </button>
        <button
          type="button"
          className={`qtab${tab === 'recent' ? ' is-on' : ''}`}
          onClick={() => press('recent')}
          aria-expanded={tab === 'recent'}
          disabled={recent.length === 0}
          title={recent.length === 0 ? 'Loops you play are kept here' : undefined}
        >
          Recent
          {recent.length > 0 && <span className="qtab-count">{recent.length}</span>}
        </button>
      </div>

      {tab === 'chords' && (
        <div className="quickplay-drawer">
          <ChordPalette onAdd={symbols => onAppend(symbols.map(symbol => makeSlot(symbol)))} />
        </div>
      )}

      {tab === 'templates' && (
        <div className="quickplay-drawer">
          <div className="qlevels" role="group" aria-label="Difficulty">
            {LOOP_LEVELS.map(l => (
              <button
                key={l.level}
                type="button"
                className={`qlevel${l.level === level ? ' is-on' : ''}`}
                onClick={() => setLevel(l.level)}
                aria-pressed={l.level === level}
                title={l.note}
              >
                <span className="qlevel-n">{l.level}</span>
                {l.name}
              </button>
            ))}
          </div>
          <div className="loopcards">
            {templates.map(t => {
              const chords = templateChords(t);
              return (
                <article key={t.id} className="loopcard">
                  <button
                    type="button"
                    className="loopcard-main"
                    onClick={() => loadTemplate(t)}
                    aria-label={`Play ${t.name}`}
                    title={t.note}
                  >
                    <Chips symbols={chords} />
                    <span className="loopcard-name">{t.name}</span>
                    <span className="loopcard-meta readout">
                      {templateBars(t)} bars · {t.tempo} bpm{t.beatsPerBar === 4 ? '' : ` · in ${t.beatsPerBar}`}
                      {/* On the card rather than only in the level's name,
                          because the barre rungs are not the only place a bar
                          turns up and "which of these makes me do the hard
                          thing" is the question being asked of this shelf. */}
                      {templateHasBarre(t) && <span className="loopcard-barre">barre</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="loopcard-add"
                    onClick={() => onAppend(templateSlots(t))}
                    aria-label={`Add ${t.name} to the end of the loop`}
                    title="Add to the end"
                  >
                    +
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'saved' && (
        <div className="quickplay-drawer">
          <div className="loopcards">
            {saved.map(loop => {
              const chords = distinct(loop.chords);
              return (
                <article key={loop.id} className="loopcard">
                  <button
                    type="button"
                    className="loopcard-main"
                    onClick={() => loadSaved(loop)}
                    aria-label={`Load ${loop.name}`}
                    title={`Load ${loop.name}`}
                  >
                    <Chips symbols={chords} />
                    {/* The name is the card here. On a template it is a label
                        for chords somebody else chose; on this shelf it is the
                        only thing that tells two of your own loops apart. */}
                    <span className="loopcard-name is-given">{loop.name}</span>
                    <span className="loopcard-meta readout">
                      {loop.chords.reduce((n, [, bars]) => n + bars, 0)} bars · {loop.tempo} bpm{loop.beatsPerBar === 4 ? '' : ` · in ${loop.beatsPerBar}`} · <span className="readout">{savedPattern(loop)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="loopcard-add is-drop"
                    onClick={() => void deleteSavedLoop(loop.id)}
                    aria-label={`Delete ${loop.name}`}
                    title="Delete this loop"
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'recent' && (
        <div className="quickplay-drawer">
          <div className="loopcards">
            {recent.map(loop => {
              const chords = distinct(loop.chords);
              return (
                <article key={loop.id} className="loopcard">
                  <button
                    type="button"
                    className="loopcard-main"
                    onClick={() => loadLoop(loop)}
                    aria-label={`Play ${chords.join(' ')} again`}
                    title="Load this loop"
                  >
                    <Chips symbols={chords} />
                    <span className="loopcard-meta readout">
                      {loop.tempo} bpm{loop.beatsPerBar === 4 ? '' : ` · in ${loop.beatsPerBar}`} · <span className="readout">{loopPattern(loop)}</span> · {whenLabel(loop.playedAt)}{loop.runs > 1 ? ` · ×${loop.runs}` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="loopcard-add is-drop"
                    onClick={() => void forgetLoop(loop.id)}
                    aria-label={`Forget ${chords.join(' ')}`}
                    title="Forget this loop"
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoopShelf;
