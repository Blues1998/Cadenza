import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { Segmented } from './Segmented';
import { IconPause, IconPlay, IconStop } from './Icons';
import { getVoicings } from '../utils/chords';
import { chordShape } from '../utils/songText';
import { songChords, updateSong } from '../utils/library';
import type { Song } from '../utils/library';
import { useChartTransport } from '../hooks/useChartTransport';
import {
  chartDuration,
  chordsAtBeat,
  convertAboveLine,
  DEFAULT_CHART,
  defaultBars,
  extractMeta,
  lineAtBeat,
  linesFromText,
  looksLikeAboveLine,
  newLineId,
  stripHeaders,
  timeChart,
  TEMPO_MAX,
  TEMPO_MIN,
  transposeSymbol
} from '../utils/chart';
import type { ChartLine, ChartLineRecord, ChartWord, ParsedChart } from '../utils/chart';

interface SongChartPanelProps {
  song: Song;
}

type Mode = 'play' | 'edit' | 'import';

const BEATS_PER_BAR = [3, 4, 6];

/** The shape for a chord symbol, or null when we cannot place it on a neck. */
const useVoicing = (symbol: string | null) =>
  useMemo(() => {
    if (!symbol) return null;
    const shape = chordShape(symbol);
    if (!shape) return null;
    return getVoicings(shape.rootPc, shape.typeId, shape.rootName)[0] ?? null;
  }, [symbol]);

/**
 * The words and the chord changes, in time.
 *
 * Three things one panel has to do, so three modes rather than one crowded one:
 * take a sheet in from wherever it was found, let every chord and every word be
 * changed by pressing it, and play the result against a click.
 *
 * The editing surface is the sheet itself. An earlier version of this was a
 * textarea of bracket notation — a fine storage format and a miserable thing to
 * fix one chord in.
 */
