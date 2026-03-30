import React, { createContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { USER_ROLES } from '../constants/contracts';
import { getDisputeReadContract, getEscrowReadContract } from '../utils/contracts';

export const WalletContext = createContext();

const ONCHAIN_ROLE_STORAGE_KEY_PREFIX = 'freelancechain:onChainRole:';
const ONBOARDING_ROLE_STORAGE_KEY_PREFIX = 'freelancechain:onboardingRole:';

const VALID_ROLES = new Set(Object.values(USER_ROLES));
const VALID_ONBOARDING_ROLES = new Set([USER_ROLES.CLIENT, USER_ROLES.FREELANCER]);

const sanitizeRole = (role) => (VALID_ROLES.has(role) ? role : null);
const getOnChainRoleStorageKey = (account) => `${ONCHAIN_ROLE_STORAGE_KEY_PREFIX}${String(account || '').toLowerCase()}`;
const getOnboardingRoleStorageKey = (account) => `${ONBOARDING_ROLE_STORAGE_KEY_PREFIX}${String(account || '').toLowerCase()}`;

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [onChainRole, setOnChainRole] = useState(null);
  const [onboardingRole, setOnboardingRole] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const userRole = onChainRole || onboardingRole || USER_ROLES.UNASSIGNED;
  const roleSource = onChainRole ? 'onchain' : onboardingRole ? 'onboarding' : 'unassigned';

  const resetWalletState = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setOnChainRole(null);
    setOnboardingRole(null);
    localStorage.removeItem('walletConnected');
  }, []);

  const resolveOnChainRole = useCallback(async (activeProvider, activeAccount) => {
    const scopedStorageKey = getOnChainRoleStorageKey(activeAccount);

    if (!activeProvider || !activeAccount) {
      return null;
    }

    const normalizedAccount = activeAccount.toLowerCase();

    try {
      const dispute = getDisputeReadContract(activeProvider);
      const isArbitrator = await dispute.isArbitrator(activeAccount);
      if (isArbitrator) {
        localStorage.setItem(scopedStorageKey, USER_ROLES.ARBITRATOR);
        return USER_ROLES.ARBITRATOR;
      }
    } catch {
      // Ignore and continue with escrow-derived role checks.
    }

    try {
      const escrow = getEscrowReadContract(activeProvider);
      const count = Number(await escrow.milestoneCount());
      let freelancerMatch = false;

      for (let id = 0; id < count; id += 1) {
        const milestone = await escrow.milestones(id);
        const client = String(milestone.client ?? milestone[0] ?? '').toLowerCase();
        const freelancer = String(milestone.freelancer ?? milestone[1] ?? '').toLowerCase();

        if (client === normalizedAccount) {
          localStorage.setItem(scopedStorageKey, USER_ROLES.CLIENT);
          return USER_ROLES.CLIENT;
        }

        if (freelancer === normalizedAccount) {
          freelancerMatch = true;
        }
      }

      if (freelancerMatch) {
        localStorage.setItem(scopedStorageKey, USER_ROLES.FREELANCER);
        return USER_ROLES.FREELANCER;
      }
    } catch {
      // Ignore and continue to fallback/default role.
    }

    localStorage.removeItem(scopedStorageKey);
    localStorage.removeItem('freelancechain:onChainRole');
    return null;
  }, []);

  const resolveOnboardingRole = useCallback((activeAccount) => {
    if (!activeAccount) {
      return null;
    }

    const scopedStorageKey = getOnboardingRoleStorageKey(activeAccount);
    const stored = localStorage.getItem(scopedStorageKey);
    return VALID_ONBOARDING_ROLES.has(stored) ? stored : null;
  }, []);

  const chooseOnboardingRole = useCallback((role) => {
    const sanitized = VALID_ONBOARDING_ROLES.has(role) ? role : null;
    if (!sanitized || !account || onChainRole) {
      return;
    }

    const scopedStorageKey = getOnboardingRoleStorageKey(account);
    localStorage.setItem(scopedStorageKey, sanitized);
    setOnboardingRole(sanitized);
  }, [account, onChainRole]);

  useEffect(() => {
    // Clean up legacy unscoped role cache keys from older versions.
    localStorage.removeItem('freelancechain:onChainRole');
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const resolvedOnChainRole = await resolveOnChainRole(provider, accounts[0]);
      const resolvedOnboardingRole = resolvedOnChainRole ? null : resolveOnboardingRole(accounts[0]);

      setAccount(accounts[0]);
      setProvider(provider);
      setSigner(signer);
      setOnChainRole(resolvedOnChainRole);
      setOnboardingRole(resolvedOnboardingRole);

      if (resolvedOnChainRole) {
        localStorage.removeItem(getOnboardingRoleStorageKey(accounts[0]));
      }

      // Save to localStorage
      localStorage.setItem('walletConnected', 'true');
    } catch (err) {
      setError(err.message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [resolveOnboardingRole, resolveOnChainRole]);

  const disconnectWallet = useCallback(() => {
    resetWalletState();
  }, [resetWalletState]);

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    let mounted = true;

    const syncWalletFromProvider = async (nextAccounts) => {
      try {
        const accounts = nextAccounts ?? await window.ethereum.request({ method: 'eth_accounts' });

        if (!accounts || accounts.length === 0) {
          if (mounted) {
            resetWalletState();
          }
          return;
        }

        const nextProvider = new BrowserProvider(window.ethereum);
        const nextSigner = await nextProvider.getSigner();
        const resolvedOnChainRole = await resolveOnChainRole(nextProvider, accounts[0]);
        const resolvedOnboardingRole = resolvedOnChainRole ? null : resolveOnboardingRole(accounts[0]);

        if (!mounted) {
          return;
        }

        setAccount(accounts[0]);
        setProvider(nextProvider);
        setSigner(nextSigner);
        setOnChainRole(resolvedOnChainRole);
        setOnboardingRole(resolvedOnboardingRole);

        if (resolvedOnChainRole) {
          localStorage.removeItem(getOnboardingRoleStorageKey(accounts[0]));
        }

        localStorage.setItem('walletConnected', 'true');
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Failed to sync wallet state.');
        }
      }
    };

    const shouldReconnect = localStorage.getItem('walletConnected') === 'true';
    if (shouldReconnect) {
      syncWalletFromProvider();
    }

    const handleAccountsChanged = (accounts) => {
      syncWalletFromProvider(accounts);
    };

    const handleChainChanged = () => {
      syncWalletFromProvider();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      mounted = false;
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [resetWalletState, resolveOnboardingRole, resolveOnChainRole]);

  const value = {
    account,
    provider,
    signer,
    onChainRole,
    onboardingRole,
    userRole,
    roleSource,
    isConnecting,
    error,
    connectWallet,
    chooseOnboardingRole,
    disconnectWallet,
    isConnected: !!account,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
