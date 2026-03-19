import React, { useState } from 'react';

const DisputeCard = ({ dispute, userRole }) => {
  const isArbitrator = userRole === 'arbitrator';

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{dispute.jobTitle}</h3>
          <p className="text-sm text-gray-600 mt-1">Milestone {dispute.milestoneNumber}</p>
        </div>
        <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
          In Dispute
        </span>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Dispute Reason</p>
        <p className="text-gray-600">{dispute.reason}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-500 uppercase">Amount at Stake</p>
          <p className="font-bold text-gray-900">{dispute.amount} USDC</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Status</p>
          <p className="font-bold text-gray-900">{dispute.status}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Votes</p>
          <p className="font-bold text-gray-900">{dispute.votes} / 3</p>
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
                  defaultValue="50"
                  className="flex-1"
                />
                <span className="font-bold text-gray-900 w-16 text-right">50/50</span>
              </div>
            </div>
            <button className="w-full btn-primary py-2 rounded-lg font-semibold">
              Submit Vote
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
  const [userRole] = useState('freelancer'); // This would come from wallet/context

  const disputes = [
    {
      id: 1,
      jobTitle: 'UI Design for SaaS Dashboard',
      milestoneNumber: 2,
      amount: 600,
      status: 'pending_arbitration',
      votes: 1,
      reason: 'The freelancer submitted work that does not match the agreed specifications. Colors and spacing are off.',
    },
    {
      id: 2,
      jobTitle: 'Smart Contract Audit',
      milestoneNumber: 1,
      amount: 500,
      status: 'resolved',
      votes: 3,
      reason: 'Client rejected initial audit findings claiming they were misinterpreted.',
    },
  ];

  const pendingDisputes = disputes.filter(d => d.status === 'pending_arbitration');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Disputes</h1>
      <p className="text-gray-600 mb-12">Manage your job disputes and arbitration votes</p>

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
                <DisputeCard key={dispute.id} dispute={dispute} userRole={userRole} />
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
              <DisputeCard key={dispute.id} dispute={dispute} userRole={userRole} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disputes;
