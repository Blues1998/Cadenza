import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from './ChordDiagram';
import { IconPause, IconPlay, IconStop, IconX } from './Icons';
import { LoopShelf, type LoopSetup } from './LoopShelf';
import { LoopStage } from './LoopStage';
import { StrumGrid } from './StrumGrid';
import { useChartTransport, type ChartPhase } from '../hooks/useChartTransport';
import { TEMPO_MAX, TEMPO_MIN, lineAtBeat, timeChart } from '../utils/chart';
import { audio } from '../utils/audio';
import { comfortOf, preferredVoicing, voicingsFor } from '../utils/chordbook';
import type { ChordVoicing } from '../utils/chords';
import { loopLines, slotShapes, slotVoicing, type Slot } from '../utils/loop';
import { DEFAULT_PATTERN, parseStrum, strokeCount } from '../utils/strum';
import { loopSignature, rememberLoop, saveLoop, savedNamed, slotChords, slotShapeNames } from '../utils/loopbook';

const BEATS_PER_BAR = [3, 4, 6];

// The handful worth a press. Everything else is typed, or built by pressing
// cells in the grid — which is how most patterns here will actually be made.
const PATTERN_IDEAS = ['D', 'D D D D', 'D D U U D U', 'D U D U', 'D - D U - U D U', 'D U X U D U'];

/**
 * A start or a stop asked for from somewhere else on the page.
 *
 * Carries an id rather than being a bare verb, because the answer to "has
 * this already been acted on" cannot be read off 'start' — pressing play,
 * stopping, and pressing play again is two identical orders that both have
 * to land.
 */
export interface TransportOrder {
  id: number;
  action: 'start' | 'stop';
}

interface QuickPlayProps {
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
  onClose: () => void;
  /** Play or stop, asked for by the page's own button. */
  order?: TransportOrder | null;
  /** Where the transport has got to, for anything outside drawing a button. */
  onPhase?: (phase: ChartPhase) => void;
}

/**
 * A progression, in time, in about four presses.
 *
 * Chords arrive three ways and the panel owns none of them outright: ticked
 * off the page it sits on, taken from the shelf below, or built in the key
 * picker there. What the panel is for is everything after that — the order,
 * how long each chord is held, the tempo, and the strumming hand.
 */
