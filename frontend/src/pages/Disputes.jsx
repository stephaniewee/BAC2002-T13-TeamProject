import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { emitTxConfirmedEvent, ensureSepoliaNetwork, getDisputeReadContract, getDisputeWriteContract, loadEscrowMilestones, TX_CONFIRMED_EVENT } from '../utils/contracts';
import { NETWORK_CONFIG, USER_ROLES } from '../constants/contracts';

const DISPUTED_STATE = 5;
const RESOLVED_STATE = 6;

const formatAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const toUSD = (amountUSD) => (Number(amountUSD) / 1e8).toFixed(2);

const formatDateTime = (unixSeconds) => {
  if (!unixSeconds) {
    return 'Unknown time';
  }
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
};

const DisputeCard = ({
  dispute,
  userRole,
  splitValue,
  onSplitChange,
  onResolve,
  isResolving,
}) => {
  const isArbitrator = userRole === USER_ROLES.ARBITRATOR;
  const isResolved = dispute.status === 'resolved';

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{dispute.jobTitle}</h3>
          <p className="text-sm text-gray-600 mt-1">Opened: {dispute.openedAt}</p>
        </div>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${isResolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isResolved ? 'Resolved' : 'In Dispute'}
        </span>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Milestone Parties</p>
        <p className="text-gray-600 text-sm">Client: {formatAddress(dispute.client)}</p>
        <p className="text-gray-600 text-sm">Freelancer: {formatAddress(dispute.freelancer)}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-500 uppercase">Amount (USD)</p>
          <p className="font-bold text-gray-900">{toUSD(dispute.amountUSD)} USD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Status</p>
          <p className="font-bold text-gray-900">{dispute.status}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Milestone ID</p>
          <p className="font-bold text-gray-900">#{dispute.id}</p>
        </div>
      </div>

      {isArbitrator && dispute.status === 'pending_arbitration' && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Cast Your Vote</h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-700 mb-2 block">
                Freelancer / Client Split
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitValue}
                  onChange={(event) => onSplitChange(dispute.id, Number(event.target.value))}
                  className="flex-1"
                />
                <span className="font-bold text-gray-900 w-24 text-right">{splitValue}/{100 - splitValue}</span>
              </div>
            </div>
            <button
              onClick={() => onResolve(dispute.id, splitValue >= 50)}
              disabled={isResolving}
              className="w-full btn-primary py-2 rounded-lg font-semibold"
            >
              {isResolving ? 'Submitting Vote...' : 'Submit Vote'}
            </button>
          </div>
        </div>
      )}

      {!isArbitrator && (
        <div className="space-y-2">
          <button className="w-full btn-primary py-2 rounded-lg font-semibold">
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

const Disputes = () => {
  const { userRole, roleSource, provider, signer, account } = useWallet();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [splitById, setSplitById] = useState({});
  const [lastResolveTxHash, setLastResolveTxHash] = useState('');

  const loadDisputes = useCallback(async () => {
    if (!provider) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await ensureSepoliaNetwork(provider);

      const rows = await loadEscrowMilestones(provider);
      const loaded = rows
        .filter(({ milestone }) => {
          const stateValue = Number(milestone.state);
          return stateValue === DISPUTED_STATE || stateValue === RESOLVED_STATE;
        })
        .map(({ id, milestone, meta }) => ({
          id,
          jobTitle: `Dispute #${id} · ${formatAddress(milestone.client)} vs ${formatAddress(milestone.freelancer)}`,
          milestoneNumber: id,
          amountUSD: milestone.amountUSD,
          status: Number(milestone.state) === DISPUTED_STATE ? 'pending_arbitration' : 'resolved',
          client: milestone.client,
          freelancer: milestone.freelancer,
          openedAt: formatDateTime(meta?.blockTimestamp),
        }));

      setDisputes(loaded);
      setSplitById(Object.fromEntries(loaded.map((item) => [item.id, 50])));
    } catch (loadError) {
      setError(loadError?.shortMessage || loadError?.message || 'Unable to load disputes from chain.');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  useEffect(() => {
    const refresh = () => {
      loadDisputes();
    };

    window.addEventListener(TX_CONFIRMED_EVENT, refresh);
    return () => window.removeEventListener(TX_CONFIRMED_EVENT, refresh);
  }, [loadDisputes]);

  const handleSplitChange = (id, value) => {
    setSplitById((prev) => ({ ...prev, [id]: value }));
  };

  const handleResolve = async (milestoneId, releaseToFreelancer) => {
    try {
      if (!provider || !signer) {
        throw new Error('Wallet signer not available. Reconnect MetaMask and try again.');
      }

      await ensureSepoliaNetwork(provider);

      const dispute = getDisputeWriteContract(signer);
      const disputeRead = getDisputeReadContract(provider);
      const arbitrator = await disputeRead.isArbitrator(account);
      if (!arbitrator) {
        throw new Error('Connected wallet is not an arbitrator for this resolver.');
      }

      setIsResolving(true);
      setError('');
      const tx = await dispute.resolveDispute(milestoneId, releaseToFreelancer);
      setLastResolveTxHash(tx.hash);
      await tx.wait();
      emitTxConfirmedEvent({ source: 'disputes', milestoneId, txHash: tx.hash });
      await loadDisputes();
    } catch (resolveError) {
      setError(resolveError?.shortMessage || resolveError?.message || 'Failed to resolve dispute.');
    } finally {
      setIsResolving(false);
    }
  };

  const pendingDisputes = disputes.filter((d) => d.status === 'pending_arbitration');
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved');

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Disputes</h1>
      <p className="text-gray-600 mb-12">Manage your job disputes and arbitration votes</p>

      {roleSource === 'override' && (
        <div className="mb-6 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700">
          Role override is active. Actions shown here follow your selected testing role.
        </div>
      )}

      {loading && (
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
          Loading disputes from EscrowContract...
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      {lastResolveTxHash && (
        <div className="mb-6 p-4 rounded-lg border border-green-200 bg-green-50 text-sm text-green-700">
          Dispute transaction submitted.{' '}
          <a
            href={`${NETWORK_CONFIG.EXPLORER_URL}/tx/${lastResolveTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View on Etherscan
          </a>
        </div>
      )}

      <div className="space-y-12">
        {/* Pending Disputes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Pending Arbitration ({pendingDisputes.length})
          </h2>
          {pendingDisputes.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600">No pending disputes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingDisputes.map(dispute => (
                <DisputeCard
                  key={dispute.id}
                  dispute={dispute}
                  userRole={userRole}
                  splitValue={splitById[dispute.id] ?? 50}
                  onSplitChange={handleSplitChange}
                  onResolve={handleResolve}
                  isResolving={isResolving}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resolved Disputes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Resolved ({resolvedDisputes.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {resolvedDisputes.map(dispute => (
              <DisputeCard
                key={dispute.id}
                dispute={dispute}
                userRole={userRole}
                splitValue={splitById[dispute.id] ?? 50}
                onSplitChange={handleSplitChange}
                onResolve={handleResolve}
                isResolving={isResolving}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disputes;
