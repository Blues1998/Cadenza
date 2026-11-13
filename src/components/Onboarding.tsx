import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { go } from '../hooks/useRoute';
import { useLibrary } from '../hooks/useLibrary';
import { createSong, getSongs } from '../utils/library';
import { setProfile, useProfile, type Level, type ProfileInstrument } from '../utils/profile';
import { useBackToClose } from '../utils/nativeShell';
import { BrandMark } from './Brand';

// The first three minutes.
//
// A new player used to land on a dashboard describing somebody else's month
// of practice. This asks the four things that change what the app should show
//what you play, whether you sing, how far along you are, which songs you
// want, and ends on the one thing every session should start with: a tuned
// instrument. Every step can be skipped; nothing here is required to use the
// app.

type Step = 'welcome' | 'instrument' | 'sing' | 'level' | 'songs' | 'ready';
const STEPS: Step[] = ['welcome', 'instrument', 'sing', 'level', 'songs', 'ready'];

const LEVELS: { value: Level; title: string; said: string }[] = [
  { value: 'new', title: 'Beginner', said: 'Just starting out' },
  { value: 'some', title: 'Some experience', said: 'I know a few chords' },
  { value: 'regular', title: 'Experienced', said: 'I play regularly' }
];

export const Onboarding: React.FC = () => {
  const ready = useLibrary();
  const profile = useProfile();
  const [step, setStep] = useState<Step>('welcome');
  const [drafts, setDrafts] = useState([{ title: '', artist: '' }, { title: '', artist: '' }, { title: '', artist: '' }]);
  const [busy, setBusy] = useState(false);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]);
  const back = useCallback(() => setStep(s => STEPS[Math.max(0, STEPS.indexOf(s) - 1)]), []);
  useBackToClose(!profile.onboarded && index > 0, back);
  // Run again from Me, it starts from the welcome, not wherever it ended.
  useEffect(() => { if (!profile.onboarded) setStep('welcome'); }, [profile.onboarded]);

  if (profile.onboarded || !ready) return null;

  const existing = getSongs().length;
  const instrumentName = profile.instrument === 'ukulele' ? 'ukulele' : 'guitar';

  const finish = (then: 'tuner' | 'today') => {
    setProfile({ onboarded: true });
    if (then === 'tuner') {
      try { localStorage.setItem('cadenza-tuner-mode', 'instrument'); } catch { /* fine */ }
      go({ tab: 'tuner', songId: null });
    } else {
      go({ tab: profile.level === 'new' ? 'journey' : 'dashboard', songId: null });
    }
  };

  const saveSongs = async () => {
    const wanted = drafts.filter(d => d.title.trim());
    setBusy(true);
    for (const d of wanted) await createSong({ title: d.title, artist: d.artist });
    setBusy(false);
    next();
  };

  const choice = <T,>(value: T, current: T, onPick: (v: T) => void, title: string, said: string, glyph?: React.ReactNode) => (
    <button
      type="button"
      className={`onb-choice${value === current ? ' is-on' : ''}`}
      aria-pressed={value === current}
      onClick={() => { onPick(value); next(); }}
    >
      {glyph && <span className="onb-glyph" aria-hidden="true">{glyph}</span>}
      <span className="onb-choice-text">
        <span className="onb-choice-title">{title}</span>
        <span className="onb-choice-said">{said}</span>
      </span>
    </button>
  );

  return createPortal(
    <div className="onb" role="dialog" aria-modal="true" aria-label="Welcome to Sharps&Flats">
      <div className="onb-top">
        {index > 0 ? (
          <button type="button" className="onb-link" onClick={back}>Back</button>
        ) : <span />}
        <div className="onb-dots" aria-hidden="true">
          {STEPS.map((s, i) => <span key={s} className={`onb-dot${i <= index ? ' is-on' : ''}`} />)}
        </div>
        {step !== 'ready' ? (
          <button type="button" className="onb-link" onClick={() => finish('today')}>Skip</button>
        ) : <span />}
      </div>

      <div className="onb-body" key={step}>
        {step === 'welcome' && (
          <>
            <span className="onb-mark" aria-hidden="true">
              <BrandMark />
            </span>
            <h1 className="onb-title">Learn the songs you love.</h1>
            <p className="onb-said">A few quick questions to set things up.</p>
            <button type="button" className="btn btn-primary onb-cta" onClick={next}>Get started</button>
          </>
        )}

        {step === 'instrument' && (
          <>
            <h1 className="onb-title">What do you play?</h1>
            <div className="onb-choices">
              {choice<ProfileInstrument>('guitar', profile.instrument, v => setProfile({ instrument: v }), 'Guitar', 'Acoustic or electric')}
              {choice<ProfileInstrument>('ukulele', profile.instrument, v => setProfile({ instrument: v }), 'Ukulele', 'Soprano, concert, tenor or baritone')}
            </div>
          </>
        )}

        {step === 'sing' && (
          <>
            <h1 className="onb-title">Do you sing too?</h1>
            <div className="onb-choices">
              {choice(true, profile.sings, v => setProfile({ sings: v }), 'Yes', 'We will find your vocal range')}
              {choice(false, profile.sings, v => setProfile({ sings: v }), 'No', 'Instrument only.')}
            </div>
          </>
        )}

        {step === 'level' && (
          <>
            <h1 className="onb-title">How far along are you?</h1>
            <div className="onb-choices">
              {LEVELS.map(l => (
                <React.Fragment key={l.value}>
                  {choice<Level>(l.value, profile.level, v => setProfile({ level: v }), l.title, l.said)}
                </React.Fragment>
              ))}
            </div>
          </>
        )}

        {step === 'songs' && (existing > 0 ? (
          <>
            <h1 className="onb-title">Your songs</h1>
            <p className="onb-said">{existing} song{existing === 1 ? '' : 's'} in your library.</p>
            <button type="button" className="btn btn-primary onb-cta" onClick={next}>Continue</button>
          </>
        ) : (
          <>
            <h1 className="onb-title">Which songs do you want to learn?</h1>
            <div className="onb-songs">
              {drafts.map((d, i) => (
                <div key={i} className="onb-song">
                  <input
                    className="text-field"
                    placeholder={['Song title', 'Another one', 'And one more'][i]}
                    value={d.title}
                    onChange={e => setDrafts(prev => prev.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)))}
                    aria-label={`Song ${i + 1} title`}
                  />
                  <input
                    className="text-field"
                    placeholder="Artist"
                    value={d.artist}
                    onChange={e => setDrafts(prev => prev.map((p, j) => (j === i ? { ...p, artist: e.target.value } : p)))}
                    aria-label={`Song ${i + 1} artist`}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-primary onb-cta" disabled={busy} onClick={() => void saveSongs()}>
              {drafts.some(d => d.title.trim()) ? 'Add songs' : 'Skip'}
            </button>
          </>
        ))}

        {step === 'ready' && (
          <>
            <h1 className="onb-title">Tune up</h1>
            <button type="button" className="btn btn-primary onb-cta" onClick={() => finish('tuner')}>
              Tune my {instrumentName}
            </button>
            <button type="button" className="onb-link" onClick={() => finish('today')}>
              {profile.level === 'new' ? 'Skip to the Journey' : 'Skip'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Onboarding;