export const SongChartPanel: React.FC<SongChartPanelProps> = ({ song }) => {
  const stored = song.chart;
  const settings = {
    tempo: stored?.tempo ?? DEFAULT_CHART.tempo,
    beatsPerBar: stored?.beatsPerBar ?? DEFAULT_CHART.beatsPerBar,
    countInBars: stored?.countInBars ?? DEFAULT_CHART.countInBars
  };
  const lines = useMemo(() => stored?.lines ?? [], [stored]);
  const transpose = stored?.transpose ?? 0;
  // Minus the capo is the shift that turns a sheet written at sounding pitch
  // into the shapes the hands are making.
  const capoShift = song.capo ? -song.capo : 0;

  const [mode, setMode] = useState<Mode>(lines.length === 0 ? 'import' : 'play');
  const [playChords, setPlayChords] = useState(false);

  const chart = useMemo(
    () => timeChart(lines, settings.beatsPerBar, transpose),
    [lines, settings.beatsPerBar, transpose]
  );

  const { phase, beat, start, stop, pause, resume, countInBeats } = useChartTransport(chart, settings, { playChords });
  // Three readings of one phase. `moving` is the clock actually running;
  // `running` is a run in progress, paused or not, and is what locks the tempo
  // and metre; `holding` is a position worth showing, which a pause keeps.
  const moving = phase === 'countin' || phase === 'playing';
  const running = moving || phase === 'paused';
  const holding = phase === 'playing' || phase === 'paused';
  // Pausing during the count-in should hold the count, not blank it.
  const counting = phase === 'countin' || (phase === 'paused' && beat < 0);

  const currentLine = holding ? lineAtBeat(chart, beat) : null;
  const { current, next } = holding
    ? chordsAtBeat(chart, beat)
    : { current: null, next: chart.lines[0]?.chords[0] ?? null };
  const currentVoicing = useVoicing(current?.symbol ?? null);
  const nextVoicing = useVoicing(next?.symbol ?? null);

  const patch = (next: Partial<NonNullable<Song['chart']>>) =>
    void updateSong(song.id, { chart: { lines, ...settings, transpose, ...next } });

  // Everything the editor shows is in the key on screen, so a chord typed while
  // the capo lens is on is stored shifted back. Editing what you can see is the
  // whole point of the lens; storing what was typed would silently disagree.
  const toDisplay = (symbol: string) => transposeSymbol(symbol, transpose);
  const toStored = (symbol: string) => transposeSymbol(symbol, -transpose);

  // Keep the line being sung in the middle of the panel's own scroller rather
  // than moving the page under you.
  //
  // Measured between the two rectangles, not from offsetTop. offsetTop is the
  // distance to the nearest *positioned* ancestor, and a scroller is not one
  // unless it says so — so it was reporting the panel's distance down the page,
  // several times the scroller's own height, and the first line of every song
  // scrolled the sheet straight to the bottom.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!running || !currentLine) return;
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${currentLine.index}"]`);
    if (!el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    // Negative for the opening lines, which scrollTo clamps to 0: nothing to
    // centre onto until the song is deep enough to have something above it.
    box.scrollTo({ top: top - box.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
  }, [running, currentLine]);

  // Tap tempo: the interval between the last few taps, which is how you find a
  // song's tempo when all you have is the song.
  const taps = useRef<number[]>([]);
  const tapTempo = () => {
    const now = performance.now();
    const kept = [...taps.current, now].filter(t => now - t < 3000).slice(-5);
    taps.current = kept;
    if (kept.length < 2) return;
    const gaps = kept.slice(1).map((t, i) => t - kept[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const bpm = Math.round(60000 / mean);
    if (bpm >= TEMPO_MIN && bpm <= TEMPO_MAX) patch({ tempo: bpm });
  };

  const modes: { value: Mode; label: string }[] = [
    { value: 'play', label: 'Play' },
    { value: 'edit', label: 'Edit' },
    { value: 'import', label: 'Import' }
  ];

  return (
    <section className="song-panel chart-panel">
      <div className="surface-label">
        <span>Chart</span>
        {lines.length > 0 && (
          <span className="readout">
            {chart.lines.length} lines · {chart.chords.length} chords · {chartDuration(chart.totalBeats, settings.tempo)}
          </span>
        )}
        <span className="chart-modes">
          <Segmented<Mode>
            value={mode}
            onChange={m => { if (running) stop(); setMode(m); }}
            options={modes}
            ariaLabel="Chart mode"
            size="sm"
          />
        </span>
      </div>

      {mode === 'import' && (
        <ChartImport
          song={song}
          hasChart={lines.length > 0}
          beatsPerBar={settings.beatsPerBar}
          onApply={(next, append, meta) => {
            const merged = append ? [...lines, ...next] : next;
            void updateSong(song.id, {
              chart: { lines: merged, ...settings, transpose, ...(meta.tempo ? { tempo: meta.tempo } : {}) },
              ...(meta.capo !== undefined ? { capo: meta.capo } : {}),
              ...(meta.key ? { key: meta.key } : {})
            });
            setMode('edit');
          }}
        />
      )}

      {mode !== 'import' && lines.length === 0 && (
        <p className="song-empty">Nothing here yet. Import a sheet, or add lines by hand in Edit.</p>
      )}

      {mode === 'play' && lines.length > 0 && (
        <>
          <div className="chart-transport">
            <div className="transport">
              <button
                type="button"
                className={`transport-btn is-main${moving ? ' is-moving' : ''}${phase === 'paused' ? ' is-held' : ''}`}
                onClick={moving ? pause : phase === 'paused' ? resume : start}
                aria-label={moving ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'done' ? 'Play again' : 'Play along'}
                title={moving ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'done' ? 'Play again' : 'Play along'}
              >
                {/* Both icons live in the button and trade places, so the
                    change is a movement rather than a swap. */}
                <span className="transport-icons" aria-hidden="true">
                  <IconPlay size={18} className="transport-play" fill="currentColor" strokeWidth={1.5} />
                  <IconPause size={18} className="transport-pause" fill="currentColor" strokeWidth={1} />
                </span>
                {/* One ring per beat, keyed so it starts again on each. */}
                {moving && <span key={beat} className="transport-beat" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="transport-btn is-stop"
                onClick={stop}
                disabled={!running && phase !== 'done'}
                aria-label="Stop"
                title="Stop"
              >
                <IconStop size={15} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <label className="chart-tempo">
              <span className="field-label">Tempo</span>
              <input
                type="range"
                min={TEMPO_MIN}
                max={TEMPO_MAX}
                step={1}
                value={settings.tempo}
                disabled={running}
                onChange={e => patch({ tempo: Number(e.target.value) })}
                aria-label="Tempo in beats per minute"
              />
            </label>
            <span className="chart-bpm readout">{settings.tempo}<span> bpm</span></span>
            <button type="button" className="btn chart-tap" onClick={tapTempo} disabled={running}>Tap</button>

            <label className="chart-signature">
              <span className="field-label">Beats/bar</span>
              <select
                className="select-field"
                value={settings.beatsPerBar}
                disabled={running}
                onChange={e => patch({ beatsPerBar: Number(e.target.value) })}
              >
                {BEATS_PER_BAR.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label className="chart-toggle">
              <input type="checkbox" checked={playChords} onChange={e => setPlayChords(e.target.checked)} />
              Sound the chords
            </label>
          </div>

          <div className="chart-now">
            <div className={`chart-chord-now${holding ? ' is-live' : ''}`}>
              <span className="surface-label">{counting ? 'Count in' : 'Now'}</span>
              {counting ? (
                <span className="chart-countin readout">{countInBeats + beat + 1}</span>
              ) : (
                <>
                  <span className="chart-chord-name">{current?.symbol ?? '—'}</span>
                  {currentVoicing && <ChordDiagram frets={currentVoicing.frets} fingers={currentVoicing.fingers} scale={0.58} />}
                </>
              )}
            </div>
            <div className="chart-chord-next">
              <span className="surface-label">Next</span>
              <span className="chart-chord-name">{next?.symbol ?? '—'}</span>
              {nextVoicing && <ChordDiagram frets={nextVoicing.frets} fingers={nextVoicing.fingers} scale={0.5} />}
            </div>
            <div className="chart-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(1, beat / Math.max(1, chart.totalBeats))) * 100}%` }} />
            </div>
          </div>

          <div className="chart-lines" ref={scroller}>
            {chart.lines.map(line => (
              <SheetLine
                key={line.id}
                line={line}
                chart={chart}
                isNow={currentLine?.index === line.index}
                live={holding ? current : null}
                beatsPerBar={settings.beatsPerBar}
              />
            ))}
          </div>
        </>
      )}

      {mode === 'edit' && (
        <ChartEditor
          lines={lines}
          chart={chart}
          beatsPerBar={settings.beatsPerBar}
          transpose={transpose}
          capo={song.capo}
          capoShift={capoShift}
          suggestions={[...new Set([...chart.chords, ...songChords(song).map(toDisplay)])]}
          onTranspose={t => patch({ transpose: t })}
          onChange={next => patch({ lines: next })}
          toDisplay={toDisplay}
          toStored={toStored}
        />
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// One line of the sheet, read-only
// ---------------------------------------------------------------------------

const SheetLine: React.FC<{
  line: ChartLine;
  chart: ParsedChart;
  isNow: boolean;
  live: { beat: number } | null;
  beatsPerBar: number;
}> = ({ line, chart, isNow, live, beatsPerBar }) => {
  const showSection = line.section && (line.index === 0 || chart.lines[line.index - 1].section !== line.section);
  let cursor = 0;
  return (
    <>
      {showSection && <p className="chart-section">{line.section}</p>}
      <p className={`chart-line${isNow ? ' is-now' : ''}${line.instrumental ? ' is-instrumental' : ''}`} data-line={line.index}>
        <span className="chart-bar-count readout">{line.beats / beatsPerBar}</span>
        {line.segments.map((seg, i) => {
          const chord = seg.chord ? line.chords[cursor++] : null;
          const isLive = live && chord && Math.abs(chord.beat - live.beat) < 1e-6;
          return (
            <span key={i} className="chart-seg">
              <span className={`chart-seg-chord readout${isLive ? ' is-live' : ''}`}>{seg.chord ?? ''}</span>
              <span className="chart-seg-text">{seg.text || (seg.chord ? ' ' : '')}</span>
            </span>
          );
        })}
      </p>
    </>
  );
};

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

interface EditorProps {
  lines: ChartLineRecord[];
  chart: ParsedChart;
  beatsPerBar: number;
  transpose: number;
  capo: number | null;
  capoShift: number;
  suggestions: string[];
  onTranspose: (t: number) => void;
  onChange: (lines: ChartLineRecord[]) => void;
  toDisplay: (symbol: string) => string;
  toStored: (symbol: string) => string;
}

const ChartEditor: React.FC<EditorProps> = ({
  lines, chart, beatsPerBar, transpose, capo, capoShift, suggestions,
  onTranspose, onChange, toDisplay, toStored
}) => {
  const [chordAt, setChordAt] = useState<{ lineId: string; wordIndex: number } | null>(null);
  const [lyricAt, setLyricAt] = useState<{ lineId: string; text: string } | null>(null);
  const [draftChord, setDraftChord] = useState('');

  const mapLine = (id: string, fn: (line: ChartLineRecord) => ChartLineRecord) =>
    onChange(lines.map(l => (l.id === id ? fn(l) : l)));

  const mapWords = (id: string, fn: (words: ChartWord[]) => ChartWord[]) =>
    mapLine(id, l => ({ ...l, words: fn(l.words ?? []) }));

  const openChord = (lineId: string, wordIndex: number) => {
    const word = lines.find(l => l.id === lineId)?.words?.[wordIndex];
    setDraftChord(word?.chord ? toDisplay(word.chord) : '');
    setChordAt({ lineId, wordIndex });
  };

  const commitChord = (symbol: string) => {
    if (!chordAt) return;
    const clean = symbol.trim();
    mapWords(chordAt.lineId, words =>
      words.map((w, i) => {
        if (i !== chordAt.wordIndex) return w;
        if (clean === '') {
          const { chord: _chord, beat: _beat, ...rest } = w;
          return rest;
        }
        return { ...w, chord: toStored(clean) };
      })
    );
    setChordAt(null);
  };

  /** The beat a chord currently falls on, relative to its own line. */
  const beatOf = (lineId: string, wordIndex: number): number => {
    const line = chart.lines.find(l => l.id === lineId);
    const chord = line?.chords.find(c => c.wordIndex === wordIndex);
    return chord && line ? chord.beat - line.startBeat : 0;
  };

  const nudge = (delta: number) => {
    if (!chordAt) return;
    const { lineId, wordIndex } = chordAt;
    const line = lines.find(l => l.id === lineId);
    const beats = (line?.bars ?? 1) * beatsPerBar;
    const at = Math.max(0, Math.min(beats - 0.5, beatOf(lineId, wordIndex) + delta));
    mapWords(lineId, words => words.map((w, i) => (i === wordIndex ? { ...w, beat: at } : w)));
  };

  /** Give a chord its share of the line back, instead of a beat of its own. */
  const evenOut = () => {
    if (!chordAt) return;
    mapWords(chordAt.lineId, words => words.map((w, i) => {
      if (i !== chordAt.wordIndex) return w;
      const { beat: _beat, ...rest } = w;
      return rest;
    }));
  };

  const setBars = (id: string, delta: number) =>
    mapLine(id, l => ({ ...l, bars: Math.max(1, (l.bars ?? defaultBars(l.words ?? [])) + delta) }));

  const move = (id: string, delta: number) => {
    const i = lines.findIndex(l => l.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const removeLine = (id: string) => onChange(lines.filter(l => l.id !== id));

  const addAfter = (id: string | null, kind: 'lyric' | 'section') => {
    const fresh: ChartLineRecord = kind === 'section'
      ? { id: newLineId(), kind: 'section', label: 'Section' }
      : { id: newLineId(), kind: 'lyric', words: [{ text: 'new line' }], bars: 1 };
    if (id === null) return onChange([...lines, fresh]);
    const i = lines.findIndex(l => l.id === id);
    onChange([...lines.slice(0, i + 1), fresh, ...lines.slice(i + 1)]);
  };

  /**
   * Re-splitting a line's words keeps the chords on the same word positions.
   *
   * Fixing a typo should not cost you the chords over it, and the word index is
   * the only anchor that survives the text changing underneath — a chord past
   * the new end moves to the last word rather than being dropped.
   */
  const commitLyric = () => {
    if (!lyricAt) return;
    const { lineId, text } = lyricAt;
    mapWords(lineId, words => {
      const pieces = text.split(/\s+/).filter(Boolean);
      if (pieces.length === 0) return words;
      const next: ChartWord[] = pieces.map(t => ({ text: t }));
      words.forEach((w, i) => {
        if (!w.chord) return;
        const at = Math.min(i, next.length - 1);
        next[at] = { ...next[at], chord: w.chord, ...(w.beat !== undefined ? { beat: w.beat } : {}) };
      });
      return next;
    });
    setLyricAt(null);
  };

  return (
    <div className="chart-editor">
      <div className="chart-key">
        <span className="chart-key-label">Showing</span>
        <button type="button" className="chart-step" onClick={() => onTranspose(transpose - 1)} aria-label="Down a semitone">−</button>
        <span className="chart-key-state readout">
          {transpose === 0 ? 'as written' : `${transpose > 0 ? '+' : ''}${transpose}`}
          {capoShift !== 0 && transpose === capoShift && <span> · capo {capo} shapes</span>}
        </span>
        <button type="button" className="chart-step" onClick={() => onTranspose(transpose + 1)} aria-label="Up a semitone">+</button>
        {capoShift !== 0 && transpose !== capoShift && (
          <button type="button" className="chart-key-preset" onClick={() => onTranspose(capoShift)}>
            Shapes for capo {capo}
          </button>
        )}
        {transpose !== 0 && (
          <button type="button" className="chart-key-preset" onClick={() => onTranspose(0)}>As written</button>
        )}
        <span className="chart-key-hint">Press a chord to change it, the words to retype them.</span>
      </div>

      <div className="chart-lines is-editing">
        {lines.map(line => {
          if (line.kind === 'section') {
            return (
              <div key={line.id} className="ed-row is-section">
                <input
                  className="text-field ed-section"
                  value={line.label ?? ''}
                  onChange={e => mapLine(line.id, l => ({ ...l, label: e.target.value }))}
                  aria-label="Section name"
                />
                <LineActions
                  onUp={() => move(line.id, -1)}
                  onDown={() => move(line.id, 1)}
                  onDelete={() => removeLine(line.id)}
                  onAdd={k => addAfter(line.id, k)}
                />
              </div>
            );
          }

          const words = line.words ?? [];
          const bars = line.bars ?? defaultBars(words);
          const openHere = chordAt?.lineId === line.id;

          return (
            <div key={line.id} className="ed-row">
              <div className="ed-bars" title="Bars this line lasts">
                <button type="button" className="chart-step" onClick={() => setBars(line.id, -1)} aria-label="One bar fewer">−</button>
                <span className="readout">{bars}</span>
                <button type="button" className="chart-step" onClick={() => setBars(line.id, 1)} aria-label="One bar more">+</button>
              </div>

              {lyricAt?.lineId === line.id ? (
                <input
                  className="text-field ed-lyric-input"
                  autoFocus
                  value={lyricAt.text}
                  onChange={e => setLyricAt({ lineId: line.id, text: e.target.value })}
                  onBlur={commitLyric}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitLyric();
                    if (e.key === 'Escape') setLyricAt(null);
                  }}
                  aria-label="Words for this line"
                />
              ) : (
                <div className="ed-words">
                  {words.map((w, i) => (
                    <span key={i} className="ed-word">
                      <button
                        type="button"
                        className={`ed-chord${w.chord ? ' has-chord' : ''}${openHere && chordAt?.wordIndex === i ? ' is-open' : ''}`}
                        onClick={() => openChord(line.id, i)}
                        title={w.chord ? `Change ${toDisplay(w.chord)}` : 'Put a chord here'}
                      >
                        {w.chord ? toDisplay(w.chord) : '+'}
                      </button>
                      <button
                        type="button"
                        className="ed-text"
                        onClick={() => setLyricAt({ lineId: line.id, text: words.map(x => x.text).join(' ').trim() })}
                      >
                        {w.text || '·'}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <LineActions
                onUp={() => move(line.id, -1)}
                onDown={() => move(line.id, 1)}
                onDelete={() => removeLine(line.id)}
                onAdd={k => addAfter(line.id, k)}
              />

              {openHere && chordAt && (
                <div className="ed-chordbox">
                  <input
                    className="text-field ed-chord-input readout"
                    autoFocus
                    value={draftChord}
                    placeholder="Am"
                    onChange={e => setDraftChord(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitChord(draftChord);
                      if (e.key === 'Escape') setChordAt(null);
                    }}
                    aria-label="Chord"
                  />
                  <button type="button" className="btn btn-primary ed-apply" onClick={() => commitChord(draftChord)}>Set</button>
                  <button type="button" className="btn" onClick={() => commitChord('')}>Clear</button>
                  <span className="ed-beat">
                    beat
                    <button type="button" className="chart-step" onClick={() => nudge(-0.5)} aria-label="Half a beat earlier">◀</button>
                    <span className="readout">{(beatOf(line.id, chordAt.wordIndex) + 1).toFixed(1)}</span>
                    <button type="button" className="chart-step" onClick={() => nudge(0.5)} aria-label="Half a beat later">▶</button>
                    <button type="button" className="chart-key-preset" onClick={evenOut}>Even</button>
                  </span>
                  {suggestions.length > 0 && (
                    <span className="ed-suggest">
                      {suggestions.slice(0, 10).map(s => (
                        <button key={s} type="button" className="chip-btn readout" onClick={() => commitChord(s)}>{s}</button>
                      ))}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ed-add">
        <button type="button" className="btn" onClick={() => addAfter(null, 'lyric')}>Add line</button>
        <button type="button" className="btn" onClick={() => addAfter(null, 'section')}>Add section</button>
      </div>
    </div>
  );
};

const LineActions: React.FC<{
  onUp: () => void; onDown: () => void; onDelete: () => void; onAdd: (kind: 'lyric' | 'section') => void;
}> = ({ onUp, onDown, onDelete, onAdd }) => (
  <span className="ed-actions">
    <button type="button" onClick={onUp} title="Move up" aria-label="Move line up">↑</button>
    <button type="button" onClick={onDown} title="Move down" aria-label="Move line down">↓</button>
    <button type="button" onClick={() => onAdd('lyric')} title="Add a line below" aria-label="Add a line below">+</button>
    <button type="button" onClick={onDelete} title="Delete this line" aria-label="Delete line">×</button>
  </span>
);

// ---------------------------------------------------------------------------
// Bringing a sheet in
// ---------------------------------------------------------------------------

const ChartImport: React.FC<{
  song: Song;
  hasChart: boolean;
  beatsPerBar: number;
  onApply: (lines: ChartLineRecord[], append: boolean, meta: { capo?: number; key?: string; tempo?: number }) => void;
}> = ({ song, hasChart, beatsPerBar, onApply }) => {
  const [text, setText] = useState('');
  const [takeMeta, setTakeMeta] = useState(true);

  const read = useMemo(() => {
    if (text.trim() === '') return null;
    const meta = extractMeta(text);
    const body = stripHeaders(text);
    const stacked = looksLikeAboveLine(body);
    const inline = stacked ? convertAboveLine(body) : body;
    return { meta, stacked, lines: linesFromText(inline, beatsPerBar) };
  }, [text, beatsPerBar]);

  const chordCount = read?.lines.reduce((n, l) => n + (l.words ?? []).filter(w => w.chord).length, 0) ?? 0;
  const found: string[] = [];
  if (read?.meta.capo !== undefined) found.push(read.meta.capo === 0 ? 'no capo' : `capo ${read.meta.capo}`);
  if (read?.meta.key) found.push(`key ${read.meta.key}`);
  if (read?.meta.tempo) found.push(`${read.meta.tempo} bpm`);

  return (
    <div className="chart-import">
      <p className="chart-help">
        Paste a sheet from anywhere — chords above the words or written into them, both work.
        Section markers, and a capo, key or tempo in the header, are picked up too. Nothing is
        applied until you press a button below.
      </p>
      <textarea
        className="text-field chart-source"
        rows={12}
        spellCheck={false}
        placeholder={'Verse:\nAm            F\nLa la la la la la'}
        value={text}
        onChange={e => setText(e.target.value)}
      />

      {read && (
        <div className="import-read">
          <span className="import-count readout">
            {read.lines.filter(l => l.kind === 'lyric').length} lines · {chordCount} chords
          </span>
          <span className="import-format">{read.stacked ? 'chords above the words' : 'chords written in'}</span>
          {found.length > 0 && (
            <label className="chart-toggle import-meta">
              <input type="checkbox" checked={takeMeta} onChange={e => setTakeMeta(e.target.checked)} />
              Also take {found.join(' · ')}
              {song.capo !== null && read.meta.capo !== undefined && read.meta.capo !== song.capo && (
                <span className="import-warn"> — the song currently says capo {song.capo}</span>
              )}
            </label>
          )}
        </div>
      )}

      <div className="chart-edit-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!read || read.lines.length === 0}
          onClick={() => read && onApply(read.lines, false, takeMeta ? read.meta : {})}
        >
          {hasChart ? 'Replace the chart' : 'Use this'}
        </button>
        {hasChart && (
          <button
            type="button"
            className="btn"
            disabled={!read || read.lines.length === 0}
            onClick={() => read && onApply(read.lines, true, takeMeta ? read.meta : {})}
          >
            Add to the end
          </button>
        )}
        {text !== '' && <button type="button" className="btn" onClick={() => setText('')}>Clear</button>}
      </div>
    </div>
  );
};

export default SongChartPanel;
