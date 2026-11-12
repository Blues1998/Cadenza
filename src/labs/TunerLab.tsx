import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Segmented } from '../components/Segmented';
import { LabIcon } from '../components/LabIcon';
import { TunerDial } from '../components/TunerDial';
import { VoiceTuner } from '../components/VoiceTuner';
import { IconCheck } from '../components/Icons';
import { useMicPitch } from '../hooks/useMicPitch';
import { useSpringValue } from '../hooks/useSpringValue';
import { audio } from '../utils/audio';
import { HOLD_MS, INSTRUMENTS, IN_TUNE_CENTS, TUNINGS, nearestString, stringsOf, tuningsFor, type Instrument } from '../utils/tuning';
import { reportProgress } from '../utils/progress';

const TUNING_KEY = 'cadenza-tuning';
const INSTRUMENT_KEY = 'cadenza-instrument';
// Guitar keeps the original key so a saved guitar tuning survives the upgrade.
const tuningKeyFor = (instrument: Instrument) => instrument === 'guitar' ? TUNING_KEY : `${TUNING_KEY}-${instrument}`;
const readStored = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const storedTuningFor = (instrument: Instrument): string => {
  const options = tuningsFor(instrument);
  const saved = readStored(tuningKeyFor(instrument));
  return options.some(t => t.id === saved) ? saved! : options[0].id;
};

const MODE_KEY = 'cadenza-tuner-mode';

/**
 * Size an element to exactly the screen that is left below its top edge, so
 * the tuner is one page with nothing to scroll: the space between the top bar
 * and the tab bar on a phone, or down to the window's edge on a desktop.
 * Measured live rather than guessed in CSS, because what sits above it varies
 * (a practice run puts its bar there) and the shell's bottom padding is what
 * keeps content clear of the phone's tab bar.
 */
function useFitViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest('.main-content') as HTMLElement | null;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const below = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      // Below this the controls stop fitting; a short landscape phone scrolls instead.
      el.style.height = `${Math.max(460, window.innerHeight - top - below)}px`;
    };
    fit();
    // Once more after the page's entrance animation, which measures 6px low.
    const settle = window.setTimeout(fit, 300);
    window.scrollTo(0, 0);
    const observer = new ResizeObserver(fit);
    if (main) observer.observe(main);
    window.addEventListener('resize', fit);
    return () => { window.clearTimeout(settle); observer.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return ref;
}
type TunerMode = 'instrument' | 'voice';

/**
 * Two tuners behind one switch: strings, read by a needle, and a voice, read
 * by a trace. The pitch-matching game that used to sit beside the strings is
 * now Voice → Hold a note, where it can draw what the voice is doing.
 */
export const TunerLab: React.FC = () => {
  const [mode, setMode] = useState<TunerMode>(() => (readStored(MODE_KEY) === 'voice' ? 'voice' : 'instrument'));
  const pick = (next: TunerMode) => {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* not worth failing over */ }
  };

  const pageRef = useFitViewport<HTMLDivElement>();

  return (
    <div className="lab-narrow tunerpage" ref={pageRef}>
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="tuner" />Pitch &amp; Tuner</h2>
      </div>
      <Segmented<TunerMode>
        value={mode}
        onChange={pick}
        options={[{ value: 'instrument', label: 'Instrument' }, { value: 'voice', label: 'Voice' }]}
        full
      />
      {/* Keyed so switching tears one mic pipeline down before the other starts. */}
      {mode === 'instrument' ? <InstrumentTuner key="instrument" /> : <VoiceTuner key="voice" />}
    </div>
  );
};

