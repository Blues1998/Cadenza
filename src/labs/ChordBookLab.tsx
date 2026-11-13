import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChordBucket } from '../components/ChordBucket';
import { LabIcon } from '../components/LabIcon';
import { IconComfort } from '../components/Icons';
import { ChordCard } from '../components/ChordCard';
import { ChordCatalogue } from '../components/ChordCatalogue';
import { QuickPlay, type TransportOrder } from '../components/QuickPlay';
import { onHandoff, takeLoop, type Handoff } from '../utils/handoff';
import { makeSlot, type Slot } from '../utils/loop';
import { Segmented } from '../components/Segmented';
import { useLibrary } from '../hooks/useLibrary';
import { getSongs, songChords } from '../utils/library';
import { timeChart } from '../utils/chart';
import {
  COMFORT_LABEL,
  chordKey,
  comfortOf,
  forgetChord,
  getChordSkills,
  setComfort,
  setPreferredVoicing,
  skillFor,
  voicingsFor,
  type ChordComfort
} from '../utils/chordbook';
import { drillSlots, nextChords, reasonFor, type NextChord } from '../utils/next';
import type { ChartPhase } from '../hooks/useChartTransport';
import { normalizeChordSymbol } from '../utils/songText';
import { chartsWithChord, hideChord, removeFromSongs, songsWithChord, unhideAll, unhideChord, useHiddenChords } from '../utils/chordRemoval';
import { useBackToClose } from '../utils/nativeShell';

type View = 'songs' | 'all';

const VIEWS: { value: View; label: string }[] = [
  { value: 'songs', label: 'In your songs' },
  { value: 'all', label: 'All chords' }
];

type Filter = 'all' | ChordComfort | 'unrated';


// A filter names one of the states the cards are marked with, so it shows the
// same ring the cards show. Without it the row of words and the rings under
// them are two vocabularies for one idea.
const comfortOption = (value: ChordComfort, label: string) => (
  <span className="filter-mark"><IconComfort state={value} />{label}</span>
);

const FILTERS: { value: Filter; label: React.ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'solid', label: comfortOption('solid', 'Solid') },
  { value: 'shaky', label: comfortOption('shaky', 'Shaky') },
  { value: 'none', label: comfortOption('none', 'Not yet') },
  { value: 'unrated', label: 'Unrated' }
];

interface Entry {
  /** The canonical key the book files it under. */
  key: string;
  /** What the cards show. */
  symbol: string;
  /** Songs in the library that ask for this chord. */
  songs: string[];
  comfort: ChordComfort;
  rated: boolean;
  /** How hard the easiest shape is, the order to meet them in. */
  difficulty: number;
}

/**
 * Every chord you have met, and where you stand with each.
 *
 * The list is not a catalogue of all the chords there are. It is the ones your
 * own songs ask for, because those are the ones worth an opinion, plus
 * anything you add by hand. A chord book of six hundred entries is a reference
 * work; this is meant to be finishable in an evening.
 */
