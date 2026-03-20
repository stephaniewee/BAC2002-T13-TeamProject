import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';

const DASHBOARD_CONTENT = {
  [USER_ROLES.CLIENT]: {
    subtitle: 'Track funded jobs, review milestones, and handle disputes quickly.',
    stats: [
      { label: 'Open Jobs', value: '4', accent: 'text-gray-900' },
      { label: 'Milestones Awaiting Review', value: '2', accent: 'text-yellow-600' },
      { label: 'Total Escrow Locked', value: '8,750 USDC', accent: 'text-blue-600' },
      { label: 'Pending Disputes', value: '1', accent: 'text-red-600' },
    ],
    activity: [
      { title: 'SaaS Dashboard Design', detail: 'Milestone 2 was submitted for review.', meta: 'Awaiting your approval', border: 'border-l-yellow-500' },
      { title: 'Marketing Website Refresh', detail: 'Freelancer accepted job terms.', meta: 'Started 1 day ago', border: 'border-l-blue-500' },
      { title: 'Smart Contract Audit', detail: 'Final milestone approved.', meta: '-1,250 USDC released', border: 'border-l-green-500' },
    ],
    actions: [
      { label: 'Post New Job', to: '/create-job', primary: true },
      { label: 'Review Disputes', to: '/disputes' },
      { label: 'Browse Talent Market', to: '/browse' },
    ],
  },
  [USER_ROLES.FREELANCER]: {
    subtitle: 'Discover opportunities, submit milestones, and grow your on-chain reputation.',
    stats: [
      { label: 'Active Jobs', value: '3', accent: 'text-gray-900' },
      { label: 'Pending Submissions', value: '1', accent: 'text-yellow-600' },
      { label: 'Total Earned', value: '5,420 USDC', accent: 'text-green-600' },
      { label: 'Reputation Tier', value: 'Gold ★', accent: 'text-yellow-600' },
    ],
    activity: [
      { title: 'Logo Design Sprint', detail: 'Milestone approved by client.', meta: '+500 USDC', border: 'border-l-green-500' },
      { title: 'Website Redesign', detail: 'You applied to this job.', meta: '2 days ago', border: 'border-l-blue-500' },
      { title: 'Mobile App Design', detail: 'Waiting for your submission.', meta: 'Due in 2 days', border: 'border-l-yellow-500' },
    ],
    actions: [
      { label: 'Browse Available Gigs', to: '/browse', primary: true },
      { label: 'Open Dispute Center', to: '/disputes' },
      { label: 'View Active Job', to: '/jobs/1' },
    ],
  },
  [USER_ROLES.ARBITRATOR]: {
    subtitle: 'Review evidence and resolve disputes with transparent fund split votes.',
    stats: [
      { label: 'Pending Cases', value: '2', accent: 'text-red-600' },
      { label: 'Cases Resolved This Week', value: '5', accent: 'text-green-600' },
      { label: 'Avg Resolution Time', value: '19 hrs', accent: 'text-blue-600' },
      { label: 'Arbitrator Reputation', value: 'Silver ★', accent: 'text-gray-900' },
    ],
    activity: [
      { title: 'UI Design for SaaS Dashboard', detail: 'New dispute opened for milestone 2 quality mismatch.', meta: 'Vote needed', border: 'border-l-red-500' },
      { title: 'Smart Contract Audit', detail: 'Case resolved with 60/40 split.', meta: 'Closed yesterday', border: 'border-l-green-500' },
      { title: 'API Integration Service', detail: 'Client raised new evidence packet.', meta: 'Updated 3 hours ago', border: 'border-l-blue-500' },
    ],
    actions: [
      { label: 'Review Disputes', to: '/disputes', primary: true },
      { label: 'Inspect Job Context', to: '/jobs/1' },
      { label: 'Browse Open Jobs', to: '/browse' },
    ],
  },
};

const Home = () => {
  const { isConnected, connectWallet, userRole, roleSource } = useWallet();

  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const dashboard = DASHBOARD_CONTENT[userRole] || DASHBOARD_CONTENT[USER_ROLES.FREELANCER];

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
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-semibold mb-2">Secure Escrow</h3>
              <p className="text-sm opacity-80">Your funds are protected by smart contracts</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="font-semibold mb-2">Reputation System</h3>
              <p className="text-sm opacity-80">Soulbound tokens prove your track record</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6">
              <div className="text-3xl mb-3">⚡</div>
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
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">{dashboard.subtitle}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <span className="font-semibold">Acting as {roleLabel}</span>
          {roleSource === 'override' && <span>(Override mode)</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {dashboard.stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {dashboard.activity.map((item) => (
              <div key={item.title} className={`card border-l-4 ${item.border}`}>
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.detail}</p>
                  </div>
                  <span className="text-sm text-gray-500">{item.meta}</span>
                </div>
              </div>
            ))}
          </div>
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
