import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MilestoneCard from '../components/MilestoneCard';
import ReputationBadge from '../components/ReputationBadge';
import { useWallet } from '../hooks/useWallet';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';
import {
  emitTxConfirmedEvent,
  ensureSepoliaNetwork,
  getCurrentEthPriceUsd,
  getDisputeReadContract,
  getEscrowWriteContract,
  loadEscrowMilestones,
  getWalletReputation,
} from '../utils/contracts';
import { fetchMetadataFromCID } from '../utils/ipfs';

const ROLE_ACTIONS = {
  [USER_ROLES.CLIENT]: {
    primary: 'Manage Escrow Milestones',
    primaryTo: '/my-jobs',
    secondary: 'Create Another Job',
    secondaryTo: '/create-job',
    helper: 'Client mode: review submissions and approve milestone payouts.',
  },
  [USER_ROLES.FREELANCER]: {
    primary: 'Browse More Jobs',
    primaryTo: '/browse',
    secondary: 'View My Jobs',
    secondaryTo: '/my-jobs',
    helper: 'Freelancer mode: submit milestones and track release timelines.',
  },
  [USER_ROLES.ARBITRATOR]: {
    primary: 'Open Dispute Context',
    primaryTo: '/disputes',
    secondary: 'Watch Queue',
    secondaryTo: '/my-jobs',
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

const CORE_TIMELINE_STEPS = [
  { value: 0, label: 'Created', shortLabel: 'C' },
  { value: 1, label: 'Funded', shortLabel: 'F' },
  { value: 2, label: 'In Progress', shortLabel: 'IP' },
  { value: 3, label: 'Submitted', shortLabel: 'S' },
];

const NORMAL_FINAL_STEP = { value: 4, label: 'Completed', shortLabel: 'OK' };

const DISPUTE_PATH_STEPS = [
  { value: 5, label: 'Disputed', shortLabel: 'D' },
  { value: 6, label: 'Resolved', shortLabel: 'R' },
];

const BACK_FALLBACK_BY_ROLE = {
  [USER_ROLES.CLIENT]: '/my-jobs',
  [USER_ROLES.FREELANCER]: '/my-jobs',
  [USER_ROLES.ARBITRATOR]: '/disputes',
};

const formatDate = (unixSeconds) => {
  if (!unixSeconds) return '-';
  return new Date(Number(unixSeconds) * 1000).toLocaleDateString();
};

const formatDateTime = (unixSeconds) => {
  if (!unixSeconds) return 'Unknown time';
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
};

const formatReleaseWindow = (deadlineSeconds) => {
  if (!deadlineSeconds) {
    return 'Unknown';
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(deadlineSeconds) <= now) {
    return 'Deadline passed';
  }

  const days = Math.ceil((Number(deadlineSeconds) - now) / 86400);
  return `${days} day${days === 1 ? '' : 's'} left`;
};

const formatStatusLabel = (status) => {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getTimelineStepType = (currentState, stepValue) => {
  if (currentState === stepValue) return 'current';
  if (currentState > stepValue) return 'completed';
  return 'upcoming';
};

const getStepChipClassName = (stepType) => {
  if (stepType === 'completed') return 'bg-blue-600 text-white border-blue-600';
  if (stepType === 'current') return 'bg-blue-100 text-blue-700 border-blue-400';
  return 'bg-gray-100 text-gray-500 border-gray-300';
};

const getConnectorClassName = (isComplete) => (isComplete ? 'bg-blue-500' : 'bg-gray-200');

const getBranchStepType = (currentState, stepValue, path) => {
  if (path === 'normal') {
    if (currentState >= 5) return 'skipped';
    if (currentState === stepValue) return 'current';
    if (currentState > stepValue) return 'completed';
    return 'upcoming';
  }

  // dispute path
  if (currentState === 4) return 'skipped';
  if (currentState === stepValue) return 'current';
  if (currentState > stepValue) return 'completed';
  return 'upcoming';
};

const getBranchChipClassName = (stepType) => {
  if (stepType === 'skipped') return 'bg-gray-50 text-gray-400 border-gray-300 border-dashed';
  return getStepChipClassName(stepType);
};

const getBranchTextClassName = (stepType) => {
  if (stepType === 'upcoming') return 'text-gray-500';
  if (stepType === 'skipped') return 'text-gray-400';
  return 'text-gray-900 font-medium';
};

const getBranchConnectorClassName = (leftType) => {
  if (leftType === 'completed' || leftType === 'current') return 'bg-blue-500';
  if (leftType === 'skipped') return 'bg-gray-300';
  return 'bg-gray-200';
};

const isBytes32 = (value) => /^0x[0-9a-fA-F]{64}$/.test(value || '');

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole, provider, signer } = useWallet();
  const currentActions = ROLE_ACTIONS[userRole] || ROLE_ACTIONS[USER_ROLES.FREELANCER];
  const [milestone, setMilestone] = useState(null);
  const [clientTier, setClientTier] = useState('NEW');
  const [clientJobsCompleted, setClientJobsCompleted] = useState('-');
  const [ethPriceUsd, setEthPriceUsd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txState, setTxState] = useState({ loading: false, message: '', error: '', txHash: '' });
  const [copyStatus, setCopyStatus] = useState('');
  const [resolutionOutcome, setResolutionOutcome] = useState(null);

  const milestoneId = Number(id);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(BACK_FALLBACK_BY_ROLE[userRole] || '/browse');
  };

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

      const rows = await loadEscrowMilestones(provider);
      const total = rows.length;
      if (milestoneId < 0 || milestoneId >= total) {
        throw new Error(`Milestone ${milestoneId} was not found on-chain.`);
      }

      const row = rows.find((entry) => entry.id === milestoneId);
      const chainMilestone = row?.milestone;
      const eventMeta = row?.meta;
      if (!chainMilestone) {
        throw new Error(`Milestone ${milestoneId} data could not be loaded.`);
      }
      const amountUSD = Number(chainMilestone.amountUSD) / 1e8;

      const [rep, liveEthPriceUsd] = await Promise.all([
        getWalletReputation(provider, chainMilestone.client),
        getCurrentEthPriceUsd(provider),
      ]);

      setClientTier(rep.tierKey);
      setClientJobsCompleted(rep.jobsCompleted);
      setEthPriceUsd(liveEthPriceUsd);

      const shortClient = `${chainMilestone.client.slice(0, 6)}...${chainMilestone.client.slice(-4)}`;
      const shortFreelancer = `${chainMilestone.freelancer.slice(0, 6)}...${chainMilestone.freelancer.slice(-4)}`;
      const createdAt = eventMeta?.blockTimestamp ? formatDate(eventMeta.blockTimestamp) : formatDate(chainMilestone.deadline);
      const metadataCID = String(chainMilestone.metadataCID || '').trim();

      let resolvedMetadata = null;
      if (metadataCID) {
        try {
          resolvedMetadata = await fetchMetadataFromCID(metadataCID);
        } catch {
          resolvedMetadata = null;
        }
      }

      const fallbackTitle = `Milestone #${milestoneId} · ${shortClient} -> ${shortFreelancer}`;
      const fallbackDescription = chainMilestone.deliverableHash === '0x0000000000000000000000000000000000000000000000000000000000000000'
        ? 'No deliverable submitted yet.'
        : `Deliverable hash submitted: ${chainMilestone.deliverableHash}`;

      let resolvedOutcome = null;
      if (Number(chainMilestone.state) === 6) {
        try {
          const disputeRead = getDisputeReadContract(provider);
          const events = await disputeRead.queryFilter(
            disputeRead.filters.DisputeResolved(BigInt(milestoneId)),
            0,
            'latest'
          );
          const lastResolution = events.at(-1);
          if (lastResolution) {
            const releasedToFreelancer = Boolean(lastResolution.args?.releasedToFreelancer);
            resolvedOutcome = {
              releasedToFreelancer,
              winnerLabel: releasedToFreelancer ? 'Freelancer won' : 'Client won',
              payoutLabel: releasedToFreelancer ? 'Freelancer' : 'Client',
              resolvedAt: formatDateTime(Number(lastResolution.args?.timestamp ?? 0)),
              txHash: lastResolution.transactionHash,
            };
          }
        } catch {
          resolvedOutcome = null;
        }
      }

      setResolutionOutcome(resolvedOutcome);

      setMilestone({
        id: milestoneId,
        title: resolvedMetadata?.jobTitle || resolvedMetadata?.milestoneTitle || fallbackTitle,
        description: resolvedMetadata?.jobDescription || resolvedMetadata?.milestoneDescription || fallbackDescription,
        amount: amountUSD.toFixed(2),
        status: ESCROW_STATE_TO_UI[Number(chainMilestone.state)] || 'pending',
        deadline: formatDate(chainMilestone.deadline),
        releaseTime: formatReleaseWindow(chainMilestone.deadline),
        stateValue: Number(chainMilestone.state),
        deliverables: [],
        client: chainMilestone.client,
        freelancer: chainMilestone.freelancer,
        lockedETH: chainMilestone.lockedETH,
        metadataCID,
        createdAt,
        creationTxHash: eventMeta?.txHash || '',
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
      emitTxConfirmedEvent({ source: 'job-detail', milestoneId: milestoneId, txHash: tx.hash });
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

    if (!milestone || ![1, 2].includes(Number(milestone.stateValue))) {
      setTxState({ loading: false, message: '', error: 'Milestone is not in a submittable state. It must be funded first.', txHash: '' });
      return;
    }

    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Submitting milestone deliverable...', () => escrow.submitWork(targetMilestoneId, deliverableHash));
  };

  const handleApprove = async (targetMilestoneId) => {
    if (!milestone || Number(milestone.stateValue) !== 3) {
      setTxState({ loading: false, message: '', error: 'Milestone is not pending review, so approval is not available.', txHash: '' });
      return;
    }

    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Approving milestone and releasing funds...', () => escrow.approveMilestone(targetMilestoneId));
  };

  const handleDispute = async (targetMilestoneId) => {
    if (!milestone || Number(milestone.stateValue) !== 3) {
      setTxState({ loading: false, message: '', error: 'Dispute can only be raised while milestone is pending review.', txHash: '' });
      return;
    }

    const escrow = getEscrowWriteContract(signer);
    await runWriteTx('Raising dispute for this milestone...', () => escrow.raiseDispute(targetMilestoneId));
  };

  const handleCopyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Copy failed. Please copy manually.');
    }

    setTimeout(() => {
      setCopyStatus('');
    }, 2000);
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
    description: milestone.description,
    client: {
      address: milestone.client,
      name: 'On-chain Client',
      tier: clientTier,
      jobsCompleted: clientJobsCompleted,
      escrowAmount: milestone.amount,
    },
    totalAmount: milestone.amount,
    status: milestone.status,
    createdAt: milestone.createdAt,
    deadline: milestone.deadline,
    milestones: [milestone],
  };

  const contactAddress = userRole === USER_ROLES.CLIENT ? milestone.freelancer : milestone.client;
  const contactLabel = userRole === USER_ROLES.CLIENT ? 'Freelancer' : 'Client';

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <button
          type="button"
          onClick={handleBack}
          className="btn-secondary mb-4"
        >
          Back
        </button>

        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{job.title}</h1>
            <p className="text-gray-600">Posted on {job.createdAt}</p>
          </div>
          <span className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg">
            {formatStatusLabel(job.status)}
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
                  <p className="font-semibold text-blue-600">{job.client.escrowAmount} USD</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ETH/USD (Chainlink)</p>
                  <p className="font-semibold text-gray-900">
                    {ethPriceUsd ? `$${ethPriceUsd.toFixed(2)}` : 'Loading...'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <a
                href={`${NETWORK_CONFIG.EXPLORER_URL}/address/${contactAddress}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                View {contactLabel} Wallet
              </a>
              <button
                type="button"
                onClick={() => handleCopyAddress(contactAddress)}
                className="btn-secondary"
              >
                Copy {contactLabel} Address
              </button>
              {copyStatus && <p className="text-xs text-gray-600">{copyStatus}</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">{currentActions.helper}</p>
        </div>

        {milestone.stateValue === 6 && resolutionOutcome && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-semibold text-green-800">Outcome: {resolutionOutcome.winnerLabel}</p>
            <p className="text-sm text-green-700">Payout Released To: {resolutionOutcome.payoutLabel}</p>
            <p className="text-xs text-green-700 mt-1">Resolved At: {resolutionOutcome.resolvedAt}</p>
            {resolutionOutcome.txHash && (
              <a
                href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${resolutionOutcome.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-green-800"
              >
                View resolution transaction
              </a>
            )}
          </div>
        )}
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

      {/* Milestone Timeline */}
      <div className="card mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Milestone Timeline</h2>
        <p className="text-sm text-gray-700 mb-6">
          Live on-chain progression with branch paths after submission.
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[760px]">
            <div className="flex items-center">
              {CORE_TIMELINE_STEPS.map((step, index) => {
                const stepType = getTimelineStepType(milestone.stateValue, step.value);
                const isConnectorComplete = milestone.stateValue > step.value;

                return (
                  <React.Fragment key={step.value}>
                    <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${getStepChipClassName(stepType)}`}>
                      {step.shortLabel}
                    </div>
                    {index < CORE_TIMELINE_STEPS.length - 1 && (
                      <div className={`h-1 flex-1 mx-2 rounded ${getConnectorClassName(isConnectorComplete)}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-center">
              {CORE_TIMELINE_STEPS.map((step) => {
                const stepType = getTimelineStepType(milestone.stateValue, step.value);
                return (
                  <div
                    key={step.value}
                    className={stepType === 'upcoming' ? 'text-gray-500' : 'text-gray-900 font-medium'}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Standard Path</p>
                {(() => {
                  const stepType = getBranchStepType(milestone.stateValue, NORMAL_FINAL_STEP.value, 'normal');
                  return (
                    <>
                      <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${getBranchChipClassName(stepType)}`}>
                        {NORMAL_FINAL_STEP.shortLabel}
                      </div>
                      <p className={`text-xs mt-2 ${getBranchTextClassName(stepType)}`}>{NORMAL_FINAL_STEP.label}</p>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Dispute Path</p>
                <div className="flex items-center">
                  {DISPUTE_PATH_STEPS.map((step, index) => {
                    const stepType = getBranchStepType(milestone.stateValue, step.value, 'dispute');
                    const nextType = DISPUTE_PATH_STEPS[index + 1]
                      ? getBranchStepType(milestone.stateValue, DISPUTE_PATH_STEPS[index + 1].value, 'dispute')
                      : null;
                    return (
                      <React.Fragment key={step.value}>
                        <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${getBranchChipClassName(stepType)}`}>
                          {step.shortLabel}
                        </div>
                        {nextType !== null && (
                          <div className={`h-1 flex-1 mx-2 rounded ${getBranchConnectorClassName(stepType)}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-center">
                  {DISPUTE_PATH_STEPS.map((step) => {
                    const stepType = getBranchStepType(milestone.stateValue, step.value, 'dispute');
                    return (
                      <div key={step.value} className={getBranchTextClassName(stepType)}>
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
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

      {!txState.txHash && milestone.creationTxHash && (
        <div className="mb-8 text-sm text-gray-700">
          <a
            href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${milestone.creationTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View milestone creation transaction on Etherscan
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mb-12">
        <Link to={currentActions.primaryTo || '/my-jobs'} className="flex-1">
          <button className="w-full btn-primary py-3 rounded-lg font-semibold">
            {currentActions.primary}
          </button>
        </Link>
        <Link to={currentActions.secondaryTo || '/browse'} className="flex-1">
          <button className="w-full btn-secondary py-3 rounded-lg font-semibold">
            {currentActions.secondary}
          </button>
        </Link>
      </div>
    </div>
  );
};

export default JobDetail;
