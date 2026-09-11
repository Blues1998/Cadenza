import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordBucket } from '../components/ChordBucket';
import { ChordCard } from '../components/ChordCard';
import { ChordCatalogue } from '../components/ChordCatalogue';
import { QuickPlay } from '../components/QuickPlay';
import { makeSlot, type Slot } from '../utils/loop';
import { Segmented } from '../components/Segmented';
import { useLibrary } from '../hooks/useLibrary';
import { getSongs, songChords } from '../utils/library';
import { timeChart } from '../utils/chart';
import {
  COMFORT_LABEL,
  chordKey,
  comfortOf,
  getChordSkills,
  setComfort,
  voicingsFor,
  type ChordComfort
} from '../utils/chordbook';
import { drillSlots, nextChords, reasonFor, type NextChord } from '../utils/next';
import { normalizeChordSymbol } from '../utils/songText';

type View = 'songs' | 'all';

const VIEWS: { value: View; label: string }[] = [
  { value: 'songs', label: 'In your songs' },
  { value: 'all', label: 'All chords' }
];

type Filter = 'all' | ChordComfort | 'unrated';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'solid', label: 'Solid' },
  { value: 'shaky', label: 'Shaky' },
  { value: 'none', label: 'Not yet' },
  { value: 'unrated', label: 'Unrated' }
];

interface Entry {
  /** The canonical key, and what the cards show. */
  symbol: string;
  /** Songs in the library that ask for this chord. */
  songs: string[];
  comfort: ChordComfort;
  rated: boolean;
  /** How hard the easiest shape is — the order to meet them in. */
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

  const entries = useMemo<Entry[]>(() => {
    // Keyed canonically so B flat and A sharp are one chord, but shown with
    // the spelling the songs themselves used — the book is filed by pitch and
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
      .map(([key, { display, titles }]) => ({
        symbol: display,
        songs: [...titles].sort(),
        comfort: comfortOf(key),
        rated: skills.some(s => s.id === key),
        difficulty: voicingsFor(key)[0]?.difficulty ?? 99
      }))
      // Most-used first, then easiest: the order that gets the most songs
      // unlocked for the least work.
      .sort((a, b) => b.songs.length - a.songs.length || a.difficulty - b.difficulty || a.symbol.localeCompare(b.symbol));
  }, [songs, skills]);

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
  const next = useMemo(() => nextChords(4), [songs, skills]);

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

  // Quick play sits at the top of a page that is several screens long, so
  // opening it from the bucket has to bring it into view as well. Counted
  // rather than watched, so pressing again when it is already open still
  // takes you there.
  const panel = useRef<HTMLDivElement>(null);
  const [calls, setCalls] = useState(0);
  useEffect(() => {
    if (calls > 0) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [calls]);
  const play = () => {
    setOpen(true);
    setCalls(n => n + 1);
  };

  // A suggestion you can act on in one press. Quick play opens on the drill
  // whether or not it was already open, because pressing Drill is a decision
  // about what to practise next and nothing else in the panel is.
  const drill = (chord: NextChord) => {
    setPicked(drillSlots(chord));
    play();
  };

  if (!ready) return <div className="songs-loading readout">Opening your chord book…</div>;

  return (
    <div className="chordbook">
      <header className="songs-head">
        <div>
          <h2 className="lab-title">Chords</h2>
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
            onClick={() => setOpen(o => !o)}
            aria-pressed={open}
          >
            {open ? 'Close quick play' : 'Quick play'}
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
          <QuickPlay slots={picked} onChange={setPicked} onClose={() => setOpen(false)} />
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
            ? 'No chords yet. They appear here as soon as a song records some.'
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
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Last in the page, so it pins to the bottom of the window for as long
          as there is chord book above it and then comes to rest at the end. */}
      {picked.length > 0 && (
        <ChordBucket
          slots={picked}
          open={open}
          onRemove={id => setPicked(prev => prev.filter(slot => slot.id !== id))}
          onClear={() => setPicked([])}
          onPlay={play}
        />
      )}
    </div>
  );
};

export default ChordBookLab;
