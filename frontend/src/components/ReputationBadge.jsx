import React from 'react';
import { SBT_TIERS } from '../constants/contracts';

const ReputationBadge = ({ tier = 'NEW' }) => {
  const tierData = SBT_TIERS[tier] || SBT_TIERS.NEW;

  return (
    <div
      className="inline-flex items-center px-3 py-1 rounded-full font-medium text-sm"
      style={{
        backgroundColor: `${tierData.color}20`,
        color: tierData.color,
        border: `1px solid ${tierData.color}40`,
      }}
    >
      ★ {tierData.name}
    </div>
  );
};

export default ReputationBadge;