export const QuickPlay: React.FC<QuickPlayProps> = ({ slots, onChange, onClose, order, onPhase }) => {
  const [tempo, setTempo] = useState(80);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  // The pattern as written, not as resolved: what somebody typed is what the
  // field goes on showing, and the grid underneath says what it came to.
  const [patternText, setPatternText] = useState(DEFAULT_PATTERN);
  const [click, setClick] = useState(true);

  const settings = useMemo(
    () => ({ tempo, beatsPerBar, countInBars: 1 }),
    [tempo, beatsPerBar]
  );
  const chart = useMemo(
    () => timeChart(loopLines(slots), beatsPerBar, 0),
    [slots, beatsPerBar]
  );
  const pattern = useMemo(() => parseStrum(patternText, beatsPerBar), [patternText, beatsPerBar]);
  // Shapes the loop insists on — a drill saying which grip it is about. Empty
  // for anything built by hand, which is nearly everything that comes through
  // here, and then every chord is sounded with the one you play it with.
  const shapes = useMemo(() => slotShapes(slots), [slots]);

  const { phase, beat, slot, start, stop, pause, resume } = useChartTransport(
    chart,
    settings,
    // The pattern is the strumming hand. With the field empty there is no
    // hand, and the loop becomes a click and a set of chord names to strum
    // against yourself — which is the other half of what this is for.
    { playChords: pattern !== null, loop: true, strum: true, metronome: click, pattern, shapes }
  );
  const moving = phase === 'countin' || phase === 'playing';
  const running = moving || phase === 'paused';

  // The page has a play button of its own — the one on the bucket, which is
  // in reach while the panel itself is several screens up.
  //
  // The order is the whole dependency, and it is a fresh object per press, so
  // this runs once for each press and not once per render. Deliberately not
  // guarded by a "have I already done this id" flag: in development React
  // mounts, tears down and remounts, and the teardown stops the transport —
  // so an effect that refused to repeat itself would leave the loop stopped
  // by the very cleanup that was meant to be undone. Start is idempotent; it
  // halts whatever is running before it begins.
  const act = useRef({ start, stop });
  act.current = { start, stop };
  useEffect(() => {
    if (!order) return;
    if (order.action === 'start') act.current.start();
    else act.current.stop();
  }, [order]);

  useEffect(() => {
    onPhase?.(phase);
  }, [phase, onPhase]);

  // A loop is kept once it has actually started sounding. The count-in is
  // still a chance to change your mind, and a history full of things nobody
  // played is a history nobody reads.
  //
  // Guarded by the loop's own signature rather than by a flag, so editing a
  // chord and playing again records the new loop, while a pause and a resume
  // in the middle of one record nothing twice. Stopping clears it, because
  // playing the same loop again tomorrow is another run of it.
  const kept = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') {
      kept.current = null;
      return;
    }
    if (phase !== 'playing') return;
    const chords = slotChords(slots);
    const signature = loopSignature(chords, beatsPerBar);
    if (kept.current === signature) return;
    kept.current = signature;
    void rememberLoop({ chords, tempo, beatsPerBar, pattern: patternText, shapes: slotShapeNames(slots) });
  }, [phase, slots, beatsPerBar, tempo, patternText]);

  // A loop from the shelf arrives whole — chords, tempo and metre — because
  // the tempo a progression was written for is part of what it is. Stopped
  // first: the metre cannot change under a running clock.
  const applyLoop = (next: Slot[], setup: LoopSetup) => {
    stop();
    onChange(next);
    setTempo(setup.tempo);
    setBeatsPerBar(setup.beatsPerBar);
    if (setup.pattern) setPatternText(setup.pattern);
    setCameFrom(setup.name ?? '');
    setNaming(false);
  };

  // What the loop was called where it came from, so saving an edited template
  // opens with the template's name rather than an empty box. Cleared by
  // building from scratch, because a loop with nothing left of the Andalusian
  // in it should not be offered that name.
  const [cameFrom, setCameFrom] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(0);
  const nameField = useRef<HTMLInputElement>(null);

  const startNaming = () => {
    setName(cameFrom || slotChords(slots).map(([symbol]) => symbol).join(' '));
    setNaming(true);
  };

  // Focused and selected, so the suggestion is a starting point and not
  // something to delete before you can type.
  useEffect(() => {
    if (naming) nameField.current?.select();
  }, [naming]);

  // Nothing to name once there is nothing there.
  useEffect(() => {
    if (slots.length === 0) { setNaming(false); setCameFrom(''); }
  }, [slots.length]);

  const keep = () => {
    const trimmed = name.trim();
    if (trimmed === '' || slots.length === 0) return;
    void saveLoop({
      name: trimmed,
      chords: slotChords(slots),
      shapes: slotShapeNames(slots),
      tempo,
      beatsPerBar,
      pattern: patternText
    });
    setCameFrom(trimmed);
    setNaming(false);
    setSaved(n => n + 1);
  };

  // Which slot is sounding. The beat counts on past the end for ever, so the
  // lap has to be taken off before it is looked up.
  const lap = chart.totalBeats > 0 && beat >= 0 ? beat % chart.totalBeats : -1;
  const liveLine = phase === 'playing' || phase === 'paused' ? lineAtBeat(chart, lap) : null;
  const liveId = liveLine ? chart.lines[liveLine.index]?.id : null;

  // Where the hands are, for the stage. One slot is one line of the chart, so
  // the line being played is the chord being held and the one after it in the
  // loop is what to get ready for.
  const nowIndex = liveLine?.index ?? -1;
  const beatsLeft = liveLine ? liveLine.startBeat + liveLine.beats - lap : 0;
  // The count-in is a bar like any other, so the same lamps count it: the beat
  // runs negative before the first chord and the modulo brings it home.
  const pulse = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const countIn = phase === 'countin' ? Math.max(1, -beat) : 0;

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

  // Which chord's shapes are open, by name rather than by slot: the pick lands
  // on every slot of that chord, so opening it from one of two Fs and having
  // it belong to only that one would be a lie the loop could not keep.
  const [picking, setPicking] = useState<string | null>(null);

  // Pressing play shuts the shape drawer. The slots it opens from are a thin
  // strip by then, so it would be a panel of diagrams pointing at nothing.
  useEffect(() => {
    if (running) setPicking(null);
  }, [running]);

  // A chord taken out of the loop takes its open shape drawer with it.
  useEffect(() => {
    if (picking !== null && !slots.some(slot => slot.symbol === picking)) setPicking(null);
  }, [slots, picking]);

  useEffect(() => {
    if (picking === null) return;
    const shut = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(null); };
    window.addEventListener('keydown', shut);
    return () => window.removeEventListener('keydown', shut);
  }, [picking]);

  /**
   * Play this chord that way from now on — in this loop, and only in it.
   *
   * Choosing your own shape back clears the pin rather than storing it, so the
   * loop stops overruling the chord book the moment it has nothing to say.
   * Nothing here writes to the book: a shape tried out for four bars is not
   * the answer to "what do you play F with", and quietly making it the answer
   * would change every song in the app from inside a practice panel.
   */
  const choose = (symbol: string, voicing: ChordVoicing) => {
    const mine = preferredVoicing(symbol)?.label;
    const shape = voicing.label === mine ? undefined : voicing.label;
    onChange(slots.map(slot => (slot.symbol === symbol ? { ...slot, shape } : slot)));
    // Running, the next stroke is the answer and is a beat away. Stopped,
    // nothing would happen at all, and a shape you cannot hear is a picture.
    if (!moving) audio.playStrum(voicing.midis);
    setPicking(null);
  };

  // What the open drawer is set to, read off the loop rather than off the
  // chord book: a pinned slot is playing something the book does not know
  // about, and that is the one the drawer has to tick.
  const held = picking === null ? undefined : slots.find(slot => slot.symbol === picking);
  const chosen = held ? slotVoicing(held)?.label ?? null : null;

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
        <p className="quickplay-empty">Tick any chord on the page to add it, or take one from the shelf below.</p>
      ) : (
        <ol className={`quickplay-seq${running ? ' is-compact' : ''}`}>
          {slots.map((slot, i) => {
            const voicing = slotVoicing(slot);
            const label = voicing?.label ?? 'no shape';
            const all = voicingsFor(slot.symbol);
            return (
            <li
              key={slot.id}
              className={`qslot is-${comfortOf(slot.symbol)}${slot.id === liveId ? ' is-live' : ''}${slot.shape ? ' is-pinned' : ''}${picking === slot.symbol ? ' is-picking' : ''}`}
            >
              <span className="qslot-name">{slot.symbol}</span>
              {/* The shape itself, not the name of it. What is about to be
                  played is a picture of where the fingers go, and it is also
                  the way to change it — a chord with one shape is not a
                  button, because there is nothing on the other side of it. */}
              {voicing && all.length > 1 ? (
                <button
                  type="button"
                  className="qslot-shape"
                  onClick={() => setPicking(p => (p === slot.symbol ? null : slot.symbol))}
                  aria-expanded={picking === slot.symbol}
                  aria-label={`${slot.symbol} is ${label} — choose another shape`}
                  title={`${slot.symbol} — ${label} · press to change the shape`}
                >
                  <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={0.5} />
                  <span className="qslot-shapename readout">{label}</span>
                </button>
              ) : voicing ? (
                <span className="qslot-shape is-only" title={`${slot.symbol} — ${label}`}>
                  <ChordDiagram frets={voicing.frets} fingers={voicing.fingers} scale={0.5} />
                  <span className="qslot-shapename readout">{label}</span>
                </span>
              ) : (
                <span className="qslot-shapename readout">{label}</span>
              )}
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
            );
          })}
        </ol>
      )}

      {/* Under the sequence rather than inside the slot: a slot is the width of
          a chord name and the shapes are wider than that, and a drawer that
          opened inside one would push the rest of the loop around it. The slot
          it belongs to is ringed, which is the whole of the explanation. */}
      {running && (
        <LoopStage
          slots={slots}
          now={nowIndex}
          left={beatsLeft}
          pulse={pulse}
          beatsPerBar={beatsPerBar}
          countIn={countIn}
          pattern={pattern}
          stroke={slot}
        />
      )}

      {picking !== null && (
        <div className="shapepick qshapes" role="radiogroup" aria-label={`Shapes for ${picking}`}>
          {voicingsFor(picking).map(v => {
            const on = v.label === chosen;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`shapepick-item${on ? ' is-on' : ''}`}
                onClick={() => choose(picking, v)}
                title={v.substituteFor ? `${v.label} — played instead of ${v.substituteFor}` : v.label}
              >
                <ChordDiagram frets={v.frets} fingers={v.fingers} scale={0.44} />
                <span className="shapepick-label readout">{v.label}</span>
                <span className={`shapepick-tier tier-${v.tier}`}>{v.tier}</span>
              </button>
            );
          })}
        </div>
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

        <label className="chart-toggle">
          <input type="checkbox" checked={click} onChange={e => setClick(e.target.checked)} />
          Click
        </label>

        {/* Keep and discard, side by side, because they are the two things
            you can do with a finished loop and putting them anywhere else
            would mean looking for one of them. The field takes the pair's
            place while it is open rather than appearing beside them: naming
            is the only thing being done at that moment. */}
        {slots.length > 0 && (naming ? (
          <form
            className="quickplay-name"
            onSubmit={e => { e.preventDefault(); keep(); }}
          >
            <input
              ref={nameField}
              className="text-field"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(false); } }}
              placeholder="Name this loop"
              aria-label="Name for this loop"
              maxLength={60}
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary" disabled={name.trim() === ''}>
              {savedNamed(name) ? 'Replace' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={() => setNaming(false)}>Cancel</button>
          </form>
        ) : (
          <>
            <button type="button" className="btn quickplay-keep" onClick={startNaming}>
              Save
            </button>
            <button type="button" className="btn quickplay-clear" onClick={() => { stop(); onChange([]); }}>
              Clear
            </button>
          </>
        ))}
      </div>

      {/* Above the strumming, not below it. Both are drawers on the same
          panel, but picking is what you are doing over and over while a loop
          is being built, and the pattern is a thing you set and then watch. On
          a short screen the panel runs out of room, and what runs out of it
          has to be the one you are not using. */}
      <LoopShelf
        onUse={applyLoop}
        onAppend={next => onChange([...slots, ...next])}
        shut={moving}
        reveal={saved}
      />

      {/* Where the pattern is written. While the loop runs it is on the stage
          instead, at a size you can read from where a guitar is actually
          played — and writing one is setup, which stops when playing starts
          for the same reason the shelf and the slot tools do. */}
      {!running && (
      <div className="quickplay-strum">
        <label className="catalogue-field quickplay-pattern">
          <span className="field-label">Strumming</span>
          <input
            className="text-field readout"
            value={patternText}
            onChange={e => setPatternText(e.target.value)}
            placeholder="D D U U D U"
            aria-label="Strumming pattern"
            spellCheck={false}
          />
        </label>
        <div className="quickplay-ideas">
          {PATTERN_IDEAS.map(idea => (
            <button
              key={idea}
              type="button"
              className={`chip-btn readout${idea === patternText ? ' is-on' : ''}`}
              onClick={() => setPatternText(idea)}
            >
              {idea}
            </button>
          ))}
        </div>
        {pattern ? (
          <>
            <StrumGrid pattern={pattern} live={slot} onChange={setPatternText} />
            <p className="quickplay-strumnote readout">
              {strokeCount(pattern) === 0
                ? 'nothing lands — the chords will not sound'
                : `${strokeCount(pattern)} stroke${strokeCount(pattern) === 1 ? '' : 's'} over ${pattern.bars} bar${pattern.bars === 1 ? '' : 's'} · press a cell to change it${pattern.bars > 1 ? ' · × drops a bar' : ''}`}
            </p>
          </>
        ) : (
          <p className="quickplay-strumnote readout">
            No pattern — the chords stay silent under the click. Write D and U, or take one above.
          </p>
        )}
      </div>
      )}

    </section>
  );
};

export default QuickPlay;
