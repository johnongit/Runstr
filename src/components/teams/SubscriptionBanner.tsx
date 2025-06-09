import React from 'react';
import { SubscriptionPhase } from '../../hooks/useTeamSubscriptionStatus';

interface Props {
  phase: SubscriptionPhase;
  amount: number;
  nextDue?: number;
  onRenew: () => void;
  isProcessing: boolean;
}

const phaseText: Record<SubscriptionPhase, string> = {
  current: '',
  overdue: 'Your team subscription is overdue. Please renew to continue participating.',
  removed: 'You have been removed from this team due to non-payment. Renew to rejoin.',
  hidden: 'This team is inactive due to unpaid captain subscription.',
  none: 'No active subscription. Please pay to join.'
};

export const SubscriptionBanner: React.FC<Props> = ({ phase, amount, nextDue, onRenew, isProcessing }) => {
  if (phase === 'current') return null;
  return (
    <div className="bg-red-800/70 text-red-200 p-3 mb-4 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">
          {phaseText[phase]}
          {nextDue && phase !== 'removed' && (
            <span className="ml-1 text-red-300">Due: {new Date(nextDue * 1000).toLocaleDateString()}</span>
          )}
        </p>
      </div>
      {(phase === 'overdue' || phase === 'none') && (
        <button
          onClick={onRenew}
          disabled={isProcessing}
          className="mt-2 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md disabled:opacity-50"
        >
          {isProcessing ? 'Processing…' : `Pay ${amount.toLocaleString()} sats`}
        </button>
      )}
    </div>
  );
};

export default SubscriptionBanner; 