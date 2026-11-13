import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../utils/supabase';

// Where links in sign-up and magic-link emails send people back to. Inside the
// Android app the page's own origin is https://localhost, which means nothing
// outside the phone's WebView, so those links go to the hosted site instead.
const EMAIL_REDIRECT = Capacitor.isNativePlatform()
  ? 'https://blues1998.github.io/Cadenza/'
  : window.location.origin;
import { syncLibraryWithCloud, type SyncState } from '../utils/cloudSync';
import { ACCOUNTS_ENABLED } from '../utils/nativeShell';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  syncStatus: SyncState;
  lastSyncedAt: number | null;
  triggerSync: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // ?account in the address opens the account panel. It is the web link Google
  // Play asks for ("where can users delete their account"), and it lives in the
  // query string because the hash is the app's router.
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    if (!ACCOUNTS_ENABLED) return false;
    try { return new URLSearchParams(window.location.search).has('account'); } catch { return false; }
  });
  const [syncStatus, setSyncStatus] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) { setLoading(false); return; }
    // Tidy ?account out of the bar once it has done its job.
    const url = new URL(window.location.href);
    if (url.searchParams.has('account')) {
      url.searchParams.delete('account');
      window.history.replaceState(window.history.state, '', url.toString());
    }

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void syncLibraryWithCloud();
      }
    });

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void syncLibraryWithCloud();
      } else {
        setSyncStatus('idle');
      }
    });

    // 3. Listen to sync status events
    const handleSyncChange = (e: Event) => {
      const custom = e as CustomEvent<{ state: SyncState; lastSyncedAt: number | null }>;
      if (custom.detail) {
        setSyncStatus(custom.detail.state);
        if (custom.detail.lastSyncedAt) setLastSyncedAt(custom.detail.lastSyncedAt);
      }
    };

    window.addEventListener('cadenza-sync-change', handleSyncChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('cadenza-sync-change', handleSyncChange);
    };
  }, []);

  const openAuthModal = () => { if (ACCOUNTS_ENABLED) setIsAuthModalOpen(true); };
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const triggerSync = async (): Promise<boolean> => {
    return await syncLibraryWithCloud();
  };

  const signInWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setIsAuthModalOpen(false);
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: EMAIL_REDIRECT }
    });
    return { error };
  };

  const signInWithMagicLink = async (email: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: EMAIL_REDIRECT }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSyncStatus('idle');
  };

  // Deletes the account and everything synced to it (songs, practice
  // sessions), through the delete_my_account database function, see
  // supabase/migrations. Songs saved on this device are left alone: they were
  // never the account's, and deleting an account is not deleting the app.
  const deleteAccount = async (): Promise<{ error: Error | null }> => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { error: new Error(error.message) };
    // The user no longer exists, so a server-side sign-out would only fail;
    // clearing the stored session is all that is left to do.
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
    setSyncStatus('idle');
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        syncStatus,
        lastSyncedAt,
        triggerSync,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signOut,
        deleteAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
