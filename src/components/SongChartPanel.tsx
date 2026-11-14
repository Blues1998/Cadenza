import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChordDiagram } from './ChordDiagram';
import { StrumChip } from './StrumChip';
import { StrumGrid } from './StrumGrid';
import { IconPause, IconPlay, IconStop } from './Icons';
import { COMFORT_LABEL, comfortOf, preferredVoicing } from '../utils/chordbook';
import { songChords, songProgressions, updateSong } from '../utils/library';
import type { Song } from '../utils/library';
import { useChartTransport } from '../hooks/useChartTransport';
import { formatStrum, getPresetsForMeter, getTempoMarking, parseStrum, tokenize } from '../utils/strum';
import type { ChordVoicing } from '../utils/chords';
import {
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
  synthesizeChart,
  timeChart,
  TEMPO_MAX,
  TEMPO_MIN,
  transposeSymbol
} from '../utils/chart';
import type { ChartLine, ChartLineRecord, ChartWord, ParsedChart } from '../utils/chart';

export type ChartMode = 'play' | 'edit' | 'import';

interface SongChartPanelProps {
  song: Song;
  /** The Play tab is open. The panel stays mounted on other tabs so the song keeps playing. */
  visible: boolean;
  mode: ChartMode;
  onMode: (mode: ChartMode) => void;
  /** Where the player docks: the end of the page, so it sticks to the bottom of the screen. */
  dock: HTMLElement | null;
}

type Drawer = 'tempo' | 'strum' | null;

const TIME_SIGNATURE_OPTIONS = [
  { value: 4, label: '4/4', desc: 'Common' },
  { value: 3, label: '3/4', desc: 'Waltz' },
  { value: 2, label: '2/4', desc: 'March' },
  { value: 6, label: '6/8', desc: 'Compound' }
];

/** The shape for a chord symbol, or null when we cannot place it on a neck. */
const useVoicing = (symbol: string | null) =>
  useMemo(() => (symbol ? preferredVoicing(symbol) : null), [symbol]);

/**
 * The words and the chord changes, in time, and the player that runs them.
 *
 * The sheet is the page; tempo and strumming fold away behind two chips until
 * they are wanted. The player docks at the bottom of the screen: stopped it is
 * the one Play along button, playing it shows the shape to hold and the next.
 */
