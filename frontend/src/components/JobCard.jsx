import React from 'react';
import { Link } from 'react-router-dom';
import ReputationBadge from './ReputationBadge';
import { USER_ROLES } from '../constants/contracts';

const ROLE_ACTION_COPY = {
  [USER_ROLES.CLIENT]: { primary: 'View Applicants', primaryTo: 'detail', secondary: 'Edit Job', secondaryTo: '/my-jobs' },
  [USER_ROLES.FREELANCER]: { primary: 'View Details', primaryTo: 'detail', secondary: 'Apply', secondaryTo: 'detail' },
  [USER_ROLES.ARBITRATOR]: { primary: 'Review Brief', primaryTo: 'detail', secondary: 'Watch Job', secondaryTo: 'detail' },
};

const formatStatusLabel = (status) => {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const JobCard = ({ job, userRole }) => {
  const actionCopy = ROLE_ACTION_COPY[userRole] || ROLE_ACTION_COPY[USER_ROLES.FREELANCER];
  const resolveRoute = (target) => {
    if (target === 'detail') {
      return `/jobs/${job.id}`;
    }
    return target || `/jobs/${job.id}`;
  };

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
          {formatStatusLabel(job.status)}
        </span>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>

      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-gray-900">{job.amount} USDC</span>
          <span className="text-xs text-gray-500">{job.milestones} milestones</span>
        </div>
        <ReputationBadge tier={job.clientTier} />
      </div>

      <div className="flex gap-2">
        <Link to={resolveRoute(actionCopy.primaryTo)} className="flex-1">
          <button className="w-full btn-primary text-sm py-2">
            {actionCopy.primary}
          </button>
        </Link>
        <Link to={resolveRoute(actionCopy.secondaryTo)} className="flex-1">
          <button className="w-full btn-secondary text-sm py-2">
            {actionCopy.secondary}
          </button>
        </Link>
      </div>
    </div>
  );
};

export default JobCard;
