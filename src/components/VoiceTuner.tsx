import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Segmented } from './Segmented';
import { PitchTrace } from './PitchTrace';
import { IconPlay, IconStop } from './Icons';
import { useMicPitch } from '../hooks/useMicPitch';
import { audio } from '../utils/audio';
import { reportProgress } from '../utils/progress';
import {
  SA_CHOICES, closestVoiceType, labelFor, prettyNote, setVoice, useVoice,
  type NoteLabel, type Notation, type Range
} from '../utils/voice';

// The tuner, for a voice.
//
// Three things a singer actually does with one: watch what their voice is
// doing (Sing), practise landing and holding a note (Hold), and find out where
// their voice lives (Range), which the song pages then use to say whether a
// song is in a key you can sing.

type Mode = 'sing' | 'hold' | 'range';

const BAND_CENTS = 30;        // in tune, for a held sung note
const HOLD_TARGET_MS = 1500;  // long enough that you have stopped arriving and are holding
const REFERENCE_MS = 1700;    // the reference note's length, plus its tail in the room
const RANGE_HOLD_MS = 500;    // a note counts toward your range once held this long

const toMidi = (hz: number) => 12 * Math.log2(hz / 440) + 69;

/** A note name, or a sargam syllable with its komal/tivra and octave marks. */
export const NoteName: React.FC<{ label: NoteLabel; className?: string }> = ({ label, className }) => (
  <span className={`notename${label.komal ? ' is-komal' : ''}${label.tivra ? ' is-tivra' : ''}${className ? ` ${className}` : ''}`}>
    {label.octave > 0 && <span className="notename-dots is-above" aria-hidden="true">{'•'.repeat(label.octave)}</span>}
    <span className="notename-text">{label.text}</span>
    {label.octave < 0 && <span className="notename-dots is-below" aria-hidden="true">{'•'.repeat(-label.octave)}</span>}
  </span>
);

// ---- A tanpura-ish drone on Sa, for singing against -----------------------
// Sa, Pa and the Sa above, on soft triangle waves with a slow shimmer. Plain
// oscillators rather than samples: it only has to hold still, and it has to
// be quiet enough that the mic still hears the voice over it.
function startDrone(sa: number): () => void {
  const bus = audio.getMasterBus();
  if (!bus) return () => {};
  const { ctx, input } = bus;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.8);
  out.connect(input);
  const oscs: OscillatorNode[] = [];
  for (const [semi, level] of [[0, 0.5], [7, 0.3], [12, 0.25], [-12, 0.2]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440 * Math.pow(2, (sa + semi - 69) / 12);
    const g = ctx.createGain();
    g.gain.value = level;
    // The shimmer: each string breathes at its own slow rate.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.2 + Math.random() * 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = level * 0.35;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(g).connect(out);
    osc.start();
    lfo.start();
    oscs.push(osc, lfo);
  }
  return () => {
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.4);
    oscs.forEach(o => o.stop(t + 0.45));
  };
}

