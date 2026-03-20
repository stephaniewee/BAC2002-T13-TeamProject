import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MilestoneCard from '../components/MilestoneCard';
import ReputationBadge from '../components/ReputationBadge';
import { useWallet } from '../hooks/useWallet';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';
import { ensureSepoliaNetwork, getEscrowReadContract, getEscrowWriteContract } from '../utils/contracts';

const ROLE_ACTIONS = {
  [USER_ROLES.CLIENT]: {
    primary: 'Manage Escrow Milestones',
    secondary: 'Edit Job Terms',
    helper: 'Client mode: review submissions and approve milestone payouts.',
  },
  [USER_ROLES.FREELANCER]: {
    primary: 'Apply to This Job',
    secondary: 'Save for Later',
    helper: 'Freelancer mode: submit milestones and track release timelines.',
  },
  [USER_ROLES.ARBITRATOR]: {
    primary: 'Open Dispute Context',
    secondary: 'Watch Job',
    helper: 'Arbitrator mode: monitor delivery context for possible dispute review.',
  },
};

const ESCROW_STATE_TO_UI = {
  0: 'pending', // CREATED
  1: 'pending', // FUNDED
  2: 'pending', // IN_PROGRESS
  3: 'submitted', // PENDING_REVIEW
  4: 'approved', // COMPLETED
  5: 'disputed', // DISPUTED
  6: 'resolved', // RESOLVED
};

const formatDate = (unixSeconds) => {
  if (!unixSeconds) return '-';
  return new Date(Number(unixSeconds) * 1000).toLocaleDateString();
};

const isBytes32 = (value) => /^0x[0-9a-fA-F]{64}$/.test(value || '');

