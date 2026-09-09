import React, { useMemo, useRef, useState } from 'react';
import { IconPause, IconPlay, IconStop, IconX } from './Icons';
import { Segmented } from './Segmented';
import { useChartTransport } from '../hooks/useChartTransport';
import { TEMPO_MAX, TEMPO_MIN, lineAtBeat, timeChart } from '../utils/chart';
import { comfortOf, preferredVoicing } from '../utils/chordbook';
import { loopLines, type LoopStrum, type Slot } from '../utils/loop';

const BEATS_PER_BAR = [3, 4, 6];

interface QuickPlayProps {
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
  onClose: () => void;
}

/**
 * A progression, in time, in about four presses.
 *
 * The page it sits on is already a wall of chords, so it does not carry a
 * chord picker of its own: while this is open, pressing any chord on the page
 * adds it here. That is the whole design — the shelf you were browsing becomes
 * the palette, and nothing has to be typed or searched for twice.
 */
export const QuickPlay: React.FC<QuickPlayProps> = ({ slots, onChange, onClose }) => {
  const [tempo, setTempo] = useState(80);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [strum, setStrum] = useState<LoopStrum>('bar');
  const [click, setClick] = useState(true);

  const settings = useMemo(
    () => ({ tempo, beatsPerBar, countInBars: 1 }),
    [tempo, beatsPerBar]
  );
  const chart = useMemo(
    () => timeChart(loopLines(slots, beatsPerBar, strum), beatsPerBar, 0),
    [slots, beatsPerBar, strum]
  );

  const { phase, beat, start, stop, pause, resume } = useChartTransport(
    chart,
    settings,
    { playChords: true, loop: true, strum: true, metronome: click }
  );
  const moving = phase === 'countin' || phase === 'playing';
  const running = moving || phase === 'paused';

  // Which slot is sounding. The beat counts on past the end for ever, so the
  // lap has to be taken off before it is looked up.
  const lap = chart.totalBeats > 0 && beat >= 0 ? beat % chart.totalBeats : -1;
  const liveLine = phase === 'playing' || phase === 'paused' ? lineAtBeat(chart, lap) : null;
  const liveId = liveLine ? chart.lines[liveLine.index]?.id : null;

  const bars = slots.reduce((n, s) => n + s.bars, 0);
  const seconds = (bars * beatsPerBar * 60) / tempo;

  const set = (id: string, patch: Partial<Slot>) =>
    onChange(slots.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(slots.filter(s => s.id !== id));
  const move = (i: number, by: number) => {
    const next = [...slots];
    const [moved] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + by)), 0, moved);
    onChange(next);
  };

  const taps = useRef<number[]>([]);
  const tapTempo = () => {
    const now = performance.now();
    const kept = [...taps.current, now].filter(t => now - t < 3000).slice(-5);
    taps.current = kept;
    if (kept.length < 2) return;
    const gaps = kept.slice(1).map((t, i) => t - kept[i]);
    const bpm = Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    if (bpm >= TEMPO_MIN && bpm <= TEMPO_MAX) setTempo(bpm);
  };

  return (
    <section className={`quickplay${moving ? ' is-running' : ''}`} aria-label="Quick play">
      <div className="quickplay-head">
        <span className="surface-label">Quick play</span>
        <span className="readout quickplay-len">
          {slots.length === 0
            ? 'empty'
            : `${slots.length} chord${slots.length === 1 ? '' : 's'} · ${bars} bar${bars === 1 ? '' : 's'} · ${seconds.toFixed(1)}s a lap`}
        </span>
        <button type="button" className="quickplay-close" onClick={onClose} aria-label="Close quick play" title="Close">
          <IconX size={14} />
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="quickplay-empty">
          Press any chord below to add it. They play in the order you add them, round and round.
        </p>
      ) : (
        <ol className="quickplay-seq">
          {slots.map((slot, i) => (
            <li
              key={slot.id}
              className={`qslot is-${comfortOf(slot.symbol)}${slot.id === liveId ? ' is-live' : ''}`}
            >
              <span className="qslot-name">{slot.symbol}</span>
              <span className="qslot-shape readout">{preferredVoicing(slot.symbol)?.label ?? 'no shape'}</span>
              <span className="qslot-bars">
                <button type="button" onClick={() => set(slot.id, { bars: Math.max(1, slot.bars - 1) })} aria-label={`Fewer bars of ${slot.symbol}`} disabled={slot.bars <= 1}>−</button>
                <span className="readout">{slot.bars}</span>
                <button type="button" onClick={() => set(slot.id, { bars: Math.min(8, slot.bars + 1) })} aria-label={`More bars of ${slot.symbol}`} disabled={slot.bars >= 8}>+</button>
              </span>
              <span className="qslot-tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${slot.symbol} earlier`} title="Earlier">‹</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === slots.length - 1} aria-label={`Move ${slot.symbol} later`} title="Later">›</button>
                <button type="button" onClick={() => remove(slot.id)} aria-label={`Remove ${slot.symbol}`} title="Remove">×</button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="quickplay-bar">
        <div className="transport">
          <button
            type="button"
            className={`transport-btn is-main${moving ? ' is-moving' : ''}${phase === 'paused' ? ' is-held' : ''}`}
            onClick={moving ? pause : phase === 'paused' ? resume : start}
            disabled={slots.length === 0}
            aria-label={moving ? 'Pause' : phase === 'paused' ? 'Resume' : 'Play the loop'}
            title={moving ? 'Pause' : phase === 'paused' ? 'Resume' : 'Play the loop'}
          >
            <span className="transport-icons" aria-hidden="true">
              <IconPlay size={18} className="transport-play" fill="currentColor" strokeWidth={1.5} />
              <IconPause size={18} className="transport-pause" fill="currentColor" strokeWidth={1} />
            </span>
            {moving && <span key={beat} className="transport-beat" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="transport-btn is-stop"
            onClick={stop}
            disabled={!running}
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
            value={tempo}
            onChange={e => setTempo(Number(e.target.value))}
            aria-label="Tempo in beats per minute"
          />
        </label>
        <span className="chart-bpm readout">{tempo}<span> bpm</span></span>
        <button type="button" className="btn chart-tap" onClick={tapTempo}>Tap</button>

        <label className="chart-signature">
          <span className="field-label">Beats/bar</span>
          <select className="select-field" value={beatsPerBar} disabled={running} onChange={e => setBeatsPerBar(Number(e.target.value))}>
            {BEATS_PER_BAR.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="catalogue-field">
          <span className="field-label">Strum</span>
          <Segmented<LoopStrum>
            value={strum}
            onChange={setStrum}
            options={[{ value: 'bar', label: 'Once a bar' }, { value: 'beat', label: 'Every beat' }]}
            ariaLabel="How often to strum"
            size="sm"
          />
        </label>

        <label className="chart-toggle">
          <input type="checkbox" checked={click} onChange={e => setClick(e.target.checked)} />
          Click
        </label>

        {slots.length > 0 && (
          <button type="button" className="btn quickplay-clear" onClick={() => { stop(); onChange([]); }}>
            Clear
          </button>
        )}
      </div>

    </section>
  );
};

export default QuickPlay;
