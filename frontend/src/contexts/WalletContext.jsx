import React, { createContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { USER_ROLES } from '../constants/contracts';

export const WalletContext = createContext();

const ONCHAIN_ROLE_STORAGE_KEY = 'freelancechain:onChainRole';
const ROLE_OVERRIDE_STORAGE_KEY = 'freelancechain:roleOverride';

const VALID_ROLES = new Set(Object.values(USER_ROLES));

const sanitizeRole = (role) => (VALID_ROLES.has(role) ? role : null);

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [onChainRole, setOnChainRole] = useState(null);
  const [roleOverride, setRoleOverrideState] = useState(
    sanitizeRole(localStorage.getItem(ROLE_OVERRIDE_STORAGE_KEY))
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const userRole = roleOverride || onChainRole || USER_ROLES.FREELANCER;
  const roleSource = roleOverride ? 'override' : (onChainRole ? 'onchain' : 'default');

  const resetWalletState = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setOnChainRole(null);
    localStorage.removeItem('walletConnected');
  }, []);

  const resolveOnChainRole = useCallback(async () => {
    // Placeholder until contract-backed profile read is wired in.
    const storedRole = localStorage.getItem(ONCHAIN_ROLE_STORAGE_KEY);
    return sanitizeRole(storedRole) || USER_ROLES.FREELANCER;
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
      const resolvedRole = await resolveOnChainRole();

      setAccount(accounts[0]);
      setProvider(provider);
      setSigner(signer);
      setOnChainRole(resolvedRole);

      // Save to localStorage
      localStorage.setItem('walletConnected', 'true');
    } catch (err) {
      setError(err.message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [resolveOnChainRole]);

  const setRoleOverride = useCallback((nextRole) => {
    const sanitizedRole = sanitizeRole(nextRole);
    if (!sanitizedRole) {
      return;
    }

    setRoleOverrideState(sanitizedRole);
    localStorage.setItem(ROLE_OVERRIDE_STORAGE_KEY, sanitizedRole);
  }, []);

  const clearRoleOverride = useCallback(() => {
    setRoleOverrideState(null);
    localStorage.removeItem(ROLE_OVERRIDE_STORAGE_KEY);
  }, []);

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
        const resolvedRole = await resolveOnChainRole();

        if (!mounted) {
          return;
        }

        setAccount(accounts[0]);
        setProvider(nextProvider);
        setSigner(nextSigner);
        setOnChainRole(resolvedRole);
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
  }, [resetWalletState, resolveOnChainRole]);

  const value = {
    account,
    provider,
    signer,
    onChainRole,
    roleOverride,
    userRole,
    roleSource,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    setRoleOverride,
    clearRoleOverride,
    isConnected: !!account,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
