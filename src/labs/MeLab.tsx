import React from 'react';
import { LabIcon } from '../components/LabIcon';
import { Segmented } from '../components/Segmented';
import { useAuth } from '../context/AuthContext';
import { go } from '../hooks/useRoute';
import type { Theme } from '../hooks/useTheme';
import { restartOnboarding, setProfile, useProfile, type ProfileInstrument } from '../utils/profile';
import { prettyNote, setVoice, useVoice, type Notation } from '../utils/voice';

// You: your account, and the handful of settings that shape the rest of the
// app. On a phone this is also where the theme switch and sign-in live, now
// that the tab bar has no room for a "More".

interface MeLabProps {
  theme: Theme;
  toggleTheme: () => void;
}

export const MeLab: React.FC<MeLabProps> = ({ theme, toggleTheme }) => {
  const { user, openAuthModal, syncStatus, lastSyncedAt } = useAuth();
  const profile = useProfile();
  const voice = useVoice();

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

      <section className="glass-panel me-card">
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
      </section>

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
    </div>
  );
};

export default MeLab;
