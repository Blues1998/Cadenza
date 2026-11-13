import React from 'react';
import { LabIcon } from '../components/LabIcon';
import { Segmented } from '../components/Segmented';
import { PRIVACY_URL } from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { ACCOUNTS_ENABLED } from '../utils/nativeShell';
import { HAS_HAPTICS, setHaptics, useHaptics } from '../utils/haptics';
import { go } from '../hooks/useRoute';
import type { Theme } from '../hooks/useTheme';
import { restartOnboarding, setProfile, useProfile, type ProfileInstrument } from '../utils/profile';
import { prettyNote, setVoice, useVoice, type Notation } from '../utils/voice';

// You: your account, and the handful of settings that shape the rest of the
// app. On a phone this is also where the theme switch and sign-in live, now
// that the tab bar has no room for a "More".

// Everything the app ships that someone else made, and the terms it came on.
const CREDITS: { name: string; what: string; licence: string }[] = [
  { name: 'Meta Open Sound', what: 'Nylon and steel guitar recordings', licence: 'CC0, public domain' },
  { name: 'FreePats', what: 'Electric guitar recordings', licence: 'CC0, public domain' },
  { name: 'Sonivox EAS', what: 'Backing instrument sounds in the Tab Player', licence: 'Apache License 2.0' },
  { name: 'alphaTab', what: 'Tab rendering and playback, unmodified, source at github.com/CoderLine/alphaTab', licence: 'Mozilla Public License 2.0' },
  { name: 'Bravura', what: 'Music notation font', licence: 'SIL Open Font License 1.1' },
  { name: 'Geist, Space Grotesk, JetBrains Mono', what: 'Typefaces', licence: 'SIL Open Font License 1.1' },
  { name: 'React', what: 'Interface library', licence: 'MIT License' },
  { name: 'Capacitor', what: 'Android app shell', licence: 'MIT License' },
  { name: 'Supabase JS', what: 'Account backup on the website', licence: 'MIT License' }
];

interface MeLabProps {
  theme: Theme;
  toggleTheme: () => void;
}

export const MeLab: React.FC<MeLabProps> = ({ theme, toggleTheme }) => {
  const { user, openAuthModal, syncStatus, lastSyncedAt } = useAuth();
  const profile = useProfile();
  const voice = useVoice();
  const haptics = useHaptics();

  const toVoiceRange = () => {
    try { localStorage.setItem('cadenza-tuner-mode', 'voice'); } catch { /* fine */ }
    go({ tab: 'tuner', songId: null });
  };

  const synced = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="lab-narrow me">
      <div className="lab-header">
        <h2 className="lab-title"><LabIcon tab="me" />Me</h2>
      </div>

      {ACCOUNTS_ENABLED && <section className="glass-panel me-card">
        <div className="me-account">
          <span className={`me-avatar${user ? ' is-in' : ''}`} aria-hidden="true">
            {user?.email ? user.email.charAt(0).toUpperCase() : '?'}
          </span>
          <div className="me-account-text">
            <span className="me-account-name">{user ? user.email : 'Not signed in'}</span>
            <span className="me-account-sub">
              {user
                ? syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync failed. Retrying.' : synced ? `Backed up at ${synced}` : 'Backed up'
                : 'Songs are saved on this device only'}
            </span>
          </div>
        </div>
        <button type="button" className={`btn${user ? '' : ' btn-primary'}`} onClick={openAuthModal}>
          {user ? 'Account & sync' : 'Sign in to back up'}
        </button>
      </section>}

      <section className="glass-panel me-card me-settings">
        <h3 className="me-heading">Preferences</h3>

        <div className="me-row">
          <span className="me-row-label">Instrument</span>
          <Segmented<ProfileInstrument>
            value={profile.instrument}
            onChange={instrument => setProfile({ instrument })}
            options={[{ value: 'guitar', label: 'Guitar' }, { value: 'ukulele', label: 'Ukulele' }]}
            size="sm"
          />
        </div>

        <div className="me-row">
          <span className="me-row-label">Note names</span>
          <Segmented<Notation>
            value={voice.notation}
            onChange={notation => setVoice({ notation })}
            options={[{ value: 'names', label: 'C D E' }, { value: 'sargam', label: 'Sa Re Ga' }]}
            size="sm"
          />
        </div>

        <div className="me-row">
          <span className="me-row-label">Theme</span>
          <Segmented<Theme>
            value={theme}
            onChange={next => { if (next !== theme) toggleTheme(); }}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
            size="sm"
          />
        </div>

        {HAS_HAPTICS && (
          <div className="me-row">
            <span className="me-row-label">Haptics</span>
            <Segmented<boolean>
              value={haptics}
              onChange={setHaptics}
              options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]}
              size="sm"
            />
          </div>
        )}

        <div className="me-row">
          <span className="me-row-label">
            Your voice
            <span className="me-row-sub">
              {voice.range ? `${prettyNote(voice.range.low)} to ${prettyNote(voice.range.high)}` : 'Not measured'}
            </span>
          </span>
          <button type="button" className="btn" onClick={toVoiceRange}>{voice.range ? 'Measure again' : 'Find my range'}</button>
        </div>
      </section>

      <section className="glass-panel me-card">
        <div className="me-account-text">
          <span className="me-account-name">Welcome setup</span>
          <span className="me-account-sub">Instrument, level and songs</span>
        </div>
        <button type="button" className="btn" onClick={restartOnboarding}>Run it again</button>
      </section>

      <section className="glass-panel me-card me-settings">
        <h3 className="me-heading">About</h3>
        <div className="me-row">
          <span className="me-row-label">
            Sharps&amp;Flats
            <span className="me-row-sub">Version {__APP_VERSION__}</span>
          </span>
        </div>
        <div className="me-row">
          <span className="me-row-label">
            Privacy
            <span className="me-row-sub">Everything stays on this device</span>
          </span>
          <a className="btn" href={PRIVACY_URL} target="_blank" rel="noreferrer">Read policy</a>
        </div>
        <details className="me-licences">
          <summary className="me-row">
            <span className="me-row-label">
              Credits and licences
              <span className="me-row-sub">Sounds, fonts and code we build on</span>
            </span>
          </summary>
          <dl>
            {CREDITS.map(c => (
              <div key={c.name}>
                <dt>{c.name}</dt>
                <dd>{c.what}. {c.licence}.</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </div>
  );
};

export default MeLab;
