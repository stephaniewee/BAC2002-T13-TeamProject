// Smart Contract Addresses (Sepolia Testnet)
export const CONTRACT_ADDRESSES = {
  ESCROW: import.meta.env.VITE_ESCROW_ADDRESS || '0x...',
  DISPUTE_RESOLVER: import.meta.env.VITE_DISPUTE_ADDRESS || '0x...',
  CHAINLINK_PRICE_FEED: import.meta.env.VITE_PRICEFEED_ADDRESS || '0x...',
  FACTORY: import.meta.env.VITE_FACTORY_ADDRESS || '0x...',
  REPUTATION_SBT: import.meta.env.VITE_SBT_ADDRESS || '0x...',
  USDC: import.meta.env.VITE_USDC_ADDRESS || '0x...',
};

// User Roles
export const USER_ROLES = {
  CLIENT: 'client',
  FREELANCER: 'freelancer',
  ARBITRATOR: 'arbitrator',
};

// SBT Tiers
export const SBT_TIERS = {
  NEW: { name: 'New', level: 0, color: '#94A3B8', releaseTime: 7, requiresArbitrator: true },
  ESTABLISHED: { name: 'Established', level: 1, color: '#B45309', releaseTime: 5, requiresArbitrator: true },
  TRUSTED: { name: 'Trusted', level: 2, color: '#4D7C0F', releaseTime: 3, requiresArbitrator: false },
  ELITE: { name: 'Elite', level: 3, color: '#CA8A04', releaseTime: 1, requiresArbitrator: false },
};

// Milestone Status
export const MILESTONE_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved',
};

// Job Status
export const JOB_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
};

// Network Config
export const NETWORK_CONFIG = {
  CHAIN_ID: Number(import.meta.env.VITE_CHAIN_ID || 11155111), // Sepolia
  CHAIN_NAME: 'Sepolia Testnet',
  RPC_URL: import.meta.env.VITE_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
  EXPLORER_URL: 'https://sepolia.etherscan.io',
  CHAINLINK_ETH_USD_AGGREGATOR: import.meta.env.VITE_CHAINLINK_ETH_USD_FEED || '0x694AA1769357215DE4FAC081bf1f309aDC325306',
};
