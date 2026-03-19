import React from 'react';
import ReputationBadge from './ReputationBadge';

const JobCard = ({ job }) => {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
          {job.status}
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
        <button className="flex-1 btn-primary text-sm py-2">
          View Details
        </button>
        <button className="flex-1 btn-secondary text-sm py-2">
          Apply
        </button>
      </div>
    </div>
  );
};

export default JobCard;
