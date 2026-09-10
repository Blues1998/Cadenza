import React, { useMemo, useState } from 'react';
import { comfortOf } from '../utils/chordbook';
import { useLibrary } from '../hooks/useLibrary';
import type { Slot } from '../utils/loop';
import {
  LOOP_LEVELS,
  LOOP_TEMPLATES,
  templateBars,
  templateChords,
  templateSlots,
  type LoopTemplate
} from '../utils/loopTemplates';
import { forgetLoop, getSavedLoops, loopPattern, loopSlots, whenLabel, type SavedLoop } from '../utils/loopbook';

type Tab = 'templates' | 'recent';

export interface LoopSetup {
  tempo: number;
  beatsPerBar: number;
  /** The strumming pattern, as written. */
  pattern?: string;
}

interface LoopShelfProps {
  /** Replace the loop with this one and take its tempo and metre. */
  onUse: (slots: Slot[], setup: LoopSetup) => void;
  /** Put these chords on the end of what is already there. */
  onAppend: (slots: Slot[]) => void;
  /** Open on the templates — true when quick play was opened with nothing in it. */
  startOpen?: boolean;
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
 * Somewhere to start, and somewhere to come back to.
 *
 * Two shelves under the loop: progressions worth practising, arranged by how
 * hard they are on the hand, and the ones you have played before. Both hand
 * back the same thing — a sequence, a tempo and a metre — because to quick
 * play there is no difference between a loop we suggested and one you built.
 */
export const LoopShelf: React.FC<LoopShelfProps> = ({ onUse, onAppend, startOpen = false }) => {
  useLibrary();   // recent loops are written by the panel above; redraw when they change
  const [tab, setTab] = useState<Tab | null>(startOpen ? 'templates' : null);
  const [level, setLevel] = useState(suggestedLevel);

  const recent = getSavedLoops();
  const templates = useMemo(() => LOOP_TEMPLATES.filter(t => t.level === level), [level]);

  const press = (next: Tab) => setTab(cur => (cur === next ? null : next));

  const loadTemplate = (t: LoopTemplate) =>
    onUse(templateSlots(t), { tempo: t.tempo, beatsPerBar: t.beatsPerBar });
  const loadLoop = (loop: SavedLoop) =>
    onUse(loopSlots(loop), { tempo: loop.tempo, beatsPerBar: loop.beatsPerBar, pattern: loopPattern(loop) });

  return (
    <div className="quickplay-shelf">
      <div className="quickplay-tabs">
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
