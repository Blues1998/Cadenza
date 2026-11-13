import React, { useEffect, useRef, useState } from 'react';
import { PitchTrace } from './PitchTrace';
import { NoteName } from './VoiceTuner';
import { useMicPitch } from '../hooks/useMicPitch';
import { go } from '../hooks/useRoute';
import { scoreLine } from '../utils/fit';
import { labelFor, prettyNote, rangeOf, setSongRange, songRangeNow, useVoice, voiceFit, type Range } from '../utils/voice';
import type { Song } from '../utils/library';

// Does this song sit in your voice, and if not, where should it go?
//
// The melody's range is not written down anywhere in the library, so it is
// measured: sing the song once and the app keeps the lowest and highest notes
// you actually used (percentiles, so a cracked note does not count). Against
// the range from Tuner → Voice → Range that gives a clear answer, and the
// guitar side of the answer comes from the same chord-comfort ranking the Fit
// panel uses.
//
// It only advises. Moving a song's pitch takes it away from the record, which
// is a real decision; the Fit panel above is where capo changes are applied.

const semis = (n: number) => `${n} semitone${n === 1 ? '' : 's'}`;

const Capture: React.FC<{ onDone: (range: Range | null) => void }> = ({ onDone }) => {
  const { pitch, isActive, error, start, stop } = useMicPitch('voice');
  const { notation, sa } = useVoice();
  const samples = useRef<number[]>([]);
  // Time actually sung, by the clock, frames are 60 a second on one phone
  // and 120 on the next.
  const voiced = useRef({ ms: 0, last: 0 });
  const [seconds, setSeconds] = useState(0);
  const live = pitch ? 12 * Math.log2(pitch.frequency / 440) + 69 : null;

  useEffect(() => { void start(); }, [start]);
  useEffect(() => {
    if (live === null) { voiced.current.last = 0; return; }
    samples.current.push(live);
    const now = performance.now();
    const v = voiced.current;
    if (v.last) v.ms += Math.min(100, now - v.last);
    v.last = now;
    setSeconds(Math.round(v.ms / 1000));
  }, [live]);

  return (
    <div className="voice-capture">
      <p className="fit-note">
        Sing the lowest and highest parts, then tap Done.
      </p>
      <PitchTrace pitch={live} notation={notation} sa={sa} height={150} />
      <div className="voice-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={seconds < 3}
          onClick={() => { stop(); onDone(rangeOf(samples.current)); }}
        >
          Done{seconds > 0 ? ` · ${seconds}s sung` : ''}
        </button>
        <button type="button" className="btn" onClick={() => { stop(); onDone(null); }}>Cancel</button>
        {!isActive && !error && <span className="voice-hint">Starting the mic…</span>}
      </div>
      {error && <p className="micbar-error">{error}</p>}
    </div>
  );
};

export const VoicePanel: React.FC<{ song: Song }> = ({ song }) => {
  const voice = useVoice();
  const [capturing, setCapturing] = useState(false);
  const songRange = songRangeNow(song, voice.songs[song.id]);
  const capo = song.capo ?? 0;
  const label = (m: number) => labelFor(m, voice.notation, voice.sa);

  const nudge = (end: 'low' | 'high', by: number) => {
    if (!songRange) return;
    const next = { ...songRange, [end]: songRange[end] + by };
    if (next.high > next.low) setSongRange(song.id, next, capo);
  };

  const toRange = () => {
    try { localStorage.setItem('cadenza-tuner-mode', 'voice'); } catch { /* fine */ }
    go({ tab: 'tuner', songId: null });
  };

  const fit = songRange && voice.range ? voiceFit(song, songRange, voice.range) : null;
  const shapes = fit?.option ? [...new Set(fit.option.chords.map(c => c.to))] : [];

  return (
    <section className="song-panel voicefit">
      <div className="surface-label">
        <span>Voice</span>
        <span className="readout">{songRange ? `${prettyNote(songRange.low)} to ${prettyNote(songRange.high)}` : 'not measured'}</span>
      </div>

      {capturing ? (
        <Capture onDone={range => { setCapturing(false); if (range) setSongRange(song.id, range, capo); }} />
      ) : !songRange ? (
        <>
          <p className="fit-note">
            Sing the song once to check it fits your voice.
          </p>
          <div className="voice-row">
            <button type="button" className="btn btn-secondary" onClick={() => setCapturing(true)}>Sing it to measure</button>
          </div>
        </>
      ) : (
        <>
          <div className="voicefit-range">
            {(['low', 'high'] as const).map(end => (
              <div key={end} className="voicefit-end">
                <span className="voice-target-label">{end === 'low' ? 'Lowest' : 'Highest'}</span>
                <div className="voicefit-step">
                  <button type="button" className="btn voice-step" onClick={() => nudge(end, -1)} aria-label={`${end === 'low' ? 'Lowest' : 'Highest'} note down a semitone`}>−</button>
                  <span className="readout"><NoteName label={label(songRange[end])} /></span>
                  <button type="button" className="btn voice-step" onClick={() => nudge(end, 1)} aria-label={`${end === 'low' ? 'Lowest' : 'Highest'} note up a semitone`}>+</button>
                </div>
              </div>
            ))}
          </div>

          {!voice.range ? (
            <p className="fit-note">
              To see whether this fits your voice, <button type="button" className="linklike" onClick={toRange}>find your range</button> in
              the tuner first.
            </p>
          ) : fit && fit.verdict === 'fits' ? (
            <p className="voicefit-verdict is-good">
              Sits inside your range ({prettyNote(voice.range.low)} to {prettyNote(voice.range.high)}). Sing it as it is.
            </p>
          ) : fit ? (
            <div className="voicefit-verdict">
              <p>
                {fit.verdict === 'high' && <>Goes {semis(songRange.high - voice.range.high)} above your range. </>}
                {fit.verdict === 'low' && <>Goes {semis(voice.range.low - songRange.low)} below your range. </>}
                {fit.verdict === 'wide' && <>The melody spans {songRange.high - songRange.low} semitones, wider than your {voice.range.high - voice.range.low}. Best compromise: </>}
                <strong>Move it {semis(Math.abs(fit.shift))} {fit.shift < 0 ? 'lower' : 'higher'}</strong>
                {fit.newKey && <> ({song.key} to <strong>{fit.newKey}</strong>)</>}.
              </p>
              {fit.option && (
                <p className="fit-note">
                  On guitar: {fit.option.capo === 0 ? 'no capo' : `capo ${fit.option.capo}`}, playing{' '}
                  <span className="readout">{shapes.join(' · ')}</span> ({scoreLine(fit.option)}).
                </p>
              )}
              <p className="fit-note">A new key won't play along with the original recording.</p>
            </div>
          ) : null}

          <div className="voice-row">
            <button type="button" className="btn" onClick={() => setCapturing(true)}>Measure again</button>
            <button type="button" className="btn" onClick={() => setSongRange(song.id, null)}>Clear</button>
          </div>
        </>
      )}
    </section>
  );
};

export default VoicePanel;
