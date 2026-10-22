import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { syncLibraryWithCloud, type SyncState } from '../utils/cloudSync';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
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

  const openAuthModal = () => setIsAuthModalOpen(true);
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
      options: { emailRedirectTo: window.location.origin }
    });
    return { error };
  };

  const signInWithMagicLink = async (email: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSyncStatus('idle');
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
        signOut
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
