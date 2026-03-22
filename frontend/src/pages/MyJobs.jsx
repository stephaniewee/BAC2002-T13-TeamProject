import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';
import {
    ensureSepoliaNetwork,
    loadEscrowMilestones,
    TX_CONFIRMED_EVENT,
} from '../utils/contracts';

const ROLE_VIEW_BY_ROLE = {
    [USER_ROLES.CLIENT]: {
        title: 'My Posted Jobs',
        subtitle: 'Track funding status, milestone approvals, and contractor progress.',
        tabs: ['active', 'review', 'completed'],
    },
    [USER_ROLES.FREELANCER]: {
        title: 'My Active Work',
        subtitle: 'Manage your applications, delivery deadlines, and payout progress.',
        tabs: ['active', 'applied', 'completed'],
    },
    [USER_ROLES.ARBITRATOR]: {
        title: 'Arbitration Queue',
        subtitle: 'Review evidence, cast votes, and close disputes transparently.',
        tabs: ['ready_to_vote', 'resolved'],
    },
};

const EMPTY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const getClientStatus = (stateValue) => {
    if (stateValue === 3) return 'review';
    if (stateValue === 4 || stateValue === 6) return 'completed';
    return 'active';
};

const getFreelancerStatus = (stateValue) => {
    if (stateValue === 0) return 'applied';
    if (stateValue === 4 || stateValue === 6) return 'completed';
    return 'active';
};

const getArbitratorStatus = (stateValue) => {
    if (stateValue === 6) return 'resolved';
    return 'ready_to_vote';
};

const formatTabLabel = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const MyJobs = () => {
    const { userRole, roleSource, provider, account } = useWallet();
    const roleData = ROLE_VIEW_BY_ROLE[userRole] || ROLE_VIEW_BY_ROLE[USER_ROLES.FREELANCER];
    const [activeTab, setActiveTab] = useState(roleData.tabs[0]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        setActiveTab(roleData.tabs[0]);
    }, [roleData.tabs]);

    const loadJobs = useCallback(async () => {
        if (!provider || !account) {
            return;
        }

        try {
            setLoading(true);
            setLoadError('');

            await ensureSepoliaNetwork(provider);
            const rows = await loadEscrowMilestones(provider);
            const count = rows.length;

            if (count === 0) {
                setJobs([]);
                return;
            }

            const normalizedAccount = account.toLowerCase();
            const nextJobs = rows
                .filter(({ milestone }) => {
                    const client = milestone.client.toLowerCase();
                    const freelancer = milestone.freelancer.toLowerCase();
                    const stateValue = Number(milestone.state);

                    if (userRole === USER_ROLES.CLIENT) {
                        return client === normalizedAccount;
                    }

                    if (userRole === USER_ROLES.FREELANCER) {
                        return freelancer === normalizedAccount;
                    }

                    return stateValue === 5 || stateValue === 6;
                })
                .map(({ id, milestone, meta }) => {
                    const stateValue = Number(milestone.state);
                    const amount = (Number(milestone.amountUSD) / 1e8).toFixed(2);
                    const hasSubmission = milestone.deliverableHash !== EMPTY_HASH;
                    const shortClient = `${milestone.client.slice(0, 6)}...${milestone.client.slice(-4)}`;
                    const shortFreelancer = `${milestone.freelancer.slice(0, 6)}...${milestone.freelancer.slice(-4)}`;

                    let status = 'active';
                    let note = 'Milestone is active on-chain.';
                    let cta = 'Open Job';
                    let title = `Escrow Milestone #${id}`;

                    if (meta) {
                        title = `Milestone #${id} · ${shortClient} -> ${shortFreelancer}`;
                    }

                    if (userRole === USER_ROLES.CLIENT) {
                        status = getClientStatus(stateValue);
                        if (status === 'review') {
                            note = 'Submission is pending your approval.';
                            cta = 'Review Milestone';
                        } else if (status === 'completed') {
                            note = 'Milestone has been settled on-chain.';
                            cta = 'View Summary';
                        } else {
                            note = hasSubmission ? 'Work submitted, waiting for state update.' : 'Funding/delivery in progress.';
                        }
                    } else if (userRole === USER_ROLES.FREELANCER) {
                        status = getFreelancerStatus(stateValue);
                        if (status === 'applied') {
                            note = 'Milestone created; waiting for client funding.';
                            cta = 'Track Funding';
                        } else if (status === 'completed') {
                            note = 'Milestone was completed or resolved.';
                            cta = 'View Receipt';
                        } else {
                            note = hasSubmission ? 'Submission sent; waiting for client decision.' : 'Milestone in progress.';
                            cta = 'Submit Work';
                        }
                    } else {
                        status = getArbitratorStatus(stateValue);
                        if (status === 'resolved') {
                            note = 'Dispute already resolved.';
                            cta = 'View Ruling';
                        } else {
                            note = 'Dispute awaiting arbitrator action.';
                            cta = 'Cast Vote';
                        }
                    }

                    return {
                        id,
                        title,
                        value: `${amount} USD`,
                        status,
                        note,
                        cta,
                    };
                });

            setJobs(nextJobs);
        } catch (error) {
            setLoadError(error?.shortMessage || error?.message || 'Unable to load jobs from chain.');
        } finally {
            setLoading(false);
        }
    }, [provider, account, userRole]);

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

    const filteredJobs = useMemo(
        () => jobs.filter((job) => job.status === activeTab),
        [jobs, activeTab]
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

            {loading && (
                <div className="card mb-6 text-sm text-gray-700">Loading your milestones from EscrowContract...</div>
            )}

            {loadError && (
                <div className="card mb-6 border border-red-200 bg-red-50 text-sm text-red-700">{loadError}</div>
            )}

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
