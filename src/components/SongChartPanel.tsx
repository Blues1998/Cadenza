import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { getVoicings } from '../utils/chords';
import { chordShape } from '../utils/songText';
import { updateSong } from '../utils/library';
import type { Song } from '../utils/library';
import { useChartTransport } from '../hooks/useChartTransport';
import {
  chartDuration,
  chordsAtBeat,
  DEFAULT_CHART,
  lineAtBeat,
  parseChart,
  TEMPO_MAX,
  TEMPO_MIN
} from '../utils/chart';

interface SongChartPanelProps {
  song: Song;
}

// The format, said once, with nonsense words. Nothing in this app ships with
// anybody's lyrics in it — the words are yours and they are typed here.
const EXAMPLE = `Verse:
[Am]La la la la [F]la la
[C]La la la la [G]la

Chorus:
[Am]La la | [F]la [C]la | [G]la`;

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
 * A chord list tells you what to play; it cannot tell you when to change, which
 * is the part that actually breaks a song. This runs the chart against a click
 * so the change arrives when it arrives, shows you the shape you are about to
 * need before you need it, and slows down to whatever tempo you can hold.
 */
export const SongChartPanel: React.FC<SongChartPanelProps> = ({ song }) => {
  const stored = song.chart;
  const settings = {
    tempo: stored?.tempo ?? DEFAULT_CHART.tempo,
    beatsPerBar: stored?.beatsPerBar ?? DEFAULT_CHART.beatsPerBar,
    countInBars: stored?.countInBars ?? DEFAULT_CHART.countInBars
  };
  const source = stored?.source ?? '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  const [playChords, setPlayChords] = useState(false);

  const chart = useMemo(() => parseChart(source, settings.beatsPerBar), [source, settings.beatsPerBar]);
  const preview = useMemo(() => parseChart(draft, settings.beatsPerBar), [draft, settings.beatsPerBar]);

  const { phase, beat, start, stop, countInBeats } = useChartTransport(chart, settings, { playChords });
  const running = phase === 'countin' || phase === 'playing';

  const currentLine = phase === 'playing' ? lineAtBeat(chart, beat) : null;
  const { current, next } = phase === 'playing'
    ? chordsAtBeat(chart, beat)
    : { current: null, next: chart.lines[0]?.chords[0] ?? null };
  const currentVoicing = useVoicing(current?.symbol ?? null);
  const nextVoicing = useVoicing(next?.symbol ?? null);

  const save = (patch: Partial<{ source: string; tempo: number; beatsPerBar: number; countInBars: number }>) =>
    void updateSong(song.id, { chart: { source, ...settings, ...patch } });

  // Keep the line being sung in the middle of the panel's own scroller rather
  // than moving the page under you — the transport and the chord you are about
  // to need have to stay put while the words move.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!running || !currentLine) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-line="${currentLine.index}"]`);
    const box = scroller.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
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
    if (bpm >= TEMPO_MIN && bpm <= TEMPO_MAX) save({ tempo: bpm });
  };

  if (editing) {
    return (
      <section className="song-panel chart-panel">
        <div className="surface-label">
          <span>Chart</span>
          <span className="readout">{preview.lines.length} lines · {preview.chordCount} changes</span>
        </div>
        <p className="chart-help">
          Put the chord in brackets right before the syllable it lands on. One chord holds one
          bar; add <code>|</code> bar lines when a bar has more than one. A line ending in a
          colon is a heading.
        </p>
        <textarea
          className="text-field chart-source"
          rows={12}
          spellCheck={false}
          placeholder={EXAMPLE}
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="chart-edit-actions">
          <button type="button" className="btn btn-primary" onClick={() => { save({ source: draft }); setEditing(false); }}>
            Save chart
          </button>
          <button type="button" className="btn" onClick={() => { setDraft(source); setEditing(false); }}>Cancel</button>
          {draft.trim() === '' && (
            <button type="button" className="btn chart-example" onClick={() => setDraft(EXAMPLE)}>Paste the example</button>
          )}
        </div>
      </section>
    );
  }

  if (chart.lines.length === 0) {
    return (
      <section className="song-panel chart-panel">
        <div className="surface-label"><span>Chart</span></div>
        <p className="song-empty">
          No chart yet. Write the words with the chord changes in them and this will play them
          in time, at whatever tempo you can hold.
        </p>
        <button type="button" className="btn btn-primary chart-start" onClick={() => { setDraft(source); setEditing(true); }}>
          Write the chart
        </button>
      </section>
    );
  }

  return (
    <section className="song-panel chart-panel">
      <div className="surface-label">
        <span>Chart</span>
        <span className="readout">
          {chart.lines.length} lines · {chart.chords.length} chords · {chartDuration(chart.totalBeats, settings.tempo)}
        </span>
        <button type="button" className="chart-edit" onClick={() => { setDraft(source); setEditing(true); }}>Edit</button>
      </div>

      <div className="chart-transport">
        <button type="button" className={`btn ${running ? 'btn-secondary' : 'btn-primary'}`} onClick={running ? stop : start}>
          {running ? 'Stop' : phase === 'done' ? 'Again' : 'Play along'}
        </button>

        <label className="chart-tempo">
          <span className="field-label">Tempo</span>
          <input
            type="range"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step={1}
            value={settings.tempo}
            disabled={running}
            onChange={e => save({ tempo: Number(e.target.value) })}
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
            onChange={e => save({ beatsPerBar: Number(e.target.value) })}
          >
            {BEATS_PER_BAR.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="chart-toggle">
          <input type="checkbox" checked={playChords} onChange={e => setPlayChords(e.target.checked)} />
          Sound the chords
        </label>
      </div>

      {/* What you are holding, and what is coming. The next shape is the one
          that matters — by the time the change lands it is too late to look. */}
      <div className="chart-now">
        <div className={`chart-chord-now${running ? ' is-live' : ''}`}>
          <span className="surface-label">{phase === 'countin' ? 'Count in' : 'Now'}</span>
          {phase === 'countin' ? (
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
          <span
            style={{ width: `${Math.max(0, Math.min(1, beat / Math.max(1, chart.totalBeats))) * 100}%` }}
          />
        </div>
      </div>

      <div className="chart-lines" ref={scroller}>
        {chart.lines.map(line => {
          const isNow = currentLine?.index === line.index;
          const showSection = line.section && (line.index === 0 || chart.lines[line.index - 1].section !== line.section);
          let chordCursor = 0;
          return (
            <React.Fragment key={line.index}>
              {showSection && <p className="chart-section">{line.section}</p>}
              <p className={`chart-line${isNow ? ' is-now' : ''}${line.instrumental ? ' is-instrumental' : ''}`} data-line={line.index}>
                <span className="chart-bar-count readout">{line.beats / settings.beatsPerBar}</span>
                {line.segments.map((seg, i) => {
                  const chord = seg.chord ? line.chords[chordCursor++] : null;
                  const live = running && chord && current && Math.abs(chord.beat - current.beat) < 1e-6;
                  return (
                    <span key={i} className="chart-seg">
                      <span className={`chart-seg-chord readout${live ? ' is-live' : ''}`}>{seg.chord ?? ''}</span>
                      <span className="chart-seg-text">{seg.text || (seg.chord ? ' ' : '')}</span>
                    </span>
                  );
                })}
              </p>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

export default SongChartPanel;
