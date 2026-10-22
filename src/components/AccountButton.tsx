import React from 'react';
import { useAuth } from '../context/AuthContext';

interface AccountButtonProps {
  collapsed?: boolean;
}

export const AccountButton: React.FC<AccountButtonProps> = ({ collapsed = false }) => {
  const { user, openAuthModal, syncStatus } = useAuth();

  return (
    <button
      type="button"
      className={`account-nav-btn${collapsed ? ' is-collapsed' : ''}${user ? ' is-authenticated' : ''}`}
      onClick={openAuthModal}
      title={
        user
          ? `Signed in as ${user.email} (${syncStatus === 'synced' ? 'Synced' : syncStatus})`
          : 'Back up songs & sync to cloud (Free)'
      }
      aria-label={user ? 'Account and Sync' : 'Sign In and Sync'}
    >
      <div className="account-avatar-wrapper">
        {user ? (
          <span className="account-avatar-badge">
            {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </span>
        ) : (
          <span className="account-cloud-icon">☁️</span>
        )}
        <span className={`sync-status-indicator is-${syncStatus}`} />
      </div>

      {!collapsed && (
        <div className="account-label-group">
          <span className="account-main-label">
            {user ? (user.email ? user.email.split('@')[0] : 'Account') : 'Cloud Sync'}
          </span>
          <span className="account-sub-label">
            {user
              ? syncStatus === 'syncing'
                ? 'Syncing…'
                : 'Synced'
              : 'Sign In / Backup'}
          </span>
        </div>
      )}
    </button>
  );
};

export default AccountButton;
