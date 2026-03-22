import { Contract, isAddress } from 'ethers';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../constants/contracts';

// Minimal ABIs used by current UI flows.
const ESCROW_ABI = [
    'function milestoneCount() view returns (uint256)',
    'function milestones(uint256) view returns (address client, address freelancer, uint256 amountUSD, uint256 lockedETH, uint8 state, uint256 deadline, bytes32 deliverableHash)',
    'function createMilestone(address freelancer, uint256 amountUSD, uint256 deadline) returns (uint256)',
    'function getRequiredETH(uint256 milestoneId) view returns (uint256)',
    'function fundMilestone(uint256 id) payable',
    'function raiseDispute(uint256 id)',
    'function approveMilestone(uint256 id)',
    'function submitWork(uint256 id, bytes32 ipfsHash)',
];

const DISPUTE_ABI = [
    'function resolveDispute(uint256 milestoneId, bool releaseToFreelancer)',
    'function isArbitrator(address account) view returns (bool)',
];

const REPUTATION_SBT_ABI = [
    'function getTier(address wallet) view returns (uint8)',
    'function getReputation(address wallet) view returns (uint256 jobsCompleted, uint256 jobsFailed, uint256 disputesRaised, uint256 milestonesSuccess, uint256 lastUpdated, uint8 tier)',
    'function hasSBT(address wallet) view returns (bool)',
];

const CHAINLINK_PRICE_FEED_ABI = [
    'function getLatestPrice() view returns (int256 price, uint256 updatedAt)',
    'function getCurrentETHPriceUSD() view returns (int256)',
    'function getETHAmount(uint256 usdAmount, uint256 bufferBPS) view returns (uint256)',
];

const TIER_INDEX_TO_KEY = {
    0: 'NEW',
    1: 'BRONZE',
    2: 'SILVER',
    3: 'GOLD',
};

const requireAddress = (name, address) => {
    if (!isAddress(address)) {
        throw new Error(`${name} address is missing or invalid. Check your .env values.`);
    }
};

export const ensureSepoliaNetwork = async (provider) => {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== NETWORK_CONFIG.CHAIN_ID) {
        throw new Error(`Wrong network. Please switch MetaMask to ${NETWORK_CONFIG.CHAIN_NAME}.`);
    }
};

export const getEscrowReadContract = (provider) => {
    requireAddress('Escrow', CONTRACT_ADDRESSES.ESCROW);
    return new Contract(CONTRACT_ADDRESSES.ESCROW, ESCROW_ABI, provider);
};

export const getEscrowWriteContract = (signer) => {
    requireAddress('Escrow', CONTRACT_ADDRESSES.ESCROW);
    return new Contract(CONTRACT_ADDRESSES.ESCROW, ESCROW_ABI, signer);
};

export const getDisputeReadContract = (provider) => {
    requireAddress('DisputeResolver', CONTRACT_ADDRESSES.DISPUTE_RESOLVER);
    return new Contract(CONTRACT_ADDRESSES.DISPUTE_RESOLVER, DISPUTE_ABI, provider);
};

export const getDisputeWriteContract = (signer) => {
    requireAddress('DisputeResolver', CONTRACT_ADDRESSES.DISPUTE_RESOLVER);
    return new Contract(CONTRACT_ADDRESSES.DISPUTE_RESOLVER, DISPUTE_ABI, signer);
};

export const getReputationReadContract = (provider) => {
    requireAddress('ReputationSBT', CONTRACT_ADDRESSES.REPUTATION_SBT);
    return new Contract(CONTRACT_ADDRESSES.REPUTATION_SBT, REPUTATION_SBT_ABI, provider);
};

export const getChainlinkPriceFeedReadContract = (provider) => {
    requireAddress('ChainlinkPriceFeed', CONTRACT_ADDRESSES.CHAINLINK_PRICE_FEED);
    return new Contract(CONTRACT_ADDRESSES.CHAINLINK_PRICE_FEED, CHAINLINK_PRICE_FEED_ABI, provider);
};

export const toTierKey = (tierIndex) => TIER_INDEX_TO_KEY[Number(tierIndex)] || 'NEW';

export const getWalletReputation = async (provider, walletAddress) => {
    const reputation = getReputationReadContract(provider);
    const hasSbt = await reputation.hasSBT(walletAddress);
    if (!hasSbt) {
        return {
            hasSbt: false,
            tierIndex: 0,
            tierKey: 'NEW',
            jobsCompleted: 0,
            jobsFailed: 0,
            disputesRaised: 0,
            milestonesSuccess: 0,
            lastUpdated: 0,
        };
    }

    const rep = await reputation.getReputation(walletAddress);
    const tierIndex = Number(rep.tier);

    return {
        hasSbt: true,
        tierIndex,
        tierKey: toTierKey(tierIndex),
        jobsCompleted: Number(rep.jobsCompleted),
        jobsFailed: Number(rep.jobsFailed),
        disputesRaised: Number(rep.disputesRaised),
        milestonesSuccess: Number(rep.milestonesSuccess),
        lastUpdated: Number(rep.lastUpdated),
    };
};

export const getCurrentEthPriceUsd = async (provider) => {
    const priceFeed = getChainlinkPriceFeedReadContract(provider);
    const price = await priceFeed.getCurrentETHPriceUSD();
    return Number(price) / 1e8;
};

export const quoteEthForUsd = async (provider, usdAmount, bufferBps = 0) => {
    const priceFeed = getChainlinkPriceFeedReadContract(provider);
    const usdAmount8 = BigInt(Math.round(Number(usdAmount) * 1e8));
    return priceFeed.getETHAmount(usdAmount8, BigInt(bufferBps));
};
