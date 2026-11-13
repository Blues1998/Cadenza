import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ACCOUNTS_ENABLED } from '../utils/nativeShell';

interface AccountButtonProps {
  collapsed?: boolean;
}

export const AccountButton: React.FC<AccountButtonProps> = ({ collapsed = false }) => {
  const { user, openAuthModal, syncStatus } = useAuth();
  if (!ACCOUNTS_ENABLED) return null;

  return (
    <button
      type="button"
      className={`account-nav-btn${collapsed ? ' is-collapsed' : ''}${user ? ' is-authenticated' : ''}`}
      onClick={openAuthModal}
      title={
        user
          ? `Signed in as ${user.email} (${syncStatus === 'synced' ? 'Synced' : syncStatus})`
          : 'Back up your songs'
      }
      aria-label={user ? 'Account' : 'Sign in'}
    >
      <div className="account-avatar-wrapper">
        {user ? (
          <span className="account-avatar-badge">
            {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </span>
        ) : (
          <svg className="account-cloud-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
        )}
        <span className={`sync-status-indicator is-${syncStatus}`} />
      </div>

      {!collapsed && (
        <div className="account-label-group">
          <span className="account-main-label">
            {user ? (user.email ? user.email.split('@')[0] : 'Account') : 'Sign in'}
          </span>
          <span className="account-sub-label">
            {user
              ? syncStatus === 'syncing'
                ? 'Syncing…'
                : 'Synced'
              : 'Back up your songs'}
          </span>
        </div>
      )}
    </button>
  );
};

export default AccountButton;
