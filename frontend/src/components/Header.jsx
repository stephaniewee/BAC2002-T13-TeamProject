import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';

const ROLE_LABELS = {
  [USER_ROLES.CLIENT]: 'Client',
  [USER_ROLES.FREELANCER]: 'Freelancer',
  [USER_ROLES.ARBITRATOR]: 'Arbitrator',
};

const NAV_ITEMS_BY_ROLE = {
  [USER_ROLES.CLIENT]: [
    { label: 'Dashboard', to: '/' },
    { label: 'My Jobs', to: '/my-jobs' },
    { label: 'Post Job', to: '/create-job' },
    { label: 'Disputes', to: '/disputes' },
  ],
  [USER_ROLES.FREELANCER]: [
    { label: 'Dashboard', to: '/' },
    { label: 'My Jobs', to: '/my-jobs' },
    { label: 'Browse Jobs', to: '/browse' },
    { label: 'Disputes', to: '/disputes' },
  ],
  [USER_ROLES.ARBITRATOR]: [
    { label: 'Dashboard', to: '/' },
    { label: 'My Queue', to: '/my-jobs' },
    { label: 'Disputes', to: '/disputes' },
    { label: 'Browse Jobs', to: '/browse' },
  ],
};

const Header = () => {
  const {
    account,
    isConnected,
    connectWallet,
    disconnectWallet,
    userRole,
    roleSource,
    setRoleOverride,
    clearRoleOverride,
  } = useWallet();

  const navItems = NAV_ITEMS_BY_ROLE[userRole] || NAV_ITEMS_BY_ROLE[USER_ROLES.FREELANCER];

  const formatAddress = (addr) => {
    return `${addr?.slice(0, 6)}...${addr?.slice(-4)}`;
  };

  const isOverrideActive = roleSource === 'override';

  const getNavClassName = ({ isActive }) => (
    isActive
      ? 'text-blue-600 font-semibold transition'
      : 'text-gray-700 hover:text-blue-600 transition'
  );

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-blue-600">FreelanceChain</h1>
        </div>

        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={getNavClassName}>
              {item.label}
            </NavLink>
          ))}

          {isConnected ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Role</span>
                <select
                  value={userRole}
                  onChange={(event) => setRoleOverride(event.target.value)}
                  className="px-2 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-900 border border-gray-200"
                >
                  {Object.values(USER_ROLES).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                {isOverrideActive && (
                  <button
                    onClick={clearRoleOverride}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Use On-Chain
                  </button>
                )}
              </div>

              <div className="px-3 py-2 bg-blue-50 rounded-lg text-xs font-semibold text-blue-700">
                {ROLE_LABELS[userRole]}
                {isOverrideActive && ' (Override)'}
              </div>

              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-900">
                {formatAddress(account)}
              </div>
              <button
                onClick={disconnectWallet}
                className="btn-secondary text-sm"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-primary"
            >
              Connect Wallet
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
