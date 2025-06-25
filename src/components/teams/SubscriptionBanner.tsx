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
  // Subscription system disabled for teams feature
  return null;
};

export default SubscriptionBanner; 