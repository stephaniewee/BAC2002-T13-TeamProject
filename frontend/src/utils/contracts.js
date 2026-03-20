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
