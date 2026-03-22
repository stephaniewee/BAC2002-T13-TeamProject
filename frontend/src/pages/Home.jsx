import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';
import OnchainHealthPanel from '../components/OnchainHealthPanel';
import {
  ensureSepoliaNetwork,
  getDisputeReadContract,
  getWalletReputation,
  loadEscrowMilestones,
  TX_CONFIRMED_EVENT,
} from '../utils/contracts';

const DASHBOARD_CONTENT = {
  [USER_ROLES.CLIENT]: {
    subtitle: 'Track funded jobs, review milestones, and handle disputes quickly.',
    actions: [
      { label: 'Post New Job', to: '/create-job', primary: true },
      { label: 'Review Disputes', to: '/disputes' },
      { label: 'Browse Talent Market', to: '/browse' },
    ],
  },
  [USER_ROLES.FREELANCER]: {
    subtitle: 'Discover opportunities, submit milestones, and grow your on-chain reputation.',
    actions: [
      { label: 'Browse Available Gigs', to: '/browse', primary: true },
      { label: 'Open Dispute Center', to: '/disputes' },
      { label: 'View My Jobs', to: '/my-jobs' },
    ],
  },
  [USER_ROLES.ARBITRATOR]: {
    subtitle: 'Review evidence and resolve disputes with transparent fund split votes.',
    actions: [
      { label: 'Review Disputes', to: '/disputes', primary: true },
      { label: 'Inspect Arbitration Queue', to: '/my-jobs' },
      { label: 'Browse Open Jobs', to: '/browse' },
    ],
  },
};

const ESCROW_STATE = {
  CREATED: 0,
  FUNDED: 1,
  IN_PROGRESS: 2,
  PENDING_REVIEW: 3,
  COMPLETED: 4,
  DISPUTED: 5,
  RESOLVED: 6,
};

const byNewest = (a, b) => b.id - a.id;

const sumUsd = (rows) => rows.reduce((acc, row) => acc + (Number(row.milestone.amountUSD) / 1e8), 0);

const toStateLabel = (stateValue) => {
  if (stateValue === ESCROW_STATE.CREATED) return 'Created';
  if (stateValue === ESCROW_STATE.FUNDED) return 'Funded';
  if (stateValue === ESCROW_STATE.IN_PROGRESS) return 'In Progress';
  if (stateValue === ESCROW_STATE.PENDING_REVIEW) return 'Pending Review';
  if (stateValue === ESCROW_STATE.COMPLETED) return 'Completed';
  if (stateValue === ESCROW_STATE.DISPUTED) return 'Disputed';
  return 'Resolved';
};

const toActivityBorder = (stateValue) => {
  if (stateValue === ESCROW_STATE.PENDING_REVIEW) return 'border-l-yellow-500';
  if (stateValue === ESCROW_STATE.DISPUTED) return 'border-l-red-500';
  if (stateValue === ESCROW_STATE.COMPLETED || stateValue === ESCROW_STATE.RESOLVED) return 'border-l-green-500';
  return 'border-l-blue-500';
};

const HeroFeatureIcon = ({ type }) => {
  if (type === 'escrow') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white" aria-hidden="true">
        <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v3H3V7zm0 5h18v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5zm4 2a1 1 0 100 2h2a1 1 0 100-2H7z" />
      </svg>
    );
  }

  if (type === 'reputation') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white" aria-hidden="true">
        <path d="M12 2l2.47 5.01L20 7.82l-4 3.9.94 5.48L12 14.9l-4.94 2.3L8 11.72l-4-3.9 5.53-.8L12 2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white" aria-hidden="true">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
};