export const ChordBookLab: React.FC = () => {
  const ready = useLibrary();
  const [view, setView] = useState<View>('songs');
  // The bucket: what has been ticked, in the order it was ticked. It outlives
  // the panel, so shutting quick play to go and find two more chords does not
  // throw away the four you had.
  const [picked, setPicked] = useState<Slot[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState('');
  const skills = getChordSkills();
  const songs = getSongs();
  const hidden = useHiddenChords();

  const entries = useMemo<Entry[]>(() => {
    // Keyed canonically so B flat and A sharp are one chord, but shown with
    // the spelling the songs themselves used, the book is filed by pitch and
    // read in whatever language your sheets are written in.
    const found = new Map<string, { display: string; titles: Set<string> }>();
    const note = (symbol: string, title: string) => {
      const key = chordKey(symbol);
      if (!key) return;
      if (!found.has(key)) found.set(key, { display: normalizeChordSymbol(symbol), titles: new Set() });
      if (title) found.get(key)?.titles.add(title);
    };

    for (const song of songs) {
      for (const symbol of songChords(song)) note(symbol, song.title);
      if (song.chart && song.chart.lines.length > 0) {
        // Read through the chart's own lens, so a chord is filed under the grip
        // you make rather than the pitch it comes out at. The book is about
        // hands: with a capo on, the sheet's Dm is an Am as far as they care.
        const parsed = timeChart(song.chart.lines, song.chart.beatsPerBar, song.chart.transpose);
        for (const symbol of parsed.chords) note(symbol, song.title);
      }
    }
    // Anything rated by hand belongs here whether or not a song uses it.
    for (const skill of skills) {
      if (!found.has(skill.id)) found.set(skill.id, { display: skill.label ?? skill.id, titles: new Set() });
    }

    return [...found.entries()]
      .filter(([key]) => !hidden.has(key))
      .map(([key, { display, titles }]) => ({
        key,
        symbol: display,
        songs: [...titles].sort(),
        comfort: comfortOf(key),
        rated: skills.some(s => s.id === key),
        difficulty: voicingsFor(key)[0]?.difficulty ?? 99
      }))
      // Most-used first, then easiest: the order that gets the most songs
      // unlocked for the least work.
      .sort((a, b) => b.songs.length - a.songs.length || a.difficulty - b.difficulty || a.symbol.localeCompare(b.symbol));
  }, [songs, skills, hidden]);

  // The four are disjoint and add up to the total. An unrated chord is one you
  // cannot play either, but counting it under both headings put the same four
  // chords in the summary twice and made the line unreadable.
  const counts = useMemo(() => ({
    solid: entries.filter(e => e.comfort === 'solid').length,
    shaky: entries.filter(e => e.comfort === 'shaky').length,
    none: entries.filter(e => e.rated && e.comfort === 'none').length,
    unrated: entries.filter(e => !e.rated).length
  }), [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (q && !e.symbol.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'unrated') return !e.rated;
      return e.comfort === filter;
    });
  }, [entries, filter, query]);

  // The unrated ones, easiest first: a pass you can make in a couple of
  // minutes that turns the rest of the app on.
  const queue = useMemo(
    () => entries.filter(e => !e.rated).sort((a, b) => a.difficulty - b.difficulty).slice(0, 8),
    [entries]
  );

  // And once you have said what you cannot play, what to do about it. The two
  // lists hand off to each other: the quick pass shrinks as chords are rated,
  // and this one fills with what the rating turned up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const next = useMemo(() => nextChords(6).filter(c => !hidden.has(c.key)).slice(0, 4), [songs, skills, hidden]);

  // ---- Removing a chord ----------------------------------------------------
  // A chord only you added is just forgotten. One a song asks for gets a
  // question, out of the song, or just out of sight, because the right
  // answer depends on whether the song's line was wrong. Either way there is
  // an Undo for a few seconds, rather than a confirm in front of every press.
  // Where the chord comes from, split the way removing it has to be: a chord
  // line can be edited from here, a written chart cannot.
  const [removing, setRemoving] = useState<{ entry: Entry; lines: string[]; charts: string[] } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: () => Promise<void> | void } | null>(null);
  const closeSheet = useCallback(() => setRemoving(null), []);
  useBackToClose(removing !== null, closeSheet);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Everything forgetting a rating loses, so Undo can give it back.
  const forgetWithUndo = async (entry: Entry) => {
    const prev = skillFor(entry.key);
    await forgetChord(entry.key);
    return async () => {
      if (!prev) return;
      await setComfort(prev.label ?? entry.symbol, prev.comfort);
      if (prev.voicingId) await setPreferredVoicing(prev.label ?? entry.symbol, prev.voicingId);
    };
  };

  const startRemove = async (entry: Entry) => {
    if (entry.songs.length > 0) {
      setRemoving({
        entry,
        lines: songsWithChord(entry.key).map(song => song.title),
        charts: chartsWithChord(entry.key).map(song => song.title)
      });
      return;
    }
    const undo = await forgetWithUndo(entry);
    setToast({ text: `Removed ${entry.symbol}`, undo });
  };

  const removeFromSongLines = async (entry: Entry, lineCount: number) => {
    setRemoving(null);
    const undoSongs = await removeFromSongs(entry.key);
    const undoRating = await forgetWithUndo(entry);
    // A written chart that uses it isn't edited from here, so it would come
    // straight back from there; hide it so the press does what it said.
    const stillCharted = chartsWithChord(entry.key).length > 0;
    if (stillCharted) hideChord(entry.key);
    const n = lineCount;
    setToast({
      text: `Removed ${entry.symbol} from ${n} song${n === 1 ? '' : 's'}${stillCharted ? ' (hidden: still in a chart)' : ''}`,
      undo: async () => { await undoSongs(); await undoRating(); if (stillCharted) unhideChord(entry.key); }
    });
  };

  const hideFromBook = (entry: Entry) => {
    setRemoving(null);
    hideChord(entry.key);
    setToast({ text: `Hid ${entry.symbol}`, undo: () => unhideChord(entry.key) });
  };

  const addChord = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = normalizeChordSymbol(adding);
    if (!symbol) return;
    // Added as "not yet" rather than as solid: putting it in the book is
    // saying you have met it, not that you have it.
    if (!skills.some(s => s.id === chordKey(symbol))) await setComfort(symbol, 'none');
    setAdding('');
    setView('songs');
    setQuery(symbol);
    setFilter('all');
  };

  // Ticked by canonical key, so B flat and A sharp are the one chord here as
  // they are everywhere else in the book.
  const pickedKeys = useMemo(() => new Set(picked.map(slot => chordKey(slot.symbol))), [picked]);
  const isPicked = (symbol: string) => pickedKeys.has(chordKey(symbol));

  // A tick is set membership, so unticking takes the chord out wherever it
  // sits. A progression that wants the same chord twice is written in the
  // panel, where there is a sequence to write it on; a checkbox cannot say
  // "twice" and should not pretend to.
  const toggle = (symbol: string) => setPicked(prev => {
    const key = chordKey(symbol);
    return prev.some(slot => chordKey(slot.symbol) === key)
      ? prev.filter(slot => chordKey(slot.symbol) !== key)
      : [...prev, makeSlot(symbol)];
  });

  // The bucket's button is the page's transport: down among the chords it is
  // the only one in reach, so it starts and stops the loop rather than going
  // to find the panel that can. The panel reports back where it has got to,
  // which is what tells the button whether to offer play or stop.
  const [order, setOrder] = useState<TransportOrder | null>(null);
  const [phase, setPhase] = useState<ChartPhase>('idle');
  const tell = (action: 'start' | 'stop') =>
    setOrder(prev => ({ id: (prev?.id ?? 0) + 1, action }));

  // Quick play sits at the top of a page that is several screens long, so
  // showing it has to bring it into view as well. Counted rather than
  // watched, so it fires again on a second showing.
  const panel = useRef<HTMLDivElement>(null);
  const [calls, setCalls] = useState(0);
  useEffect(() => {
    if (calls > 0) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [calls]);
  const show = () => {
    setOpen(true);
    setCalls(n => n + 1);
  };

  // Shutting the panel takes the standing order with it. The panel is where
  // the transport lives, so closing it stops the loop, and an order left
  // lying about would be obeyed by the next panel the moment it opened.
  const close = () => {
    setOpen(false);
    setOrder(null);
  };

  // Pressing play from the bucket opens the panel if it was shut, what is
  // playing is worth seeing, but leaves you where you are if it was already
  // open, because being yanked to the top of the page is not what pressing
  // play asked for.
  const play = () => {
    if (!open) show();
    tell('start');
  };

  // A suggestion you can act on in one press. Quick play opens on the drill
  // whether or not it was already open, because pressing Drill is a decision
  // about what to practise next and nothing else in the panel is.
  const drill = (chord: NextChord) => {
    setPicked(drillSlots(chord));
    show();
  };

  /**
   * A loop sent here from somewhere else, the palette, or today's run.
   *
   * Taken twice over, because there are two ways one can arrive. Sent from
   * another screen it is left waiting and the navigation brings us here, so
   * the pickup has to happen on mount; sent from this page it arrives as an
   * event while we are already standing here. Taking is destructive, so
   * whichever gets there first is the only one that finds anything.
   */
  const [preset, setPreset] = useState<Handoff | null>(null);
  const accept = useCallback(() => {
    const loop = takeLoop();
    if (!loop) return;
    setPicked(loop.slots);
    setPreset(loop);
    setOpen(true);
    setCalls(n => n + 1);
  }, []);
  useEffect(() => {
    accept();
    return onHandoff(accept);
  }, [accept]);

  if (!ready) return <div className="songs-loading readout">Opening your chord book…</div>;

  return (
    <div className="chordbook">
      <header className="songs-head">
        <div>
          <h2 className="lab-title"><LabIcon tab="chordbook" />Chords</h2>
          <p className="songs-count readout">
            <strong>{String(counts.solid).padStart(2, '0')}</strong> / {entries.length}
            {entries.length > 0 && (
              <span className="tallybar is-wide" aria-hidden="true">
                <span className="tallybar-seg is-solid" style={{ flexGrow: counts.solid }} />
                <span className="tallybar-seg is-shaky" style={{ flexGrow: counts.shaky }} />
                <span className="tallybar-seg is-none" style={{ flexGrow: counts.none + counts.unrated }} />
              </span>
            )}
            <span className="songs-count-sub">
              {[
                counts.shaky > 0 && `${counts.shaky} shaky`,
                counts.none > 0 && `${counts.none} not yet`,
                counts.unrated > 0 && `${counts.unrated} unrated`
              ].filter(Boolean).join(' · ') || 'all marked'}
            </span>
          </p>
        </div>
        <div className="chordbook-actions">
          <button
            type="button"
            className={`btn${open ? '' : ' btn-primary'}`}
            onClick={() => (open ? close() : show())}
            aria-pressed={open}
            title={open ? 'Close quick play' : undefined}
          >
            Quick play
          </button>
        </div>
        <form className="chordbook-add" onSubmit={addChord}>
          <input
            className="text-field"
            value={adding}
            onChange={e => setAdding(e.target.value)}
            placeholder="Add a chord"
            aria-label="Add a chord by name"
          />
          <button type="submit" className="btn" disabled={!adding.trim()}>Add</button>
        </form>
      </header>

      <div ref={panel} className="chordbook-panel">
        {open && (
          <QuickPlay
            slots={picked}
            preset={preset}
            onChange={setPicked}
            onClose={close}
            order={order}
            onPhase={setPhase}
          />
        )}
      </div>

      <div className="chordbook-views">
        <Segmented<View> value={view} onChange={setView} options={VIEWS} ariaLabel="Which chords" />
      </div>

      {view === 'all' && <ChordCatalogue isPicked={isPicked} onToggle={toggle} />}

      {view === 'songs' && queue.length > 0 && (
        <section className="song-panel chordbook-queue">
          <div className="surface-label">
            <span>Quick pass</span>
            <span className="readout">{counts.unrated} left · easiest first</span>
          </div>
          <div className="chordcards">
            {queue.map(e => (
              <ChordCard key={e.symbol} symbol={e.symbol} markable picked={isPicked(e.symbol)} onToggle={toggle} />
            ))}
          </div>
        </section>
      )}

      {view === 'songs' && next.length > 0 && (
        <section className="song-panel chordbook-next">
          <div className="surface-label">
            <span>Learn next</span>
            <span className="readout">closest to a song first</span>
          </div>
          <div className="chordcards">
            {next.map(chord => (
              <ChordCard
                key={chord.key}
                symbol={chord.symbol}
                markable
                picked={isPicked(chord.symbol)}
                onToggle={toggle}
                meta={reasonFor(chord)}
                footer={
                  <button
                    type="button"
                    className="btn chordcard-drill"
                    onClick={() => drill(chord)}
                    title={
                      chord.partners.length > 0
                        ? `Loop ${chord.symbol} against ${chord.partners.join(' and ')}`
                        : `Loop ${chord.symbol}`
                    }
                  >
                    Drill
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      {view === 'songs' && (
        <>
      <div className="chordbook-filters">
        <Segmented<Filter> value={filter} onChange={setFilter} options={FILTERS} ariaLabel="Filter chords" size="sm" />
        <input
          className="text-field"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find a chord"
          aria-label="Find a chord"
        />
      </div>

      {shown.length === 0 ? (
        <p className="song-empty">
          {entries.length === 0
            ? 'No chords yet. Add a song with chords.'
            : `Nothing ${filter === 'unrated' ? 'unrated' : COMFORT_LABEL[filter as ChordComfort]?.toLowerCase() ?? ''} here.`}
        </p>
      ) : (
        <div className="chordcards chordcards-book">
          {shown.map(e => (
            <ChordCard
              key={e.symbol}
              symbol={e.symbol}
              markable
              shapes
              scale={0.66}
              picked={isPicked(e.symbol)}
              onToggle={toggle}
              meta={e.songs.length > 0 ? `${e.songs.length} song${e.songs.length === 1 ? '' : 's'}` : 'added by you'}
              metaTitle={e.songs.length > 0 ? e.songs.join(' · ') : undefined}
              onRemove={() => void startRemove(e)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {view === 'songs' && hidden.size > 0 && (
        <p className="chordbook-hidden">
          {hidden.size} hidden chord{hidden.size === 1 ? '' : 's'} ·{' '}
          <button type="button" className="linklike" onClick={unhideAll}>show {hidden.size === 1 ? 'it' : 'them'}</button>
        </p>
      )}

      {/* Portaled: inside the page they sat under the phone's tab bar, since
          the lab's own stacking layer caps how high a z-index can reach. */}
      {removing && createPortal(
        <div className="msheet-backdrop is-dialog" onClick={closeSheet}>
          <div className="msheet" role="dialog" aria-modal="true" aria-label={`Remove ${removing.entry.symbol}`} onClick={e => e.stopPropagation()}>
            <h3 className="removesheet-title">Remove {removing.entry.symbol}?</h3>
            {removing.lines.length > 0 && (
              <p className="removesheet-said">
                In the chord line of <strong>{removing.lines.join(', ')}</strong>.
              </p>
            )}
            {removing.charts.length > 0 && (
              <p className="removesheet-said">
                In the chart of <strong>{removing.charts.join(', ')}</strong>. Edit the chart on the song page to remove it there.
              </p>
            )}
            <div className="removesheet-actions">
              {removing.lines.length > 0 && (
                <>
                  <button type="button" className="btn auth-delete-btn" onClick={() => void removeFromSongLines(removing.entry, removing.lines.length)}>
                    Remove it from {removing.lines.length === 1 ? 'that chord line' : `those ${removing.lines.length} chord lines`}
                  </button>
                  <p className="removesheet-hint">Use this for typos or notes misread as chords.</p>
                </>
              )}
              <button type="button" className="btn" onClick={() => hideFromBook(removing.entry)}>Just hide it here</button>
              <p className="removesheet-hint">The songs keep it.</p>
              <button type="button" className="btn removesheet-cancel" onClick={closeSheet}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div className="undo-toast" role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={() => { const { undo } = toast; setToast(null); void undo(); }}>Undo</button>
        </div>,
        document.body
      )}

      {/* Last in the page, so it pins to the bottom of the window for as long
          as there is chord book above it and then comes to rest at the end. */}
      {picked.length > 0 && (
        <ChordBucket
          slots={picked}
          running={open && phase !== 'idle' && phase !== 'done'}
          onRemove={id => setPicked(prev => prev.filter(slot => slot.id !== id))}
          onClear={() => setPicked([])}
          onPlay={play}
          onStop={() => tell('stop')}
        />
      )}
    </div>
  );
};

export default ChordBookLab;
