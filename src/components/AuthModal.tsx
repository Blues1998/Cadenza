import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { useBackToClose } from '../utils/nativeShell';

// Inside the Android app a magic link would open the website, not the app, so
// the app signs in with a password and doesn't offer the link at all.
const NATIVE = Capacitor.isNativePlatform();
// On a touch screen, focusing the field on open throws a keyboard over half
// the dialog before you have read it.
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthModalOpen,
    closeAuthModal,
    syncStatus,
    lastSyncedAt,
    triggerSync,
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    signOut,
    deleteAccount
  } = useAuth();

  const [mode, setMode] = useState<'magic' | 'password' | 'signup'>(NATIVE ? 'password' : 'magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Deleting is two presses, the second on a button that says exactly what it does.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useBackToClose(isAuthModalOpen, closeAuthModal);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email.trim());
        if (error) throw error;
        setMessage({
          type: 'success',
          text: `Sign-in link sent to ${email.trim()}.`
        });
      } else if (mode === 'password') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
          setSubmitting(false);
          return;
        }
        const { error } = await signUpWithEmail(email.trim(), password);
        if (error) throw error;
        setMessage({
          type: 'success',
          text: `Account created. Check ${email.trim()} to confirm.`
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during authentication.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncNow = async () => {
    setSubmitting(true);
    await triggerSync();
    setSubmitting(false);
  };

  const handleDeleteAccount = async () => {
    setSubmitting(true);
    setDeleteError(null);
    const { error } = await deleteAccount();
    setSubmitting(false);
    if (error) {
      setDeleteError(`Couldn't delete the account: ${error.message}`);
      return;
    }
    setConfirmingDelete(false);
    setMessage({ type: 'success', text: 'Your account and its cloud backup have been deleted.' });
  };

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className="auth-modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-modal-title-group">
            <div>
              <h2 className="auth-modal-title">
                {user ? 'Account' : 'Back up your songs'}
              </h2>
              <p className="auth-modal-sub">
                {user
                  ? 'Your songs and practice are backed up.'
                  : 'Sign in to use them on any device.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            onClick={closeAuthModal}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Logged in state */}
        {user ? (
          <div className="auth-user-dashboard">
            <div className="auth-user-card">
              <div className="auth-user-avatar">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="auth-user-info">
                <span className="auth-user-email">{user.email}</span>
                <span className="auth-sync-status">
                  <span className={`sync-dot is-${syncStatus}`} />
                  {syncStatus === 'syncing'
                    ? 'Syncing with cloud…'
                    : syncStatus === 'synced'
                      ? `Synced at ${formattedSyncTime}`
                      : syncStatus === 'error'
                        ? 'Sync failed. Retrying.'
                        : 'Ready'}
                </span>
              </div>
            </div>

            <div className="auth-action-row">
              <button
                type="button"
                className="btn btn-primary auth-sync-btn"
                onClick={handleSyncNow}
                disabled={submitting || syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                type="button"
                className="btn btn-secondary auth-signout-btn"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>

            {confirmingDelete ? (
              <div className="auth-delete-confirm" role="alertdialog" aria-label="Delete account">
                <p>
                  Deletes your account and its backup. This can't be undone. Songs on this device stay.
                </p>
                {deleteError && <div className="auth-alert is-error">{deleteError}</div>}
                <div className="auth-action-row">
                  <button
                    type="button"
                    className="btn auth-delete-btn"
                    onClick={handleDeleteAccount}
                    disabled={submitting}
                  >
                    {submitting ? 'Deleting…' : 'Delete my account'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setConfirmingDelete(false); setDeleteError(null); }}
                    disabled={submitting}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="auth-delete-link"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete account…
              </button>
            )}
          </div>
        ) : (
          /* Not logged in form */
          <div className="auth-form-container">
            {/* Mode Segmented Controls */}
            <div className="auth-mode-tabs" role="tablist">
              {!NATIVE && <button
                type="button"
                className={`auth-mode-tab${mode === 'magic' ? ' is-active' : ''}`}
                onClick={() => { setMode('magic'); setMessage(null); }}
              >
                Email link
              </button>}
              <button
                type="button"
                className={`auth-mode-tab${mode === 'password' ? ' is-active' : ''}`}
                onClick={() => { setMode('password'); setMessage(null); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-tab${mode === 'signup' ? ' is-active' : ''}`}
                onClick={() => { setMode('signup'); setMessage(null); }}
              >
                Sign Up
              </button>
            </div>

            {/* Notifications */}
            {message && (
              <div className={`auth-alert is-${message.type}`}>
                
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <span className="auth-label">Email Address</span>
                <input
                  type="email"
                  className="text-field auth-input"
                  placeholder="musician@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus={!TOUCH}
                />
              </label>

              {mode !== 'magic' && (
                <label className="auth-field">
                  <span className="auth-label">Password</span>
                  <input
                    type="password"
                    className="text-field auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </label>
              )}

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={submitting}
              >
                {submitting
                  ? 'Please wait…'
                  : mode === 'magic'
                    ? 'Send sign-in link'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Sign in'}
              </button>
            </form>

            <div className="auth-guest-notice">
              <span>Free. Songs on this device are kept and merged.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default AuthModal;
