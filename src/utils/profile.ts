// What onboarding learned about the player, kept on this device.
//
// Small on purpose: three answers that change what the app shows first. The
// instrument is also written to the tuner's own key, so choosing ukulele here
// is the same as choosing it on the tuner.

import { useSyncExternalStore } from 'react';

export type Level = 'new' | 'some' | 'regular';
export type ProfileInstrument = 'guitar' | 'ukulele';

export interface Profile {
  instrument: ProfileInstrument;
  sings: boolean;
  level: Level;
  /** Set once the welcome has been finished or skipped. */
  onboarded: boolean;
}

const KEY = 'cadenza-profile';
const INSTRUMENT_KEY = 'cadenza-instrument'; // shared with the tuner
const DEFAULT: Profile = { instrument: 'guitar', sings: true, level: 'some', onboarded: false };

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Profile>) : {};
    const instrument = localStorage.getItem(INSTRUMENT_KEY) === 'ukulele' ? 'ukulele' : stored.instrument ?? 'guitar';
    return { ...DEFAULT, ...stored, instrument };
  } catch {
    return DEFAULT;
  }
}

let profile = load();
const listeners = new Set<() => void>();

export function setProfile(patch: Partial<Profile>): void {
  profile = { ...profile, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    if (patch.instrument) localStorage.setItem(INSTRUMENT_KEY, patch.instrument);
  } catch { /* this session only */ }
  listeners.forEach(l => l());
}

export const getProfile = (): Profile => profile;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => profile;
export const useProfile = (): Profile => useSyncExternalStore(subscribe, snapshot);

/** Show the welcome again (from Me → Run setup again). */
export const restartOnboarding = () => setProfile({ onboarded: false });