const JobDetail = () => {
  const { id } = useParams();
  const { userRole, roleSource, provider, signer } = useWallet();
  const currentActions = ROLE_ACTIONS[userRole] || ROLE_ACTIONS[USER_ROLES.FREELANCER];
  const [milestone, setMilestone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txState, setTxState] = useState({ loading: false, message: '', error: '', txHash: '' });

  const milestoneId = Number(id);

  const loadMilestone = useCallback(async () => {
    if (!provider) {
      return;
    }

    if (Number.isNaN(milestoneId)) {
      setError('Invalid milestone id in URL.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await ensureSepoliaNetwork(provider);

      const escrow = getEscrowReadContract(provider);
      const total = Number(await escrow.milestoneCount());
      if (milestoneId < 0 || milestoneId >= total) {
        throw new Error(`Milestone ${milestoneId} was not found on-chain.`);
      }

      const chainMilestone = await escrow.milestones(milestoneId);
      const amountUSD = Number(chainMilestone.amountUSD) / 1e8;

      setMilestone({
        id: milestoneId,
        title: `Escrow Milestone #${milestoneId}`,
        description: chainMilestone.deliverableHash === '0x0000000000000000000000000000000000000000000000000000000000000000'
          ? 'No deliverable submitted yet.'
          : `Deliverable hash submitted: ${chainMilestone.deliverableHash}`,
        amount: amountUSD.toFixed(2),
        status: ESCROW_STATE_TO_UI[Number(chainMilestone.state)] || 'pending',
        deadline: formatDate(chainMilestone.deadline),
        releaseTime: '-',
        deliverables: [],
        client: chainMilestone.client,
        freelancer: chainMilestone.freelancer,
        lockedETH: chainMilestone.lockedETH,
      });
    } catch (loadError) {
      setError(loadError?.shortMessage || loadError?.message || 'Failed to load milestone data.');
    } finally {
      setLoading(false);
    }
  }, [provider, milestoneId]);

  useEffect(() => {
    loadMilestone();
  }, [loadMilestone]);

  const runWriteTx = async (message, call) => {
    try {
      if (!provider || !signer) {
        throw new Error('Wallet signer not available. Reconnect MetaMask and try again.');
      }

      await ensureSepoliaNetwork(provider);
      setTxState({ loading: true, message, error: '', txHash: '' });
      const tx = await call();
      setTxState({ loading: true, message: 'Waiting for confirmation...', error: '', txHash: tx.hash });
      await tx.wait();
      setTxState({ loading: false, message: 'Transaction confirmed.', error: '', txHash: tx.hash });
      await loadMilestone();
    } catch (txError) {
      setTxState({ loading: false, message: '', error: txError?.shortMessage || txError?.message || 'Transaction failed.', txHash: '' });
    }
  };

  const handleSubmitWork = async (targetMilestoneId, deliverableHash) => {
    if (!isBytes32(deliverableHash)) {
      setTxState({ loading: false, message: '', error: 'Deliverable hash must be bytes32 (0x + 64 hex chars).', txHash: '' });
      return;
    }

    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Submitting milestone deliverable...', () => escrow.submitWork(targetMilestoneId, deliverableHash));
  };

  const handleApprove = async (targetMilestoneId) => {
    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Approving milestone and releasing funds...', () => escrow.approveMilestone(targetMilestoneId));
  };

  const handleDispute = async (targetMilestoneId) => {
    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Raising dispute for this milestone...', () => escrow.raiseDispute(targetMilestoneId));
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="card text-center py-12">Loading milestone from chain...</div>
      </div>
    );
  }

  if (error || !milestone) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="card text-center py-12 text-red-700">{error || 'Milestone not found.'}</div>
      </div>
    );
  }

  const job = {
    id: milestone.id,
    title: milestone.title,
    description: 'On-chain escrow milestone details from the deployed EscrowContract.',
    client: {
      address: milestone.client,
      name: 'On-chain Client',
      tier: 'SILVER',
      jobsCompleted: '-',
      escrowAmount: `${milestone.amount} USD`,
    },
    totalAmount: milestone.amount,
    status: milestone.status,
    createdAt: '-',
    deadline: milestone.deadline,
    milestones: [milestone],
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{job.title}</h1>
            <p className="text-gray-600">Posted on {job.createdAt}</p>
          </div>
          <span className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg">
            {job.status}
          </span>
        </div>

        <p className="text-gray-700 text-lg mb-6">{job.description}</p>

        {/* Client Info Card */}
        <div className="card">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">About the Client</h3>
              <p className="text-sm text-gray-600 mb-3">
                Wallet: <code className="bg-gray-100 px-2 py-1 rounded">{job.client.address}</code>
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-gray-500">Reputation</p>
                  <ReputationBadge tier={job.client.tier} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jobs Completed</p>
                  <p className="font-semibold text-gray-900">{job.client.jobsCompleted}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total in Escrow</p>
                  <p className="font-semibold text-blue-600">{job.client.escrowAmount} USDC</p>
                </div>
              </div>
            </div>
            <button className="btn-primary">
              {userRole === USER_ROLES.CLIENT ? 'Message Freelancer' : 'Contact Client'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">{currentActions.helper}</p>
          {roleSource === 'override' && (
            <p className="text-xs text-blue-600 mt-1">Role override active for testing.</p>
          )}
        </div>
      </div>

      {/* Job Summary */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        <div className="card text-center">
          <p className="text-gray-600 text-sm mb-2">Total Amount</p>
          <p className="text-3xl font-bold text-blue-600">{job.totalAmount} USD</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-600 text-sm mb-2">Number of Milestones</p>
          <p className="text-3xl font-bold text-gray-900">{job.milestones.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-600 text-sm mb-2">Project Deadline</p>
          <p className="text-lg font-bold text-gray-900">{job.deadline}</p>
        </div>
      </div>

      {/* Milestones */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Milestones</h2>
        <div className="space-y-6">
          {job.milestones.map((milestone, index) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              index={index}
              userRole={userRole}
              onSubmitWork={handleSubmitWork}
              onApprove={handleApprove}
              onDispute={handleDispute}
              txState={txState}
            />
          ))}
        </div>
      </div>

      {txState.txHash && (
        <div className="mb-8 text-sm text-blue-700">
          <a
            href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${txState.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View latest transaction on Etherscan
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mb-12">
        <button className="flex-1 btn-primary py-3 rounded-lg font-semibold">
          {currentActions.primary}
        </button>
        <button className="flex-1 btn-secondary py-3 rounded-lg font-semibold">
          {currentActions.secondary}
        </button>
      </div>
    </div>
  );
};

export default JobDetail;
