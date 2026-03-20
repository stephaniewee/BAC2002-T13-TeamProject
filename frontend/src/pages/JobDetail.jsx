import React from 'react';
import { useParams } from 'react-router-dom';
import MilestoneCard from '../components/MilestoneCard';
import ReputationBadge from '../components/ReputationBadge';
import { useWallet } from '../hooks/useWallet';
import { USER_ROLES } from '../constants/contracts';

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

const JobDetail = () => {
  // In a real app, this would fetch data from an API or smart contract
  const { id } = useParams();
  const { userRole, roleSource } = useWallet();
  const currentActions = ROLE_ACTIONS[userRole] || ROLE_ACTIONS[USER_ROLES.FREELANCER];

  // Mock job data
  const job = {
    id,
    title: 'UI Design for SaaS Dashboard',
    description: 'Create a modern, responsive dashboard UI with dark mode support for our crypto analytics platform. The design should be clean, intuitive, and follow modern design principles.',
    client: {
      address: '0x742d...B8c0',
      name: 'John Doe',
      tier: 'GOLD',
      jobsCompleted: 15,
      escrowAmount: 1500,
    },
    totalAmount: 1500,
    status: 'in_progress',
    createdAt: '2024-03-10',
    deadline: '2024-04-10',
    milestones: [
      {
        id: 1,
        title: 'Wireframes & User Flow',
        description: 'Create wireframes for all main pages and define user flows',
        amount: 500,
        status: 'approved',
        deadline: '2024-03-20',
        releaseTime: 1,
        deliverables: ['Figma file with wireframes', 'User flow diagram'],
      },
      {
        id: 2,
        title: 'High-Fidelity Designs',
        description: 'Create detailed, polished designs with all components and states',
        amount: 600,
        status: 'submitted',
        deadline: '2024-03-30',
        releaseTime: 3,
        deliverables: ['Figma design file', 'Design system', 'Component library'],
      },
      {
        id: 3,
        title: 'Interactive Prototype & Handoff',
        description: 'Create interactive prototype and prepare handoff document for developers',
        amount: 400,
        status: 'pending',
        deadline: '2024-04-10',
        releaseTime: 5,
        deliverables: ['Interactive prototype', 'Handoff document', 'CSS specifications'],
      },
    ],
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
          <p className="text-3xl font-bold text-blue-600">{job.totalAmount} USDC</p>
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
            <MilestoneCard key={milestone.id} milestone={milestone} index={index} userRole={userRole} />
          ))}
        </div>
      </div>

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
