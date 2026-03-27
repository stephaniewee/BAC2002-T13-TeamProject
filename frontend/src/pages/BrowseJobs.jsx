import React, { useCallback, useEffect, useMemo, useState } from 'react';
import JobCard from '../components/JobCard';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';
import {
  ensureSepoliaNetwork,
  getWalletReputation,
  loadEscrowMilestones,
  TX_CONFIRMED_EVENT,
} from '../utils/contracts';

const ROLE_BROWSE_COPY = {
  [USER_ROLES.CLIENT]: 'Track market rates, compare portfolios, and benchmark your open jobs.',
  [USER_ROLES.FREELANCER]: 'Find your next freelance opportunity and start earning USDC.',
  [USER_ROLES.ARBITRATOR]: 'Monitor active jobs so you can make faster, context-aware arbitration decisions.',
};

const EMPTY_BROWSE_STATE = {
  [USER_ROLES.CLIENT]: {
    title: 'No jobs in your client view yet',
    hint: 'Create and fund a milestone first, then it will appear here.',
  },
  [USER_ROLES.FREELANCER]: {
    title: 'No jobs assigned to this freelancer wallet',
    hint: 'Use a milestone where this wallet is the freelancer, then refresh.',
  },
  [USER_ROLES.ARBITRATOR]: {
    title: 'No jobs found with current filters',
    hint: 'Clear filters or wait for new milestones to be created on-chain.',
  },
};

const ESCROW_STATE_TO_STATUS = {
  0: 'open',
  1: 'in_progress',
  2: 'in_progress',
  3: 'review',
  4: 'completed',
  5: 'disputed',
  6: 'resolved',
};

const EMPTY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const JobCardSkeleton = () => (
  <div className="card animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
    <div className="h-3 bg-gray-200 rounded w-full mb-2" />
    <div className="h-3 bg-gray-200 rounded w-5/6 mb-4" />
    <div className="h-8 bg-gray-200 rounded w-1/3" />
  </div>
);

const BrowseJobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const { userRole, roleSource, provider, account } = useWallet();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadJobs = useCallback(async () => {
    if (!provider) {
      return;
    }

    try {
      setLoading(true);
      setLoadError('');

      await ensureSepoliaNetwork(provider);
      const milestoneRows = await loadEscrowMilestones(provider);
      const count = milestoneRows.length;

      if (count === 0) {
        setJobs([]);
        return;
      }

      const clientAddresses = [...new Set(milestoneRows.map(({ milestone }) => milestone.client.toLowerCase()))];
      const tierByClient = new Map();

      await Promise.all(
        clientAddresses.map(async (client) => {
          try {
            const reputation = await getWalletReputation(provider, client);
            tierByClient.set(client, reputation.tierKey);
          } catch {
            tierByClient.set(client, 'NEW');
          }
        })
      );

      const nextJobs = milestoneRows
        .map(({ id, milestone, meta }) => {
          const amount = (Number(milestone.amountUSD) / 1e8).toFixed(2);
          const isUnsubmitted = milestone.deliverableHash === EMPTY_HASH;
          const shortClient = `${milestone.client.slice(0, 6)}...${milestone.client.slice(-4)}`;
          const shortFreelancer = `${milestone.freelancer.slice(0, 6)}...${milestone.freelancer.slice(-4)}`;
          const title = meta
            ? `Milestone #${id} · ${shortClient} -> ${shortFreelancer}`
            : `Escrow Milestone #${id}`;
          return {
            id,
            title,
            description: isUnsubmitted
              ? `Created on-chain for ${amount} USD. Deliverable not submitted yet.`
              : `Deliverable hash submitted: ${milestone.deliverableHash}`,
            amount,
            milestones: 1,
            status: ESCROW_STATE_TO_STATUS[Number(milestone.state)] || 'open',
            clientTier: tierByClient.get(milestone.client.toLowerCase()) || 'NEW',
            client: milestone.client,
            freelancer: milestone.freelancer,
          };
        })
        .filter((job) => {
          if (userRole === USER_ROLES.CLIENT && account) {
            return job.client.toLowerCase() === account.toLowerCase();
          }
          if (userRole === USER_ROLES.FREELANCER && account) {
            return job.freelancer.toLowerCase() === account.toLowerCase();
          }
          return true;
        });

      setJobs(nextJobs);
    } catch (error) {
      setLoadError(error?.shortMessage || error?.message || 'Unable to load jobs from chain.');
    } finally {
      setLoading(false);
    }
  }, [provider, userRole, account]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const refresh = () => {
      loadJobs();
    };

    window.addEventListener(TX_CONFIRMED_EVENT, refresh);
    return () => window.removeEventListener(TX_CONFIRMED_EVENT, refresh);
  }, [loadJobs]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || job.clientTier === filterTier;
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    return matchesSearch && matchesTier && matchesStatus;
  }), [jobs, searchTerm, filterTier, filterStatus]);

  const emptyState = EMPTY_BROWSE_STATE[userRole] || EMPTY_BROWSE_STATE[USER_ROLES.FREELANCER];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Browse Available Gigs</h1>
        <p className="text-gray-600">{ROLE_BROWSE_COPY[userRole] || ROLE_BROWSE_COPY[USER_ROLES.FREELANCER]}</p>
        {roleSource === 'override' && (
          <p className="text-xs text-blue-600 mt-2">Role override is active for testing flows.</p>
        )}
      </div>

      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Jobs</label>
            <input
              type="text"
              placeholder="Search by title, description, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Client Tier</label>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="input-base"
            >
              <option value="all">All Tiers</option>
              <option value="NEW">New</option>
              <option value="ESTABLISHED">Established</option>
              <option value="TRUSTED">Trusted</option>
              <option value="ELITE">Elite</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-base"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
              <option value="disputed">Disputed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mb-8">
          <div className="card mb-4 text-sm text-gray-700">Loading jobs from EscrowContract...</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        </div>
      )}

      {loadError && (
        <div className="card mb-8 border border-red-200 bg-red-50 text-sm text-red-700">{loadError}</div>
      )}

      {!loading && (
        <p className="text-sm text-gray-600 mb-5">
          Showing {filteredJobs.length} of {jobs.length} job{jobs.length === 1 ? '' : 's'}
        </p>
      )}

      {filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-700 text-lg font-semibold">{emptyState.title}</p>
          <p className="text-gray-500 mt-2">{emptyState.hint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} userRole={userRole} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowseJobs;
