import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GROUPS, type ActiveTab } from './navGroups';
import { IconBest } from './Icons';
import { go } from '../hooks/useRoute';
import { handLoop } from '../utils/handoff';
import { getSongs } from '../utils/library';
import { LOOP_LEVELS, LOOP_TEMPLATES, templateSlots } from '../utils/loopTemplates';
import { bestFor } from '../utils/records';
import { loopSignature } from '../utils/loopbook';
import { capoLabel } from '../utils/songText';

interface Command {
  id: string;
  label: string;
  group: string;
  /** Searched as well as shown, small, after the label. */
  hint?: string;
  /** Shown at the right — a record, a day number. */
  tag?: React.ReactNode;
  icon?: React.ReactNode;
  run: () => void;
}

/**
 * Where a match landed, lower being better.
 *
 * Three tiers, because "F" should find the chord drill called "Down to the F"
 * below the song called "Fix You" — a word you started typing beats a word you
 * landed in the middle of, and both beat a match in the small print.
 */
const score = (command: Command, needle: string): number => {
  const label = command.label.toLocaleLowerCase();
  const at = label.indexOf(needle);
  if (at === 0) return 0;
  if (at > 0) return /\s|[-·(]/.test(label[at - 1]) ? 1 : 2;
  return (command.hint ?? '').toLocaleLowerCase().includes(needle) ? 3 : -1;
};

/**
 * One field over everything there is.
 *
 * Named for what it does rather than what it is, because "palette" was taken:
 * the chord picker inside quick play has owned `.palette` since long before
 * this, and a second one would have quietly worn the first one's styles.
 *
 * Twelve destinations, thirty songs, nine rungs of drills: past a certain
 * amount of content, search beats hierarchy, and the rail cannot grow a
 * thirteenth row for every idea. Nothing here is reachable only from here —
 * this is a shortcut to places that exist, which is what keeps it honest.
 */
export const JumpTo: React.FC<{ onClose: () => void; onToggleTheme: () => void }> = ({ onClose, onToggleTheme }) => {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => { field.current?.focus(); }, []);

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];

    for (const group of GROUPS) {
      for (const item of group.items) {
        out.push({
          id: `go-${item.id}`,
          label: item.label,
          group: 'Go',
          hint: group.name,
          icon: item.icon,
          run: () => go({ tab: item.id as ActiveTab, songId: null })
        });
      }
    }

    for (const song of getSongs()) {
      out.push({
        id: `song-${song.id}`,
        label: song.title,
        group: 'Songs',
        hint: [song.artist, song.key, capoLabel(song.capo)].filter(Boolean).join(' · '),
        tag: song.day ? <span className="readout">{String(song.day).padStart(2, '0')}</span> : undefined,
        run: () => go({ tab: 'library', songId: song.id })
      });
    }

    const levelName = new Map(LOOP_LEVELS.map(l => [l.level, l.name]));
    for (const template of LOOP_TEMPLATES) {
      const best = bestFor(loopSignature(template.chords, template.beatsPerBar));
      out.push({
        id: `drill-${template.id}`,
        label: template.name,
        group: 'Drills',
        hint: `${levelName.get(template.level) ?? ''} · ${template.chords.map(([s]) => s).join(' ')}`,
        tag: best === null
          ? <span className="readout">{template.tempo} bpm</span>
          : <span className="jump-best"><IconBest size={11} />{best}</span>,
        run: () => {
          handLoop({
            slots: templateSlots(template),
            tempo: template.tempo,
            beatsPerBar: template.beatsPerBar,
            name: template.name
          });
          go({ tab: 'chordbook', songId: null });
        }
      });
    }

    out.push({ id: 'do-theme', label: 'Switch theme', group: 'Do', hint: 'light dark', run: onToggleTheme });

    return out;
  }, [onToggleTheme]);

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle === '') {
      // Nothing typed is not nothing to show: the destinations are the answer
      // to "where can I go", and an empty panel would make the field look
      // like it wanted a password.
      return commands.filter(c => c.group === 'Go');
    }
    return commands
      .map(c => ({ c, rank: score(c, needle) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.c.label.length - b.c.label.length)
      .slice(0, 24)
      .map(({ c }) => c);
  }, [commands, query]);

  useEffect(() => { setAt(0); }, [query]);

  // Keep the highlighted row in view when it is being walked with the arrows.
  useEffect(() => {
    list.current?.querySelector('[data-at="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[at]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let lastGroup = '';

  return (
    <div className="overlay" onMouseDown={onClose} role="presentation">
      <div className="jump" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Jump to">
        <input
          ref={field}
          className="jump-field"
          type="text"
          value={query}
          placeholder="Jump to a screen, a song, a drill…"
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="jump-list" ref={list} role="listbox" aria-label="Results">
          {shown.length === 0 && <p className="jump-none">Nothing by that name.</p>}
          {shown.map((command, i) => {
            const head = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <React.Fragment key={command.id}>
                {head && <span className="jump-group">{head}</span>}
                <button
                  type="button"
                  className={`jump-row${i === at ? ' is-at' : ''}`}
                  data-at={i === at}
                  role="option"
                  aria-selected={i === at}
                  onMouseMove={() => setAt(i)}
                  onClick={() => choose(command)}
                >
                  {command.icon && <span className="jump-icon">{command.icon}</span>}
                  <span className="jump-label">{command.label}</span>
                  {command.hint && <span className="jump-hint">{command.hint}</span>}
                  {command.tag && <span className="jump-tag">{command.tag}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default JumpTo;