export const VoiceTuner: React.FC = () => {
  const { pitch, isActive, error, start, stop } = useMicPitch('voice');
  const voice = useVoice();
  const { notation, sa } = voice;
  const [mode, setMode] = useState<Mode>('sing');

  const live = pitch ? toMidi(pitch.frequency) : null;
  const nearest = live !== null ? Math.round(live) : null;
  const cents = live !== null && nearest !== null ? Math.round((live - nearest) * 100) : null;

  // Journey: the first pitch heard counts here too.
  const reported = useRef(false);
  useEffect(() => {
    if (pitch && !reported.current) { reported.current = true; reportProgress('tuner-pitch-detected'); }
  }, [pitch]);

  // ---- Drone (Sing only) ---------------------------------------------------
  const [droning, setDroning] = useState(false);
  const stopDrone = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!droning) return;
    stopDrone.current = startDrone(sa);
    return () => { stopDrone.current?.(); stopDrone.current = null; };
  }, [droning, sa]);
  useEffect(() => { if (mode !== 'sing') setDroning(false); }, [mode]);

  // ---- Hold a note --------------------------------------------------------
  const pool = useCallback((): number[] => {
    const r = voice.range;
    const low = r ? r.low + 1 : sa;
    const high = r ? r.high - 1 : sa + 12;
    return Array.from({ length: Math.max(1, high - low + 1) }, (_, i) => low + i);
  }, [voice.range, sa]);

  const [target, setTarget] = useState<number>(() => sa + 7);
  const [holdMs, setHoldMs] = useState(0);
  const [matched, setMatched] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastResult, setLastResult] = useState<{ note: number; spread: number } | null>(null);
  const holdRef = useRef({ ms: 0, last: 0, samples: [] as number[], quietUntil: 0 });

  const newTarget = useCallback((from?: number) => {
    const options = pool().filter(n => n !== (from ?? target));
    const next = options[Math.floor(Math.random() * options.length)] ?? sa;
    setTarget(next);
    holdRef.current = { ms: 0, last: 0, samples: [], quietUntil: 0 };
    setHoldMs(0);
  }, [pool, target, sa]);

  const playReference = (note = target) => {
    audio.init();
    audio.playMidi(note, 1.4);
    // Don't let the phone hear its own speaker and call that a match.
    holdRef.current.quietUntil = performance.now() + REFERENCE_MS;
  };

  useEffect(() => {
    if (mode !== 'hold' || !isActive) return;
    const h = holdRef.current;
    const now = performance.now();
    const dt = h.last === 0 ? 16 : Math.min(100, now - h.last);
    h.last = now;
    if (now < h.quietUntil) return;

    const inBand = live !== null && Math.abs(live - target) * 100 <= BAND_CENTS;
    if (inBand) {
      h.ms += dt;
      h.samples.push((live! - target) * 100);
    } else {
      h.ms = Math.max(0, h.ms - dt * 2);
      if (h.ms === 0) h.samples = [];
    }
    setHoldMs(h.ms);

    if (h.ms >= HOLD_TARGET_MS) {
      // How steady it was: the spread of the held pitch, in cents.
      const s = h.samples;
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      const spread = Math.round(Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length));
      setLastResult({ note: target, spread });
      setMatched(m => m + 1);
      setStreak(n => n + 1);
      reportProgress('tuner-note-matched');
      h.ms = 0;
      h.samples = [];
      // A beat to see it land before the next one, and quiet so the chime
      // is not heard as singing.
      h.quietUntil = now + 900;
      setTimeout(() => newTarget(target), 700);
    }
  }, [live, mode, isActive, target, newTarget]);

  // ---- Range ---------------------------------------------------------------
  const [found, setFound] = useState<Range | null>(null);
  const rangeRef = useRef<{ note: number | null; since: number }>({ note: null, since: 0 });
  useEffect(() => {
    if (mode !== 'range' || !isActive || live === null) { rangeRef.current.note = null; return; }
    const note = Math.round(live);
    const steady = Math.abs(live - note) < 0.4;
    const now = performance.now();
    const r = rangeRef.current;
    if (!steady || r.note !== note) { rangeRef.current = { note: steady ? note : null, since: now }; return; }
    if (now - r.since >= RANGE_HOLD_MS) {
      setFound(f => (f ? { low: Math.min(f.low, note), high: Math.max(f.high, note) } : { low: note, high: note }));
    }
  }, [live, mode, isActive]);

  const label = (m: number) => labelFor(m, notation, sa);
  const saved = voice.range;

  const holdPct = Math.min(100, (holdMs / HOLD_TARGET_MS) * 100);

  return (
    <div className="voice">
      {/* The stage: the trace fills it, and everything you read while singing
          floats over it, so the line gets every pixel the screen can spare. */}
      <section className="glass-panel voice-stage">
        <PitchTrace pitch={live} notation={notation} sa={sa} target={mode === 'hold' ? target : null} bandCents={BAND_CENTS} height="fill" />

        <div className="voice-hud">
          <div className="voice-readout">
            <span className={`voice-note readout${nearest !== null ? ' is-live' : ''}`}>
              {nearest !== null ? <NoteName label={label(nearest)} /> : '-'}
            </span>
            <span className="voice-cents readout">
              {cents !== null ? `${cents > 0 ? '+' : ''}${cents}¢${notation === 'sargam' ? ` · ${prettyNote(nearest!)}` : ''}` : isActive ? 'sing' : ''}
            </span>
          </div>
          <div className="voice-controls">
            <Segmented<Notation>
              value={notation}
              onChange={n => setVoice({ notation: n })}
              options={[{ value: 'names', label: 'C D E' }, { value: 'sargam', label: 'Sa Re' }]}
              size="sm"
            />
            {notation === 'sargam' && (
              <select className="select-field voice-sa" value={sa} onChange={e => setVoice({ sa: Number(e.target.value) })} aria-label="Sa">
                {SA_CHOICES.map(m => <option key={m} value={m}>Sa {prettyNote(m)}</option>)}
              </select>
            )}
          </div>
        </div>

        {isActive ? (
          <button onClick={stop} className="voice-stop" aria-label="Stop listening" title="Stop listening">
            <span className="tuner-stop-dot" aria-hidden="true" />
          </button>
        ) : (
          <div className="voice-start">
            <button onClick={start} className="btn btn-primary">Turn on the mic</button>
            
          </div>
        )}
        {error && <p className="micbar-error voice-error">{error}</p>}
      </section>

      <section className="glass-panel voice-dock">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'sing', label: 'Sing' },
            { value: 'hold', label: 'Hold a note' },
            { value: 'range', label: 'Range' }
          ]}
          size="sm"
          full
        />

        {mode === 'sing' && (
          <div className="voice-pane">
            <div className="voice-row">
              <button type="button" className={`btn${droning ? ' btn-primary' : ''}`} onClick={() => { audio.init(); setDroning(d => !d); }}>
                {droning ? <IconStop size={12} /> : <IconPlay size={12} />}
                {droning ? 'Stop drone' : `Drone on Sa · ${prettyNote(sa)}`}
              </button>
              <span className="voice-hint">Use headphones with the drone.</span>
            </div>
            
          </div>
        )}

        {mode === 'hold' && (
          <div className="voice-pane">
            <div className="voice-row voice-holdrow">
              <button type="button" className="btn voice-step" onClick={() => { setTarget(t => t - 1); holdRef.current.ms = 0; }} aria-label="One semitone lower">−</button>
              <div className="voice-target-note">
                <NoteName label={label(target)} className="voice-target-name" />
                {notation === 'sargam' && <span className="voice-hint">{prettyNote(target)}</span>}
              </div>
              <button type="button" className="btn voice-step" onClick={() => { setTarget(t => t + 1); holdRef.current.ms = 0; }} aria-label="One semitone higher">+</button>
              <button type="button" className="btn btn-primary" onClick={() => playReference()}>
                <IconPlay size={12} /> Hear it
              </button>
              <button type="button" className="btn" onClick={() => { setStreak(0); newTarget(); }}>New</button>
            </div>
            <div className="voice-hold-bar" aria-label={`Held ${Math.round(holdPct)}%`}><span style={{ width: `${holdPct}%` }} /></div>
            <div className="voice-stats readout">
              <span>Held <strong>{matched}</strong></span>
              <span>Streak <strong>{streak}</strong></span>
              <span>{lastResult ? `Last: steady to ±${lastResult.spread}¢` : `Hold in the green band`}</span>
            </div>
          </div>
        )}

        {mode === 'range' && (
          <div className="voice-pane">
            <div className="voice-row voice-rangerow">
              <div className="voice-rangeend">
                <span className="voice-target-label">Lowest</span>
                <span className="voice-range-note readout">{found ? <NoteName label={label(found.low)} /> : '-'}</span>
              </div>
              <div className="voice-rangeend">
                <span className="voice-target-label">Highest</span>
                <span className="voice-range-note readout">{found ? <NoteName label={label(found.high)} /> : '-'}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!found || found.high - found.low < 5}
                onClick={() => found && setVoice({ range: found })}
              >
                Save
              </button>
              <button type="button" className="btn" onClick={() => setFound(null)} disabled={!found}>Reset</button>
            </div>
            <p className="voice-hint">
              {found && found.high - found.low >= 5
                ? <>{found.high - found.low} semitones ({prettyNote(found.low)} to {prettyNote(found.high)}), closest to <strong>{closestVoiceType(found)}</strong>.</>
                : saved
                  ? <>Saved: <strong>{prettyNote(saved.low)} to {prettyNote(saved.high)}</strong>. Sing again to update it.</>
                  : 'Hold your lowest note, then your highest.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default VoiceTuner;