const InstrumentTuner: React.FC = () => {
  // Shared microphone + YIN pitch detection pipeline
  const {
    pitch: pitchData,
    isActive: isMicrophoneActive,
    error: micError,
    start: initMicrophone,
    stop: stopMicrophone
  } = useMicPitch();

  // The gauge runs on a sprung value rather than the raw estimate. Pitch
  // detection re-reads every audio frame and its output jitters by a few cents
  // even on a perfectly steady note, so the needle used to teleport and read as
  // noise. The spring low-passes that away and settles like a real meter.
  //
  // Only the gauge is smoothed. The matching game below still judges the raw
  // estimate, so what it accepts is not softened by a display decision.
  // ---- tuning up, as a thing with a finish line -------------------------
  // Every string, ticked off as each one is held in tune. The app's own
  // counters all report a level; this one reports a job you can finish, which
  // is the only shape "tune up" has ever had.
  const [tuned, setTuned] = useState<Record<number, boolean>>({});
  const settling = useRef<{ string: number; since: number } | null>(null);

  // Which tuning the guitar is in. Kept across visits, because somebody who
  // plays in DADGAD plays in DADGAD, and re-picking it every time you sit
  // down is the app forgetting something it was told.
  // Guitar or ukulele, remembered the same way; each keeps its own tuning so
  // flipping between them does not lose either.
  const [instrument, setInstrument] = useState<Instrument>(() =>
    readStored(INSTRUMENT_KEY) === 'ukulele' ? 'ukulele' : 'guitar'
  );
  const [tuningId, setTuningId] = useState<string>(() => storedTuningFor(instrument));
  const tuning = TUNINGS.find(t => t.id === tuningId) ?? tuningsFor(instrument)[0];
  const targets = useMemo(() => stringsOf(tuning), [tuning]);
  const pickTuning = (id: string) => {
    setTuningId(id);
    setTuned({});
    settling.current = null;
    try { localStorage.setItem(tuningKeyFor(instrument), id); } catch { /* a blocked store is not worth failing over */ }
  };
  const pickInstrument = (next: Instrument) => {
    if (next === instrument) return;
    setInstrument(next);
    setTuningId(storedTuningFor(next));
    setTuned({});
    settling.current = null;
    try { localStorage.setItem(INSTRUMENT_KEY, next); } catch { /* as above */ }
  };

  // Which string this is, and how far off *it*, not off the nearest note in
  // the chromatic scale. See utils/tuning.ts: the two answers disagree exactly
  // when a string is worst out, which is the moment a tuner has to be useful.
  const onString = pitchData ? nearestString(pitchData.frequency, targets) : null;
  const readCents = pitchData ? (onString ? onString.cents : pitchData.cents) : null;
  const readNote = onString ? onString.target.name : pitchData?.note ?? null;

  const lastCentsRef = useRef<number>(0);
  if (readCents !== null) lastCentsRef.current = readCents;
  // Held rather than recentred through a silent frame, so a gap in detection
  // does not swing the needle to "in tune" and back.
  const springedCents = useSpringValue(readCents !== null ? readCents : lastCentsRef.current);
  const gaugeCents = Math.max(-50, Math.min(50, springedCents));
  const gaugeInTune = Math.abs(gaugeCents) <= IN_TUNE_CENTS;

  useEffect(() => {
    if (!isMicrophoneActive) return;
    // Judged on the raw estimate, not the sprung one: the needle is smoothed
    // because a display should be, and a tick is a claim.
    const here = pitchData ? nearestString(pitchData.frequency, targets) : null;
    if (!here || Math.abs(here.cents) > IN_TUNE_CENTS) {
      settling.current = null;
      return;
    }
    const now = Date.now();
    if (settling.current?.string !== here.target.number) {
      settling.current = { string: here.target.number, since: now };
      return;
    }
    if (now - settling.current.since >= HOLD_MS) {
      setTuned(done => (done[here.target.number] ? done : { ...done, [here.target.number]: true }));
    }
  }, [pitchData, isMicrophoneActive, targets]);

  // A fresh guitar each time the mic comes on: whatever was in tune last week
  // is a claim about a different afternoon.
  useEffect(() => {
    if (!isMicrophoneActive) { setTuned({}); settling.current = null; }
  }, [isMicrophoneActive]);

  const tunedCount = targets.filter(target => tuned[target.number]).length;

  const reportedPitchRef = useRef<boolean>(false); // journey event fired this session

  // Journey: the first time the tuner successfully hears a pitch
  useEffect(() => {
    if (pitchData && !reportedPitchRef.current) {
      reportedPitchRef.current = true;
      reportProgress('tuner-pitch-detected');
    }
  }, [pitchData]);

  // (Mic teardown on unmount is handled inside useMicPitch)

  return (
    <div className="tunerstack">
      {/* The meter fills whatever the screen has left. Before permission it is
          here all the same, greyed and inert: "allow your microphone" is an
          easier yes when you can see what it is for. */}
      <section className={`glass-panel tunerface${isMicrophoneActive ? '' : ' is-off'}`}>
        <div className="tunerface-meter" aria-hidden={!isMicrophoneActive}>
          <div className="tuner-note">
            <span className={`tuner-note-name readout${pitchData ? (gaugeInTune ? ' is-home' : ' is-live') : ''}`}>
              {readNote ?? '-'}
            </span>
            <span className="tuner-note-hz readout">
              {pitchData ? `${pitchData.frequency.toFixed(1)} Hz` : isMicrophoneActive ? 'silent' : 'not listening'}
            </span>
          </div>

          <TunerDial cents={pitchData ? gaugeCents : null} inTune={Boolean(pitchData) && gaugeInTune} />

          <span className={`tuner-off readout${pitchData && gaugeInTune ? ' is-home' : ''}`}>
            {pitchData
              ? gaugeInTune
                ? onString ? `${onString.target.ordinal} string is there` : 'in tune'
                // The needle pins at the end of the dial; the words do not.
                : `${springedCents > 0 ? '+' : ''}${Math.round(springedCents)} cents${onString ? ` off ${onString.target.name}` : ''}`
              : isMicrophoneActive ? 'Play a string' : ''}
          </span>
        </div>

        {isMicrophoneActive ? (
          <button onClick={stopMicrophone} className="btn tuner-stop">
            <span className="tuner-stop-dot" aria-hidden="true" />
            Stop listening
          </button>
        ) : (
          <button onClick={initMicrophone} className="btn btn-primary tuner-start">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Turn on the mic
          </button>
        )}
        {micError && <p className="micbar-error">{micError}</p>}
      </section>

      {/* The strings: the reference you read while turning a peg, and once the
          tuner can hear, the thing that ticks off. Tuning up is a job with an
          end, so the label reports how much of it is left. */}
      <section className="glass-panel strings tunerdock">
        <div className="surface-label">
          <span>{tuning.name}</span>
          <span className="readout">
            {isMicrophoneActive
              ? tunedCount === targets.length ? `all ${targets.length === 4 ? 'four' : 'six'} in tune` : `${tunedCount} of ${targets.length} in tune`
              : 'tap a string to hear it'}
          </span>
          {isMicrophoneActive && tunedCount > 0 && (
            <button type="button" className="strings-again" onClick={() => setTuned({})}>Start again</button>
          )}
        </div>
        <div className={`strings-row${targets.length === 4 ? ' is-four' : ''}`}>
          {targets.map(target => {
            const here = isMicrophoneActive && onString?.target.number === target.number;
            const done = tuned[target.number];
            return (
              <button
                type="button"
                key={target.number}
                className={`stringcard${here ? ' is-here' : ''}${done ? ' is-done' : ''}`}
                title={`${target.ordinal} string · ${target.hz.toFixed(1)} Hz · press to hear it`}
                onClick={() => { audio.init(); audio.playMidi(target.midi, 2.5); }}
              >
                <span className="stringcard-ord">{target.ordinal}</span>
                <span className="stringcard-note">{target.name}</span>
                <span className="stringcard-hz readout">
                  {here && pitchData
                    ? `${onString.cents > 0 ? '+' : ''}${Math.round(onString.cents)}c`
                    : `${target.hz.toFixed(1)} Hz`}
                </span>
                {done && <span className="stringcard-tick" aria-label="in tune"><IconCheck size={11} /></span>}
              </button>
            );
          })}
        </div>
        <div className="tunerdock-pickers">
          <Segmented<Instrument>
            value={instrument}
            onChange={pickInstrument}
            options={INSTRUMENTS.map(i => ({ value: i.id, label: i.name }))}
            size="sm"
          />
          <select
            className="select-field"
            value={tuningId}
            onChange={e => pickTuning(e.target.value)}
            aria-label="Tuning"
            title={tuning.note}
          >
            {tuningsFor(instrument).map(t => <option key={t.id} value={t.id}>{t.name} · {t.strings}</option>)}
          </select>
        </div>
      </section>
    </div>
  );
};

export default TunerLab;
