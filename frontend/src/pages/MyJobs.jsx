import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';

const DATA_BY_ROLE = {
    [USER_ROLES.CLIENT]: {
        title: 'My Posted Jobs',
        subtitle: 'Track funding status, milestone approvals, and contractor progress.',
        tabs: ['active', 'review', 'completed'],
        jobs: [
            { id: 1, title: 'UI Design for SaaS Dashboard', value: '1500 USDC', status: 'active', note: 'Milestone 2 in progress', cta: 'Open Job' },
            { id: 2, title: 'Landing Page Revamp', value: '900 USDC', status: 'review', note: 'Submission awaiting approval', cta: 'Review Milestone' },
            { id: 3, title: 'Tokenomics Deck', value: '700 USDC', status: 'completed', note: 'Final payout released', cta: 'View Summary' },
        ],
    },
    [USER_ROLES.FREELANCER]: {
        title: 'My Active Work',
        subtitle: 'Manage your applications, delivery deadlines, and payout progress.',
        tabs: ['active', 'applied', 'completed'],
        jobs: [
            { id: 1, title: 'React Component Library', value: '2500 USDC', status: 'active', note: 'Next milestone due in 3 days', cta: 'Submit Work' },
            { id: 2, title: 'API Integration Service', value: '1200 USDC', status: 'applied', note: 'Application under review', cta: 'Track Application' },
            { id: 3, title: 'Design QA Sprint', value: '640 USDC', status: 'completed', note: 'Settled successfully', cta: 'View Receipt' },
        ],
    },
    [USER_ROLES.ARBITRATOR]: {
        title: 'Arbitration Queue',
        subtitle: 'Review evidence, cast votes, and close disputes transparently.',
        tabs: ['active', 'ready_to_vote', 'resolved'],
        jobs: [
            { id: 1, title: 'UI Design for SaaS Dashboard', value: '600 USDC', status: 'ready_to_vote', note: 'Evidence complete, vote pending', cta: 'Cast Vote' },
            { id: 2, title: 'Smart Contract Audit', value: '500 USDC', status: 'active', note: 'Waiting for client rebuttal', cta: 'Review Evidence' },
            { id: 3, title: 'Mobile App Design', value: '800 USDC', status: 'resolved', note: 'Resolved with 70/30 split', cta: 'View Ruling' },
        ],
    },
};

const formatTabLabel = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const MyJobs = () => {
    const { userRole, roleSource } = useWallet();
    const roleData = DATA_BY_ROLE[userRole] || DATA_BY_ROLE[USER_ROLES.FREELANCER];
    const [activeTab, setActiveTab] = useState(roleData.tabs[0]);

    const filteredJobs = useMemo(
        () => roleData.jobs.filter((job) => job.status === activeTab),
        [roleData.jobs, activeTab]
    );

    return (
        <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="mb-10">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">{roleData.title}</h1>
                <p className="text-gray-600">{roleData.subtitle}</p>
                {roleSource === 'override' && (
                    <p className="text-xs text-blue-600 mt-2">Role override is active for testing.</p>
                )}
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
                {roleData.tabs.map((tab) => {
                    const isActive = tab === activeTab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'}`}
                        >
                            {formatTabLabel(tab)}
                        </button>
                    );
                })}
            </div>

            {filteredJobs.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-gray-700 font-semibold mb-1">Nothing in this tab yet</p>
                    <p className="text-gray-500 text-sm">Switch to another tab to view jobs.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredJobs.map((job) => (
                        <div key={job.id} className="card">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{formatTabLabel(job.status)}</p>
                                    <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
                                    <p className="text-gray-600 text-sm mt-1">{job.note}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Amount</p>
                                        <p className="font-bold text-blue-600">{job.value}</p>
                                    </div>
                                    <Link to={`/jobs/${job.id}`}>
                                        <button className="btn-primary px-4 py-2 rounded-lg">{job.cta}</button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyJobs;
