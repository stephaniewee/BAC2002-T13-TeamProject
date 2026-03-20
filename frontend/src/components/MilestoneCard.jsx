import React, { useState } from 'react';
import { MILESTONE_STATUS, USER_ROLES } from '../constants/contracts';

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
  const statusIcon = {
    [MILESTONE_STATUS.PENDING]: '⏳',
    [MILESTONE_STATUS.SUBMITTED]: '📤',
    [MILESTONE_STATUS.APPROVED]: '✓',
    [MILESTONE_STATUS.DISPUTED]: '⚠',
    [MILESTONE_STATUS.RESOLVED]: '🏁',
  };

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Milestone {index + 1}: {milestone.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
          {statusIcon[milestone.status]} {milestone.status}
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
            placeholder="Deliverable hash (bytes32, 0x...64 hex)"
            className="flex-1 input-base text-sm"
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
