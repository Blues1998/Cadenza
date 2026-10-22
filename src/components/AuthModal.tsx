import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
    signOut
  } = useAuth();

  const [mode, setMode] = useState<'magic' | 'password' | 'signup'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          text: `Magic sign-in link sent to ${email.trim()}! Please check your inbox.`
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
          text: `Account created for ${email.trim()}! Please check your email to confirm.`
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

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className="auth-modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-modal-title-group">
            <span className="auth-cloud-badge">☁️</span>
            <div>
              <h2 className="auth-modal-title">
                {user ? 'Cloud Sync & Account' : 'Back Up & Sync to Cloud'}
              </h2>
              <p className="auth-modal-sub">
                {user
                  ? 'Your songs and practice data are backed up and synced.'
                  : 'Access your songs, charts, and practice logs from any device.'}
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
                        ? 'Sync error (retrying)'
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
                {syncStatus === 'syncing' ? '🔄 Syncing…' : '🔄 Sync Now'}
              </button>
              <button
                type="button"
                className="btn btn-secondary auth-signout-btn"
                onClick={signOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Not logged in form */
          <div className="auth-form-container">
            {/* Mode Segmented Controls */}
            <div className="auth-mode-tabs" role="tablist">
              <button
                type="button"
                className={`auth-mode-tab${mode === 'magic' ? ' is-active' : ''}`}
                onClick={() => { setMode('magic'); setMessage(null); }}
              >
                🪄 Magic Link (Zero Password)
              </button>
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
                {message.type === 'success' ? '✓ ' : '⚠️ '}
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
                  autoFocus
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
                    ? 'Send Magic Sign-in Link 🪄'
                    : mode === 'signup'
                      ? 'Create Free Account'
                      : 'Sign In to Cadenza'}
              </button>
            </form>

            <div className="auth-guest-notice">
              <span>💡 Free forever. Your local songs and chord charts merge automatically.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default AuthModal;
