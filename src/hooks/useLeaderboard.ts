import { useState, useEffect, useCallback } from 'react';
import {
  // Old utilities no longer used for daily time leaderboard
  // createDistanceLeaderboard,
  // createStreakLeaderboard,
  // createImprovementLeaderboard,
  computeDailyWinners // New utility
} from '../utils/leaderboardUtils';
// import bitcoinRewardsService from '../services/bitcoinRewardsService'; // Deleted
import rewardsPayoutService from '../services/rewardsPayoutService'; // Use new service
import { useSettings } from '../contexts/SettingsContext'; // Import useSettings
import { REWARDS } from '../config/rewardsConfig';

interface PayoutStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  details: any[]; // Store results of payouts
}

/**
 * Custom hook for managing the DAILY time-based leaderboard.
 * @param {string | null} publicKey - Current user's public key.
 * @param {Array<Object>} allRunsToday - Array of ALL run objects recorded today across users.
 * @returns {Object} Leaderboard state and functions.
 */
export const useLeaderboard = (publicKey: string | null, allRunsToday: any[]) => {
  const { leaderboardOptIn } = useSettings(); // Use setting from context
  const [dailyTimeLeaderboard, setDailyTimeLeaderboard] = useState<any[]>([]);
  const [lastCalculatedDate, setLastCalculatedDate] = useState<string | null>(null);

  // State for tracking payout status
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>({
    processing: false,
    success: false,
    error: null,
    details: []
  });

  // Recalculate leaderboard when runs change or opt-in status changes
  useEffect(() => {
    // We only care about opted-in users for the leaderboard calculation
    // However, the calculation function needs the opt-in list directly.
    // Let's assume for now the `allRunsToday` includes data needed, and the scheduler provides the opt-in list.
    // For the hook itself, we mostly display the results.
    // The actual computation might happen in a background task/scheduler.

    // Placeholder: If we had access to all opted-in pubkeys:
    // const optInPubkeys = new Set([...]);
    // const winners = computeDailyWinners(allRunsToday, optInPubkeys);
    // setDailyTimeLeaderboard(winners);

    // Simpler approach for now: Assume leaderboard data is pushed or fetched elsewhere.
    // This hook might just display it.
    // For now, just log recalculation trigger.
    console.log('Leaderboard hook triggered. Opt-in:', leaderboardOptIn);
    // In a real scenario, fetch/calculate leaderboard here based on `allRunsToday` and opt-in status.

  }, [allRunsToday, leaderboardOptIn]); // Depend on runs and opt-in status

  /**
   * Triggers the payout process for the daily leaderboard winners.
   * Should ideally be called by a trusted scheduler/backend process at ~00:10 local time.
   * @param {Array<Object>} winners - The calculated winners for the day.
   * @param {string} payoutDateISO - The ISO date string (YYYY-MM-DD) for which the payout is being made.
   */
  const triggerDailyPayout = useCallback(async (winners: any[], payoutDateISO: string) => {
    if (!winners || winners.length === 0) {
      console.log(`No winners to payout for ${payoutDateISO}`);
      return { success: true, message: 'No winners' };
    }

    setPayoutStatus({ processing: true, success: false, error: null, details: [] });
    const payoutResults: any[] = [];
    let overallSuccess = true;
    let firstError: string | null = null;

    const { first, second, third } = REWARDS.DAILY_LEADERBOARD;
    const amounts = [first, second, third];

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const amount = amounts[i];
      if (!winner.pubkey || !amount) continue;

      try {
        const result = await rewardsPayoutService.sendLeaderboardReward(
          winner.pubkey,
          amount,
          winner.rank,
          payoutDateISO
        );
        payoutResults.push({ rank: winner.rank, pubkey: winner.pubkey, amount, ...result });
        if (!result.success) {
          overallSuccess = false;
          if (!firstError) firstError = result.error || `Rank ${winner.rank} payout failed.`;
          console.error(`Payout failed for rank ${winner.rank} (${winner.pubkey}):`, result.error);
        }
      } catch (error: any) {
        overallSuccess = false;
        const errorMessage = error.message || 'Unknown payout error';
        if (!firstError) firstError = errorMessage;
        payoutResults.push({ rank: winner.rank, pubkey: winner.pubkey, amount, success: false, error: errorMessage });
        console.error(`Error during payout for rank ${winner.rank} (${winner.pubkey}):`, error);
      }
    }

    setPayoutStatus({
      processing: false,
      success: overallSuccess,
      error: firstError,
      details: payoutResults
    });

    return { success: overallSuccess, error: firstError, details: payoutResults };

  }, []); // Dependencies: rewardsPayoutService is stable

  // NOTE: The old structure with multiple leaderboards (distance, streak, improvement)
  // and period selection is removed in favor of the simplified daily time-based leaderboard.
  return {
    participating: leaderboardOptIn, // Use context value
    // toggleParticipation is now handled by SettingsContext directly
    dailyTimeLeaderboard, // The state holding current leaderboard data
    payoutStatus, // Status of the last payout attempt
    triggerDailyPayout // Function to initiate payouts (for scheduler use)
    // Removed: currentPeriod, changePeriod, distance/streak/improvement leaderboards, distributeRewards
  };
}; 