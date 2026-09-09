import React, { useMemo, useState } from 'react';
import { ChordCard } from './ChordCard';
import { Segmented } from './Segmented';
import {
  GROUP_LABEL,
  allChords,
  groupChords,
  keyGroup,
  noteLabel,
  type ChordGroup,
  type GroupBy
} from '../utils/catalogue';
import { NOTE_NAMES, SCALE_FORMULAS } from '../utils/musicTheory';
import { COMFORT_LABEL, comfortOf, tally, type ChordComfort } from '../utils/chordbook';

type Only = 'all' | ChordComfort;

const ONLY: { value: Only; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'solid', label: 'Solid' },
  { value: 'shaky', label: 'Shaky' },
  { value: 'none', label: 'Not yet' }
];

const GROUPS: { value: GroupBy; label: string }[] =
  (['key', 'root', 'quality', 'difficulty'] as GroupBy[]).map(value => ({ value, label: GROUP_LABEL[value] }));

/**
 * The whole catalogue, arranged four ways.
 *
 * Groups are collapsed rather than paged. A collapsed group still shows its
 * tally, so the page answers "how much of A minor do I have" without opening
 * anything — and a hundred and thirty-two chord diagrams are not built until
 * something is actually being looked at.
 */
export const ChordCatalogue: React.FC<{ onPick?: (symbol: string) => void }> = ({ onPick }) => {
  const [by, setBy] = useState<GroupBy>('key');
  const [only, setOnly] = useState<Only>('all');
  const [rootPc, setRootPc] = useState(9);           // A — where a guitarist starts
  const [scaleName, setScaleName] = useState(SCALE_FORMULAS[1].name);   // natural minor
  const [sevenths, setSevenths] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const groups = useMemo<ChordGroup[]>(() => {
    if (by === 'key') {
      const group = keyGroup({ rootPc, scaleName, sevenths });
      return group ? [group] : [];
    }
    return groupChords(allChords(), by);
  }, [by, rootPc, scaleName, sevenths]);

  // One group is a page, not a list — a key opens on its own.
  const singleton = groups.length === 1;

  const shown = useMemo(
    () => groups
      .map(group => ({
        ...group,
        chords: only === 'all' ? group.chords : group.chords.filter(c => comfortOf(c.symbol) === only)
      }))
      .filter(group => group.chords.length > 0),
    [groups, only]
  );

  const isOpen = (id: string) => singleton || open.has(id);
  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allOpen = shown.every(g => isOpen(g.id));

  return (
    <div className="catalogue">
      <div className="catalogue-bar">
        <label className="catalogue-field">
          <span className="field-label">Arrange by</span>
          <Segmented<GroupBy> value={by} onChange={setBy} options={GROUPS} ariaLabel="Arrange chords by" size="sm" />
        </label>

        {by === 'key' && (
          <>
            <label className="catalogue-field">
              <span className="field-label">Key</span>
              <select className="select-field" value={rootPc} onChange={e => setRootPc(Number(e.target.value))}>
                {NOTE_NAMES.map((name, pc) => <option key={name} value={pc}>{noteLabel(name)}</option>)}
              </select>
            </label>
            <label className="catalogue-field">
              <span className="field-label">Scale</span>
              <select className="select-field" value={scaleName} onChange={e => setScaleName(e.target.value)}>
                {SCALE_FORMULAS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </label>
            <label className="chart-toggle">
              <input type="checkbox" checked={sevenths} onChange={e => setSevenths(e.target.checked)} />
              Sevenths
            </label>
          </>
        )}

        <label className="catalogue-field catalogue-only">
          <span className="field-label">Show</span>
          <Segmented<Only> value={only} onChange={setOnly} options={ONLY} ariaLabel="Filter by comfort" size="sm" />
        </label>

        {!singleton && (
          <button
            type="button"
            className="btn catalogue-expand"
            onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map(g => g.id)))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="song-empty">
          {only === 'all' ? 'Nothing to show here.' : `No ${COMFORT_LABEL[only].toLowerCase()} chords in this arrangement.`}
        </p>
      ) : shown.map(group => {
        const counts = tally(group.chords.map(c => c.symbol));
        const opened = isOpen(group.id);
        return (
          <section key={group.id} className={`catgroup${opened ? ' is-open' : ''}`}>
            <button
              type="button"
              className="catgroup-head"
              onClick={() => toggle(group.id)}
              aria-expanded={opened}
              disabled={singleton}
            >
              {!singleton && (
                <svg className="catgroup-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 5 16 12 9 19" />
                </svg>
              )}
              <span className="catgroup-title">{group.title}</span>
              {group.subtitle && <span className="catgroup-sub readout">{group.subtitle}</span>}
              {/* The tally is the reason a collapsed group is still worth
                  having on screen: coverage, one key at a time. */}
              <span className="catgroup-tally" aria-label={`${counts.solid} solid, ${counts.shaky} shaky, ${counts.none} not yet`}>
                <span className="tallybar">
                  {(['solid', 'shaky', 'none'] as ChordComfort[]).map(c => (
                    counts[c] > 0 && (
                      <span
                        key={c}
                        className={`tallybar-seg is-${c}`}
                        style={{ flexGrow: counts[c] }}
                        title={`${counts[c]} ${COMFORT_LABEL[c].toLowerCase()}`}
                      />
                    )
                  ))}
                </span>
                <span className="readout">{counts.solid}/{group.chords.length}</span>
              </span>
            </button>

            {opened && (
              <div className="chordcards chordcards-book">
                {group.chords.map(chord => (
                  <ChordCard
                    key={chord.symbol + (chord.numeral ?? '')}
                    symbol={chord.symbol}
                    markable
                    shapes
                    scale={0.66}
                    onPick={onPick}
                    meta={chord.numeral ?? chord.typeName}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ChordCatalogue;
