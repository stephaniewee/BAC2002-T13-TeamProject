import React, { useState } from 'react';
import { MILESTONE_STATUS, USER_ROLES } from '../constants/contracts';

const StatusIcon = ({ status }) => {
  if (status === MILESTONE_STATUS.PENDING) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12a.75.75 0 00-1.5 0v4a.75.75 0 00.22.53l2.5 2.5a.75.75 0 101.06-1.06l-2.28-2.28V6z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === MILESTONE_STATUS.SUBMITTED) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M3 10a.75.75 0 01.75-.75h8.19L9.72 7.03a.75.75 0 111.06-1.06l3.5 3.5a.75.75 0 010 1.06l-3.5 3.5a.75.75 0 11-1.06-1.06l2.22-2.22H3.75A.75.75 0 013 10z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === MILESTONE_STATUS.APPROVED) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.414l-7.07 7.07a1 1 0 01-1.414 0L4.696 10.25a1 1 0 111.414-1.414l2.817 2.817 6.363-6.363a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === MILESTONE_STATUS.DISPUTED) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5a.75.75 0 001.5 0v-3a.75.75 0 00-1.5 0v3zm0-6a.75.75 0 001.5 0V7a.75.75 0 00-1.5 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === MILESTONE_STATUS.RESOLVED) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.414l-7.07 7.07a1 1 0 01-1.414 0L4.696 10.25a1 1 0 111.414-1.414l2.817 2.817 6.363-6.363a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
        <path d="M13.5 4.5a.75.75 0 011.06 0l1.44 1.44a.75.75 0 11-1.06 1.06L13.5 5.56a.75.75 0 010-1.06z" />
      </svg>
    );
  }

  return null;
};

const MilestoneCard = ({
  milestone,
  index,
  userRole,
  onSubmitWork,
  onApprove,
  onDispute,
  txState,
}) => {
  const [deliverableHash, setDeliverableHash] = useState('');

  const formatStatusLabel = (status) => {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case MILESTONE_STATUS.PENDING:
        return { bg: 'bg-gray-100', text: 'text-gray-700' };
      case MILESTONE_STATUS.SUBMITTED:
        return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
      case MILESTONE_STATUS.APPROVED:
        return { bg: 'bg-green-100', text: 'text-green-700' };
      case MILESTONE_STATUS.DISPUTED:
        return { bg: 'bg-red-100', text: 'text-red-700' };
      case MILESTONE_STATUS.RESOLVED:
        return { bg: 'bg-purple-100', text: 'text-purple-700' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
  };

  const colors = getStatusColor(milestone.status);
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Milestone {index + 1}: {milestone.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} inline-flex items-center gap-1`}>
          <StatusIcon status={milestone.status} />
          <span>{formatStatusLabel(milestone.status)}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 py-3 border-t border-gray-200">
        <div>
          <span className="text-xs text-gray-500 uppercase">Amount</span>
          <p className="text-lg font-bold text-gray-900">{milestone.amount} USDC</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Deadline</span>
          <p className="text-sm font-medium text-gray-900">{milestone.deadline}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Release</span>
          <p className="text-sm font-medium text-gray-900">{milestone.releaseTime} days</p>
        </div>
      </div>

      {milestone.status === MILESTONE_STATUS.PENDING && userRole === USER_ROLES.FREELANCER && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
          <input
            type="text"
            value={deliverableHash}
            onChange={(event) => setDeliverableHash(event.target.value)}
            placeholder="Deliverable hash (bytes32, 0x...64 hex) *"
            className="flex-1 input-base text-sm"
            required
          />
          <button
            onClick={() => onSubmitWork(milestone.id, deliverableHash)}
            disabled={txState.loading}
            className="btn-primary text-sm py-2 px-4"
          >
            {txState.loading ? 'Submitting...' : 'Submit Work'}
          </button>
        </div>
      )}

      {milestone.status === MILESTONE_STATUS.SUBMITTED && userRole === USER_ROLES.CLIENT && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={() => onApprove(milestone.id)}
            disabled={txState.loading}
            className="flex-1 btn-success text-sm py-2"
          >
            {txState.loading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => onDispute(milestone.id)}
            disabled={txState.loading}
            className="flex-1 btn-danger text-sm py-2"
          >
            {txState.loading ? 'Processing...' : 'Dispute'}
          </button>
        </div>
      )}

      {milestone.status === MILESTONE_STATUS.DISPUTED && userRole === USER_ROLES.ARBITRATOR && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
          <button className="flex-1 btn-primary text-sm py-2">Open Arbitration</button>
        </div>
      )}

      {(txState.message || txState.error || txState.txHash) && (
        <div className={`mt-4 p-3 rounded-lg border text-xs ${txState.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {txState.message && <p>{txState.message}</p>}
          {txState.txHash && <p className="break-all mt-1">Tx: {txState.txHash}</p>}
          {txState.error && <p>{txState.error}</p>}
        </div>
      )}
    </div>
  );
};

export default MilestoneCard;