const Home = () => {
  const { isConnected, connectWallet, userRole, roleSource, provider, account } = useWallet();
  const [stats, setStats] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const dashboard = DASHBOARD_CONTENT[userRole] || DASHBOARD_CONTENT[USER_ROLES.FREELANCER];

  const loadDashboard = useCallback(async () => {
    if (!provider || !account) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await ensureSepoliaNetwork(provider);
      const allRows = await loadEscrowMilestones(provider);
      const current = account.toLowerCase();

      if (userRole === USER_ROLES.CLIENT) {
        const mine = allRows.filter((row) => row.milestone.client.toLowerCase() === current);
        const openCount = mine.filter((row) => {
          const stateValue = Number(row.milestone.state);
          return stateValue < ESCROW_STATE.COMPLETED;
        }).length;
        const reviewCount = mine.filter((row) => Number(row.milestone.state) === ESCROW_STATE.PENDING_REVIEW).length;
        const pendingDisputes = mine.filter((row) => Number(row.milestone.state) === ESCROW_STATE.DISPUTED).length;

        setStats([
          { label: 'Open Jobs', value: String(openCount), accent: 'text-gray-900' },
          { label: 'Milestones Awaiting Review', value: String(reviewCount), accent: 'text-yellow-600' },
          { label: 'Total Escrow Value', value: `${sumUsd(mine).toFixed(2)} USD`, accent: 'text-blue-600' },
          { label: 'Pending Disputes', value: String(pendingDisputes), accent: 'text-red-600' },
        ]);

        setActivity(
          mine
            .sort(byNewest)
            .slice(0, 5)
            .map((row) => {
              const stateValue = Number(row.milestone.state);
              return {
                title: `Milestone #${row.id}`,
                detail: `State changed to ${toStateLabel(stateValue)}.`,
                meta: `${(Number(row.milestone.amountUSD) / 1e8).toFixed(2)} USD`,
                border: toActivityBorder(stateValue),
              };
            })
        );

        setLastSyncedAt(new Date());

        return;
      }

      if (userRole === USER_ROLES.FREELANCER) {
        const mine = allRows.filter((row) => row.milestone.freelancer.toLowerCase() === current);
        const active = mine.filter((row) => Number(row.milestone.state) <= ESCROW_STATE.DISPUTED).length;
        const pendingSubmission = mine.filter((row) => {
          const stateValue = Number(row.milestone.state);
          return stateValue === ESCROW_STATE.FUNDED || stateValue === ESCROW_STATE.IN_PROGRESS;
        }).length;
        const settled = mine.filter((row) => {
          const stateValue = Number(row.milestone.state);
          return stateValue === ESCROW_STATE.COMPLETED || stateValue === ESCROW_STATE.RESOLVED;
        });
        const rep = await getWalletReputation(provider, account);

        setStats([
          { label: 'Active Jobs', value: String(active), accent: 'text-gray-900' },
          { label: 'Pending Submissions', value: String(pendingSubmission), accent: 'text-yellow-600' },
          { label: 'Settled Value', value: `${sumUsd(settled).toFixed(2)} USD`, accent: 'text-green-600' },
          { label: 'Reputation Tier', value: `${rep.tierKey} ★`, accent: 'text-yellow-600' },
        ]);

        setActivity(
          mine
            .sort(byNewest)
            .slice(0, 5)
            .map((row) => {
              const stateValue = Number(row.milestone.state);
              return {
                title: `Milestone #${row.id}`,
                detail: `Client ${row.milestone.client.slice(0, 6)}...${row.milestone.client.slice(-4)} · ${toStateLabel(stateValue)}`,
                meta: `${(Number(row.milestone.amountUSD) / 1e8).toFixed(2)} USD`,
                border: toActivityBorder(stateValue),
              };
            })
        );

        setLastSyncedAt(new Date());

        return;
      }

      const disputeRows = allRows.filter((row) => {
        const stateValue = Number(row.milestone.state);
        return stateValue === ESCROW_STATE.DISPUTED || stateValue === ESCROW_STATE.RESOLVED;
      });
      const pendingCases = disputeRows.filter((row) => Number(row.milestone.state) === ESCROW_STATE.DISPUTED).length;
      const resolvedCases = disputeRows.filter((row) => Number(row.milestone.state) === ESCROW_STATE.RESOLVED).length;

      let isArbitrator = false;
      try {
        const disputeContract = getDisputeReadContract(provider);
        isArbitrator = await disputeContract.isArbitrator(account);
      } catch {
        isArbitrator = false;
      }

      setStats([
        { label: 'Pending Cases', value: String(pendingCases), accent: 'text-red-600' },
        { label: 'Resolved Cases', value: String(resolvedCases), accent: 'text-green-600' },
        { label: 'Total Case Value', value: `${sumUsd(disputeRows).toFixed(2)} USD`, accent: 'text-blue-600' },
        { label: 'Arbitrator Access', value: isArbitrator ? 'Granted' : 'Missing', accent: isArbitrator ? 'text-gray-900' : 'text-red-600' },
      ]);

      setActivity(
        disputeRows
          .sort(byNewest)
          .slice(0, 5)
          .map((row) => {
            const stateValue = Number(row.milestone.state);
            return {
              title: `Dispute #${row.id}`,
              detail: `Client ${row.milestone.client.slice(0, 6)}...${row.milestone.client.slice(-4)} vs Freelancer ${row.milestone.freelancer.slice(0, 6)}...${row.milestone.freelancer.slice(-4)}`,
              meta: toStateLabel(stateValue),
              border: toActivityBorder(stateValue),
            };
          })
      );

      setLastSyncedAt(new Date());
    } catch (loadError) {
      setError(loadError?.shortMessage || loadError?.message || 'Failed to load dashboard data from chain.');
      setStats([]);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [provider, account, userRole]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const refresh = () => {
      loadDashboard();
    };

    window.addEventListener(TX_CONFIRMED_EVENT, refresh);
    return () => window.removeEventListener(TX_CONFIRMED_EVENT, refresh);
  }, [loadDashboard]);

  useEffect(() => {
    if (!provider || !account) {
      return;
    }

    const refresh = () => {
      loadDashboard();
    };

    const onFocus = () => {
      refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    let unsubscribeBlock = null;
    try {
      if (typeof provider.on === 'function') {
        provider.on('block', refresh);
        unsubscribeBlock = () => {
          if (typeof provider.off === 'function') {
            provider.off('block', refresh);
          }
        };
      }
    } catch {
      unsubscribeBlock = null;
    }

    const intervalId = window.setInterval(refresh, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (unsubscribeBlock) {
        unsubscribeBlock();
      }
    };
  }, [provider, account, loadDashboard]);

  const visibleStats = useMemo(() => {
    if (stats.length > 0) {
      return stats;
    }

    if (userRole === USER_ROLES.FREELANCER) {
      return [
        { label: 'Active Jobs', value: '0', accent: 'text-gray-500' },
        { label: 'Pending Submissions', value: '0', accent: 'text-gray-500' },
        { label: 'Settled Value', value: '0.00 USD', accent: 'text-gray-500' },
        { label: 'Reputation Tier', value: 'NEW ★', accent: 'text-gray-500' },
      ];
    }

    if (userRole === USER_ROLES.ARBITRATOR) {
      return [
        { label: 'Pending Cases', value: '0', accent: 'text-gray-500' },
        { label: 'Resolved Cases', value: '0', accent: 'text-gray-500' },
        { label: 'Total Case Value', value: '0.00 USD', accent: 'text-gray-500' },
        { label: 'Arbitrator Access', value: 'Unknown', accent: 'text-gray-500' },
      ];
    }

    return [
      { label: 'Open Jobs', value: '0', accent: 'text-gray-500' },
      { label: 'Milestones Awaiting Review', value: '0', accent: 'text-gray-500' },
      { label: 'Total Escrow Value', value: '0.00 USD', accent: 'text-gray-500' },
      { label: 'Pending Disputes', value: '0', accent: 'text-gray-500' },
    ];
  }, [stats, userRole]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center text-white px-6">
          <h1 className="text-5xl font-bold mb-6">FreelanceChain</h1>
          <h2 className="text-2xl font-semibold mb-4">Decentralized Freelance Platform</h2>
          <p className="text-lg mb-8 opacity-90">
            Connect with freelancers and clients trustlessly through smart contracts.
            No middleman. No hidden fees. Instant payments.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="mb-3 flex justify-center"><HeroFeatureIcon type="escrow" /></div>
              <h3 className="font-semibold mb-2">Secure Escrow</h3>
              <p className="text-sm opacity-80">Your funds are protected by smart contracts</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="mb-3 flex justify-center"><HeroFeatureIcon type="reputation" /></div>
              <h3 className="font-semibold mb-2">Reputation System</h3>
              <p className="text-sm opacity-80">Soulbound tokens prove your track record</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="mb-3 flex justify-center"><HeroFeatureIcon type="settlement" /></div>
              <h3 className="font-semibold mb-2">Instant Settlement</h3>
              <p className="text-sm opacity-80">Get paid immediately upon completion</p>
            </div>
          </div>

          <button
            onClick={connectWallet}
            className="btn-primary bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-lg"
          >
            Connect MetaMask to Get Started
          </button>

          <div className="mt-12 text-sm opacity-75">
            <p>Currently running on Sepolia Testnet</p>
            <p>Make sure you have testnet ETH and USDC</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <OnchainHealthPanel />

      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-700">{dashboard.subtitle}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <span className="font-semibold">Acting as {roleLabel}</span>
          {roleSource === 'override' && <span>(Override mode)</span>}
        </div>
        {lastSyncedAt && (
          <p className="text-xs text-gray-500 mt-2">
            Last synced: {lastSyncedAt.toLocaleTimeString()}
          </p>
        )}
      </div>

      {loading && (
        <div className="card mb-8 text-sm text-gray-700">Loading live dashboard data from chain...</div>
      )}

      {error && (
        <div className="card mb-8 border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {visibleStats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          {activity.length === 0 ? (
            <div className="card text-sm text-gray-600">No on-chain activity for this role yet.</div>
          ) : (
            <div className="space-y-4">
              {activity.map((item) => (
                <div key={`${item.title}-${item.meta}`} className={`card border-l-4 ${item.border}`}>
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-700">{item.detail}</p>
                    </div>
                    <span className="text-sm text-gray-500">{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="flex flex-col gap-6">
            {dashboard.actions.map((action) => (
              <Link key={action.label} to={action.to} className="block">
                <button className={`w-full py-3 rounded-lg font-semibold ${action.primary ? 'btn-primary' : 'btn-secondary'}`}>
                  {action.label}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