export const SongChartPanel: React.FC<SongChartPanelProps> = ({ song, visible, mode, onMode, dock }) => {
  const stored = song.chart;
  const settings = {
    tempo: stored?.tempo ?? DEFAULT_CHART.tempo,
    beatsPerBar: stored?.beatsPerBar ?? DEFAULT_CHART.beatsPerBar,
    countInBars: stored?.countInBars ?? DEFAULT_CHART.countInBars
  };

  const transpose = stored?.transpose ?? 0;
  const capoShift = song.capo ? -song.capo : 0;

  // Auto-synthesize chart from progressions and lyrics/notes if none is explicitly saved
  const lines = useMemo(() => {
    if (stored?.lines && stored.lines.length > 0) return stored.lines;
    if (stored?.source) {
      const parsed = linesFromText(stored.source, settings.beatsPerBar);
      if (parsed.length > 0) return parsed;
    }
    const progs = songProgressions(song);
    return synthesizeChart(progs, song.notes, settings.beatsPerBar);
  }, [stored, song, settings.beatsPerBar]);

  const [drawer, setDrawer] = useState<Drawer>(null);
  const toggleDrawer = (d: Drawer) => setDrawer(open => (open === d ? null : d));
  const [playChords, setPlayChords] = useState(true);
  const [metronome, setMetronome] = useState(true);

  // The song's own strumming, if it has any recorded
  const pattern = useMemo(
    () => parseStrum(song.strumming ?? '', settings.beatsPerBar),
    [song.strumming, settings.beatsPerBar]
  );

  const chart = useMemo(
    () => timeChart(lines, settings.beatsPerBar, transpose),
    [lines, settings.beatsPerBar, transpose]
  );

  const [isLooping, setIsLooping] = useState(false);
  const [speedRamp, setSpeedRamp] = useState<number>(0); // 0 = off, 1 = +1 BPM/lap, 2 = +2 BPM/lap
  const lastLapRef = useRef(0);

  const { phase, beat, slot, start, stop, pause, resume, countInBeats } = useChartTransport(
    chart,
    settings,
    { playChords, metronome, strum: true, pattern: playChords ? pattern : null, loop: isLooping }
  );

  const moving = phase === 'countin' || phase === 'playing';
  const running = moving || phase === 'paused';
  const holding = phase === 'playing' || phase === 'paused';
  const counting = phase === 'countin' || (phase === 'paused' && beat < 0);

  const currentLine = holding ? lineAtBeat(chart, beat) : null;
  const { current, next } = holding
    ? chordsAtBeat(chart, beat)
    // Before it starts you hold the first chord, so what is next is the second.
    : { current: null, next: chordsAtBeat(chart, chart.lines[0]?.chords[0]?.beat ?? 0).next };

  const currentVoicing = useVoicing(current?.symbol ?? (chart.chords[0] ?? null));
  const nextVoicing = useVoicing(next?.symbol ?? null);

  // Automatically ramp tempo upon completing each full loop lap
  useEffect(() => {
    if (!isLooping || speedRamp === 0 || chart.totalBeats <= 0) {
      lastLapRef.current = 0;
      return;
    }
    if (beat < 0) {
      lastLapRef.current = 0;
      return;
    }
    const currentLap = Math.floor(beat / chart.totalBeats);
    if (currentLap > lastLapRef.current) {
      lastLapRef.current = currentLap;
      patch({ tempo: Math.min(TEMPO_MAX, settings.tempo + speedRamp) });
    }
  }, [beat, isLooping, speedRamp, chart.totalBeats, settings.tempo]);

  const patch = (next: Partial<NonNullable<Song['chart']>>) =>
    void updateSong(song.id, { chart: { lines, ...settings, transpose, ...next } });

  useEffect(() => {
    if (mode !== 'play') stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const toDisplay = (symbol: string) => transposeSymbol(symbol, transpose);
  const toStored = (symbol: string) => transposeSymbol(symbol, -transpose);

  // The sheet is the page, so the page follows the line being played, and
  // only while you are looking at it: on another tab it leaves you be.
  const scroller = useRef<HTMLDivElement>(null);
  const lineIndex = currentLine?.index ?? -1;
  useEffect(() => {
    if (!running || !visible || lineIndex < 0) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-line="${lineIndex}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [running, visible, lineIndex]);

  // Tap tempo
  const [tapPulsing, setTapPulsing] = useState(false);
  const taps = useRef<number[]>([]);
  const tapTempo = () => {
    setTapPulsing(true);
    setTimeout(() => setTapPulsing(false), 180);
    const now = performance.now();
    const kept = [...taps.current, now].filter(t => now - t < 3000).slice(-5);
    taps.current = kept;
    if (kept.length < 2) return;
    const gaps = kept.slice(1).map((t, i) => t - kept[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const bpm = Math.round(60000 / mean);
    if (bpm >= TEMPO_MIN && bpm <= TEMPO_MAX) patch({ tempo: bpm });
  };

  const appendStroke = (stroke: string) => {
    const current = (song.strumming || '').trim();
    const next = current ? `${current} ${stroke}` : stroke;
    void updateSong(song.id, { strumming: next });
  };

  const popStroke = () => {
    if (!song.strumming) return;
    const tokens = tokenize(song.strumming);
    if (tokens.length <= 1) {
      void updateSong(song.id, { strumming: '' });
      return;
    }
    tokens.pop();
    void updateSong(song.id, { strumming: tokens.join(' ') });
  };

  const shiftStrum = (direction: -1 | 1) => {
    if (!pattern || pattern.steps.length === 0) return;
    const steps = [...pattern.steps];
    if (direction === 1) {
      const last = steps.pop()!;
      steps.unshift(last);
    } else {
      const first = steps.shift()!;
      steps.push(first);
    }
    void updateSong(song.id, { strumming: formatStrum({ ...pattern, steps }) });
  };

  const sigLabel = TIME_SIGNATURE_OPTIONS.find(o => o.value === settings.beatsPerBar)?.label ?? `${settings.beatsPerBar}/4`;
  const progress = Math.max(0, Math.min(1, beat / Math.max(1, chart.totalBeats)));
  const canPlay = chart.totalBeats > 0;

  const player = (
    <div className={`song-player${running ? ' is-live' : ''}`}>
      <span className="song-player-progress" style={{ width: `${running ? progress * 100 : 0}%` }} aria-hidden="true" />
      {!running ? (
        <button type="button" className="song-player-go" onClick={start} disabled={!canPlay}>
          <IconPlay size={15} fill="currentColor" strokeWidth={1.5} />
          {!canPlay ? 'Add chords to play along' : phase === 'done' ? 'Play again' : 'Play along'}
          {canPlay && <span className="readout">{settings.tempo} bpm</span>}
        </button>
      ) : (
        <div className="song-player-live">
          <button
            type="button"
            className={`transport-btn is-main${moving ? ' is-moving' : ''}${phase === 'paused' ? ' is-held' : ''}`}
            onClick={moving ? pause : resume}
            aria-label={moving ? 'Pause' : 'Resume'}
          >
            <span className="transport-icons" aria-hidden="true">
              <IconPlay size={16} className="transport-play" fill="currentColor" strokeWidth={1.5} />
              <IconPause size={16} className="transport-pause" fill="currentColor" strokeWidth={1} />
            </span>
            {moving && <span key={beat} className="transport-beat" aria-hidden="true" />}
          </button>
          <button type="button" className="transport-btn is-stop" onClick={stop} aria-label="Stop">
            <IconStop size={13} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
          </button>
          {counting ? (
            <span className="song-player-count readout">Count in {countInBeats + beat + 1}</span>
          ) : (
            <div className="song-player-chords">
              <HeldChord label="Hold" symbol={current?.symbol ?? chart.chords[0] ?? null} voicing={currentVoicing} />
              <HeldChord label="Next" symbol={next?.symbol ?? null} voicing={nextVoicing} faint />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <section
        className="song-sheet"
        hidden={!visible}
        role="tabpanel"
        id="song-panel-play"
        aria-labelledby="song-tab-play"
      >
        {mode === 'play' && (
          <>
            <div className="sheet-chips">
              <button
                type="button"
                className={`sheet-chip${drawer === 'tempo' ? ' is-open' : ''}`}
                onClick={() => toggleDrawer('tempo')}
                aria-expanded={drawer === 'tempo'}
              >
                <span className="readout">{settings.tempo} bpm · {sigLabel}</span>
                <Chevron />
              </button>
              <button
                type="button"
                className={`sheet-chip${drawer === 'strum' ? ' is-open' : ''}`}
                onClick={() => toggleDrawer('strum')}
                aria-expanded={drawer === 'strum'}
                aria-label="Strumming pattern"
              >
                {song.strumming ? <StrumChip text={song.strumming} beatsPerBar={settings.beatsPerBar} /> : <span>Add a strum</span>}
                <Chevron />
              </button>
              <button
                type="button"
                className={`sheet-chip${isLooping ? ' is-on' : ''}`}
                onClick={() => setIsLooping(l => !l)}
                aria-pressed={isLooping}
              >
                Loop
              </button>
            </div>

            {drawer === 'tempo' && (
              <div className="sheet-drawer">
                <div className="chart-tempo-studio">
                  <div className="tempo-top-line">
                    <span className="field-label">Tempo</span>
                    <span className="tempo-italian-badge readout">{getTempoMarking(settings.tempo)}</span>
                  </div>
                  <div className="tempo-controls-row">
                    <button type="button" className="btn tempo-nudge-btn" onClick={() => patch({ tempo: Math.max(TEMPO_MIN, settings.tempo - 1) })} aria-label="Decrease tempo 1 BPM">−</button>
                    <span className="chart-bpm readout"><strong>{settings.tempo}</strong><span className="bpm-unit">bpm</span></span>
                    <button type="button" className="btn tempo-nudge-btn" onClick={() => patch({ tempo: Math.min(TEMPO_MAX, settings.tempo + 1) })} aria-label="Increase tempo 1 BPM">+</button>
                    <input
                      type="range"
                      className="chart-tempo-range"
                      min={TEMPO_MIN}
                      max={TEMPO_MAX}
                      step={1}
                      value={settings.tempo}
                      onChange={e => patch({ tempo: Number(e.target.value) })}
                      aria-label="Tempo"
                    />
                    <button type="button" className={`btn chart-tap${tapPulsing ? ' is-tapped' : ''}`} onClick={tapTempo} title="Tap the beat to set the tempo">Tap</button>
                  </div>
                </div>

                <div className="chart-time-signature-studio">
                  <span className="field-label">Time</span>
                  <div className="signature-chips-row">
                    {TIME_SIGNATURE_OPTIONS.map(sig => (
                      <button
                        key={sig.value}
                        type="button"
                        className={`sig-chip-btn${settings.beatsPerBar === sig.value ? ' is-active' : ''}`}
                        onClick={() => patch({ beatsPerBar: sig.value })}
                        title={`${sig.label} (${sig.desc})`}
                      >
                        <span className="sig-num readout">{sig.label}</span>
                        <span className="sig-name">{sig.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="chart-audio-toggles">
                  <span className="field-label">Sound</span>
                  <button type="button" className={`btn chart-sound-toggle${playChords ? ' is-active' : ''}`} onClick={() => setPlayChords(p => !p)} aria-pressed={playChords}>Guitar</button>
                  <button type="button" className={`btn chart-click-toggle${metronome ? ' is-active' : ''}`} onClick={() => setMetronome(m => !m)} aria-pressed={metronome}>Click</button>
                </div>

                {isLooping && (
                  <div className="chart-ramp-select" title="Speed up a little every time the loop comes round">
                    <span className="field-label">Each loop</span>
                    <button type="button" className={`btn ramp-btn${speedRamp === 0 ? ' is-active' : ''}`} onClick={() => setSpeedRamp(0)}>Same speed</button>
                    <button type="button" className={`btn ramp-btn${speedRamp === 1 ? ' is-active' : ''}`} onClick={() => setSpeedRamp(1)}>+1 bpm</button>
                    <button type="button" className={`btn ramp-btn${speedRamp === 2 ? ' is-active' : ''}`} onClick={() => setSpeedRamp(2)}>+2 bpm</button>
                  </div>
                )}
              </div>
            )}

            {drawer === 'strum' && (
              <div className="sheet-drawer chart-strum-studio">
                <p className="strum-studio-sub">
                  {pattern ? 'Tap a slot to change it: down, up, chuck, rest.' : 'Pick a pattern to start with, or build one.'}
                </p>
                {pattern && (
                  <StrumGrid pattern={pattern} live={slot} onChange={text => void updateSong(song.id, { strumming: text })} />
                )}
                <div className="strum-preset-chips">
                  {getPresetsForMeter(settings.beatsPerBar).map(preset => (
                    <button
                      key={preset.pattern}
                      type="button"
                      className="chip-btn strum-preset-chip"
                      onClick={() => void updateSong(song.id, { strumming: preset.pattern })}
                      title={preset.pattern}
                    >
                      <span className="preset-name">{preset.name}</span>
                      <span className="preset-pat readout">{preset.pattern}</span>
                    </button>
                  ))}
                </div>
                <div className="palette-buttons">
                  <button type="button" className="btn palette-stroke-btn is-d" onClick={() => appendStroke('D')}>↓ Down</button>
                  <button type="button" className="btn palette-stroke-btn is-u" onClick={() => appendStroke('U')}>↑ Up</button>
                  <button type="button" className="btn palette-stroke-btn is-x" onClick={() => appendStroke('X')}>✕ Mute</button>
                  <button type="button" className="btn palette-stroke-btn is-rest" onClick={() => appendStroke('-')}>· Rest</button>
                  {pattern && pattern.steps.length > 0 && (
                    <>
                      <button type="button" className="btn palette-stroke-btn is-shift" onClick={() => shiftStrum(-1)} aria-label="Shift left">← Shift</button>
                      <button type="button" className="btn palette-stroke-btn is-shift" onClick={() => shiftStrum(1)} aria-label="Shift right">Shift →</button>
                    </>
                  )}
                  {song.strumming && (
                    <>
                      <button type="button" className="btn palette-stroke-btn is-pop" onClick={popStroke} aria-label="Delete last stroke">⌫ Undo</button>
                      <button type="button" className="btn palette-stroke-btn is-clear" onClick={() => void updateSong(song.id, { strumming: '' })}>Clear</button>
                    </>
                  )}
                </div>
                <label className="strum-input-field">
                  <span className="field-label">Or type it</span>
                  <input
                    type="text"
                    className="text-field strum-text-input readout"
                    value={song.strumming || ''}
                    placeholder="e.g. D D U U D U"
                    onChange={e => void updateSong(song.id, { strumming: e.target.value })}
                    aria-label="Strumming pattern shorthand"
                  />
                </label>
              </div>
            )}

            {chart.lines.length > 0 ? (
              <div className="song-panel chart-lines" ref={scroller}>
                {chart.lines.map(line => (
                  <SheetLine
                    key={line.id}
                    line={line}
                    chart={chart}
                    isNow={currentLine?.index === line.index}
                    beat={beat}
                    live={holding ? current : null}
                  />
                ))}
              </div>
            ) : (
              <div className="song-panel sheet-empty">
                <p>No chart yet. Paste a chord sheet, or write the chords in yourself.</p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => onMode('import')}>Import a chord sheet</button>
                  <button type="button" className="btn" onClick={() => onMode('edit')}>Write it</button>
                </div>
              </div>
            )}
          </>
        )}

        {mode !== 'play' && (
          <div className="sheet-modebar">
            <span>{mode === 'edit' ? 'Editing the chart' : 'Import a chord sheet'}</span>
            <button type="button" className="btn" onClick={() => onMode('play')}>{mode === 'edit' ? 'Done' : 'Cancel'}</button>
          </div>
        )}

        {mode === 'import' && (
          <div className="song-panel">
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
                onMode('edit');
              }}
            />
          </div>
        )}

        {mode === 'edit' && (
          <div className="song-panel">
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
          </div>
        )}
      </section>

      {dock && mode === 'play' && createPortal(player, dock)}
    </>
  );
};

const Chevron: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** A chord in the player: its shape, small, and its name. */
const HeldChord: React.FC<{ label: string; symbol: string | null; voicing: ChordVoicing | null; faint?: boolean }> = ({ label, symbol, voicing, faint }) => (
  <div className={`held-chord${faint ? ' is-faint' : ''}`}>
    {voicing && <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={0.4} />}
    <span className="held-chord-text">
      <span className="held-chord-label">{label}</span>
      <span className="held-chord-name">{symbol ?? '–'}</span>
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// One line of the sheet, with real-time moving beat and chord highlights
// ---------------------------------------------------------------------------

const SheetLine: React.FC<{
  line: ChartLine;
  chart: ParsedChart;
  isNow: boolean;
  beat: number;
  live: { beat: number } | null;
}> = ({ line, chart, isNow, beat, live }) => {
  const showSection = line.section && (line.index === 0 || chart.lines[line.index - 1].section !== line.section);

  // Chords with no words under them, an intro or a song with no lyrics
  // written, read as bars: one cell per chord, lit while it plays.
  if (line.instrumental) {
    return (
      <>
        {showSection && <p className="chart-section">{line.section}</p>}
        <div className={`chart-bars${isNow ? ' is-now' : ''}`} data-line={line.index}>
          {line.chords.map((chord, i) => {
            const isLive = live && Math.abs(chord.beat - live.beat) < 1e-6;
            return (
              <span
                key={i}
                className={`chart-bar-cell is-${comfortOf(chord.symbol)}${isLive ? ' is-live' : ''}`}
                title={`${chord.symbol} · ${COMFORT_LABEL[comfortOf(chord.symbol)]}`}
              >
                {chord.symbol}
              </span>
            );
          })}
        </div>
      </>
    );
  }

  let cursor = 0;
  const beatInLine = isNow ? beat - line.startBeat : -1;
  const totalSegs = line.segments.length;

  return (
    <>
      {showSection && <p className="chart-section">{line.section}</p>}
      <p className={`chart-line${isNow ? ' is-now' : ''}${line.instrumental ? ' is-instrumental' : ''}`} data-line={line.index}>
        {line.segments.map((seg, i) => {
          const chord = seg.chord ? line.chords[cursor++] : null;
          const isLiveChord = live && chord && Math.abs(chord.beat - live.beat) < 1e-6;
          const isLiveWord = isNow && beatInLine >= 0 && Math.floor((beatInLine / Math.max(1, line.beats)) * totalSegs) === i;
          return (
            <span key={i} className={`chart-seg${isLiveWord ? ' is-active-word' : ''}`}>
              <span
                className={`chart-seg-chord readout${isLiveChord ? ' is-live' : ''}${seg.chord ? ` is-${comfortOf(seg.chord)}` : ''}`}
                title={seg.chord ? `${seg.chord} · ${COMFORT_LABEL[comfortOf(seg.chord)]}` : undefined}
              >{seg.chord ?? ''}</span>
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
   * the only anchor that survives the text changing underneath, a chord past
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
        Paste a chord sheet. Chords above the lyrics or inline both work.
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
            {read.lines.filter(l => l.kind === 'lyric').length} {read.lines.filter(l => l.kind === 'lyric').length === 1 ? 'line' : 'lines'} · {chordCount} {chordCount === 1 ? 'chord' : 'chords'}
          </span>
          <span className="import-format">{read.stacked ? 'chords above the words' : 'chords written in'}</span>
          {found.length > 0 && (
            <label className="chart-toggle import-meta">
              <input type="checkbox" checked={takeMeta} onChange={e => setTakeMeta(e.target.checked)} />
              Also take {found.join(' · ')}
              {song.capo !== null && read.meta.capo !== undefined && read.meta.capo !== song.capo && (
                <span className="import-warn"> (the song is set to capo {song.capo})</span>
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
