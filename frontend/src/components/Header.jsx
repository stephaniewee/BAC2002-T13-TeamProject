import React from 'react';
import { useWallet } from '../hooks/useWallet';

const Header = () => {
  const { account, isConnected, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (addr) => {
    return `${addr?.slice(0, 6)}...${addr?.slice(-4)}`;
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-blue-600">FreelanceChain</h1>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
            Beta
          </span>
        </div>

        <nav className="flex items-center gap-6">
          <a href="#" className="text-gray-700 hover:text-blue-600 transition">
            Dashboard
          </a>
          <a href="#" className="text-gray-700 hover:text-blue-600 transition">
            Browse Jobs
          </a>
          <a href="#" className="text-gray-700 hover:text-blue-600 transition">
            My Jobs
          </a>

          {isConnected ? (
            <div className="flex items-center gap-3">
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
