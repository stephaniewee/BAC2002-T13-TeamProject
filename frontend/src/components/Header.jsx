import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';

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
    provider,
    setRoleOverride,
    clearRoleOverride,
  } = useWallet();
  const [networkStatus, setNetworkStatus] = useState({ ok: false, label: 'Not Connected' });

  const navItems = NAV_ITEMS_BY_ROLE[userRole] || NAV_ITEMS_BY_ROLE[USER_ROLES.FREELANCER];

  const formatAddress = (addr) => {
    return `${addr?.slice(0, 6)}...${addr?.slice(-4)}`;
  };

  const isOverrideActive = roleSource === 'override';
  const roleSelectValue = isOverrideActive ? userRole : 'onchain';

  useEffect(() => {
    if (!provider) {
      setNetworkStatus({ ok: false, label: 'Not Connected' });
      return;
    }

    let disposed = false;
    const updateNetwork = async () => {
      try {
        const network = await provider.getNetwork();
        const matches = Number(network.chainId) === NETWORK_CONFIG.CHAIN_ID;
        if (!disposed) {
          setNetworkStatus({
            ok: matches,
            label: matches ? 'Sepolia Live' : `Wrong Network (${Number(network.chainId)})`,
          });
        }
      } catch {
        if (!disposed) {
          setNetworkStatus({ ok: false, label: 'Network Unknown' });
        }
      }
    };

    updateNetwork();
    const intervalId = window.setInterval(updateNetwork, 15000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [provider]);

  const getNavClassName = ({ isActive }) => (
    isActive
      ? 'text-blue-600 font-semibold transition'
      : 'text-gray-700 hover:text-blue-600 transition'
  );

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="w-full px-4 sm:px-5 lg:px-6 py-4 flex flex-col gap-4 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-6">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <h1 className="text-2xl font-bold text-blue-600">FreelanceChain</h1>
          <div className={`ml-3 inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border ${networkStatus.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span className={`h-2 w-2 rounded-full ${networkStatus.ok ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-semibold">{networkStatus.label}</span>
          </div>
        </div>

        <nav className="w-full flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={getNavClassName}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {isConnected ? (
          <div className="flex flex-wrap items-center gap-3 lg:justify-self-end lg:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">Role</span>
              <select
                value={roleSelectValue}
                onChange={(event) => {
                  const { value } = event.target;
                  if (value === 'onchain') {
                    clearRoleOverride();
                    return;
                  }
                  setRoleOverride(value);
                }}
                className="px-2 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-900 border border-gray-200 focus-ring min-w-[128px]"
              >
                <option value="onchain">On-chain Role</option>
                {Object.values(USER_ROLES).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-3 py-2 bg-blue-50 rounded-lg text-xs font-semibold text-blue-700 whitespace-nowrap">
              {ROLE_LABELS[userRole]}
              {isOverrideActive && ' (Override)'}
            </div>

            <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-900 whitespace-nowrap">
              {formatAddress(account)}
            </div>
            <button
              onClick={disconnectWallet}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="btn-primary whitespace-nowrap self-start lg:justify-self-end"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
