/**
 * Simple Scheduler for background reward tasks.
 * NOTE: In a real mobile app, this would use platform-specific background fetch/task APIs.
 * For web/demo, this uses basic setTimeout which is NOT reliable for long-term scheduling.
 */
import { getStreakData, calculateStreakReward, updateLastRewardedDay } from '../utils/streakUtils';
import { computeDailyWinners } from '../utils/leaderboardUtils';
import rewardsPayoutService from './rewardsPayoutService';
import event100kService from './event100kService';
import runDataService from './RunDataService'; // Assuming this provides access to run data
import { REWARDS } from '../config/rewardsConfig';

// --- Constants ---
const DAILY_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes (for demo)
// const DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Realistically: 24 hours

const LAST_CHECK_KEY_STREAK = 'lastStreakRewardCheckDate';
const LAST_CHECK_KEY_LEADERBOARD = 'lastLeaderboardRewardCheckDate';
const LAST_CHECK_KEY_EVENT_PAYOUT = 'lastEventPayoutCheckDate';

// --- Helper Functions ---

/** Gets today's date string in YYYY-MM-DD format (local time). */
const getTodayLocalISO = () => new Date().toLocaleDateString('sv');

/** Gets yesterday's date string in YYYY-MM-DD format (local time). */
const getYesterdayLocalISO = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('sv');
};

/**
 * Fetch runs for a specific calendar day (local time).
 * Falls back to timestamp comparison when the stored `date` field format
 * is inconsistent across locales. A run is considered within the day if its
 * `timestamp` occurs between 00:00:00.000 and 23:59:59.999 *local time* of
 * the provided `isoDate` (formatted YYYY-MM-DD).
 *
 * NOTE: We keep this logic here instead of adding a new public method to
 * `RunDataService` to minimise surface-area changes. When we introduce a
 * backend or indexed DB later, we can move this helper next to the data layer.
 */
const getRunsForDate = (isoDate: string) => {
  const startOfDay = new Date(`${isoDate}T00:00:00`).getTime();
  const endOfDay = new Date(`${isoDate}T23:59:59.999`).getTime();

  const allRuns = runDataService.getAllRuns();

  return allRuns.filter((run: any) => {
    // Prefer explicit timestamp if present
    if (typeof run.timestamp === 'number') {
      return run.timestamp >= startOfDay && run.timestamp <= endOfDay;
    }

    // Fallback to parsing the stored date string, attempting common formats
    if (run.date) {
      // Try ISO first (sv locale)
      let runDate = new Date(run.date);
      if (isNaN(runDate.getTime())) {
        // Attempt locale-dependent parse (e.g., MM/DD/YYYY)
        const parts = run.date.split(/[\/-]/);
        if (parts.length === 3) {
          // Assume order: month, day, year (US) → convert to ISO
          const [p1, p2, p3] = parts.map(Number);
          const yyyy = p3 < 100 ? 2000 + p3 : p3; // naive 2-digit year fix
          // Months are 0-based in Date
          runDate = new Date(yyyy, p1 - 1, p2);
        }
      }

      const ts = runDate.getTime();
      return ts >= startOfDay && ts <= endOfDay;
    }

    return false;
  });
};

/** Reads leaderboardOptIn directly from localStorage. */
const getLeaderboardOptInStatusFromStorage = (): boolean => {
  try {
    const settingsString = localStorage.getItem('settings');
    if (settingsString) {
      const settings = JSON.parse(settingsString);
      return !!settings.leaderboardOptIn;
    }
  } catch (error) {
    console.error('[Scheduler] Error reading leaderboardOptIn from localStorage:', error);
  }
  return false; // Default to false if not found or error
};

/** Fetches all opted-in users. Needs backend/alternative mechanism. */
const getOptedInUsers = () => {
    // Placeholder: In a real app, this needs a way to know all users who opted-in.
    // For localStorage demo, we only know the *current* user's setting.
    console.warn('[Scheduler] getOptedInUsers needs a proper implementation (backend or P2P mechanism).');
    // Returning a dummy Set including the current user if opted in.
    const leaderboardOptIn = getLeaderboardOptInStatusFromStorage();
    const currentUserPubkey = localStorage.getItem('userPubkey'); // Example of getting current user
    
    const set = new Set<string>();
    if (leaderboardOptIn && currentUserPubkey) {
        set.add(currentUserPubkey);
    }
    // Add dummy users for testing
    // set.add('dummyUser1');
    // set.add('dummyUser2');
    return set;
}

// --- Scheduled Tasks ---

/** Check and process streak rewards. */
const checkStreakRewards = async () => {
  const today = getTodayLocalISO();
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY_STREAK);

  if (lastCheck === today) {
    console.log('[Scheduler] Streak rewards already checked today.');
    return;
  }

  console.log(`[Scheduler] Checking streak rewards for ${today}...`);
  const streakData = getStreakData();
  const { amountToReward, effectiveDaysForReward } = calculateStreakReward(streakData);

  if (amountToReward > 0) {
    const lightningAddress = localStorage.getItem('lightningAddress');
    const dest = lightningAddress || localStorage.getItem('userPubkey');
    if (dest) {
      console.log(`[Scheduler] Attempting to pay ${amountToReward} sats for ${effectiveDaysForReward}-day streak.`);
      const result = await rewardsPayoutService.sendStreakReward(dest, amountToReward, effectiveDaysForReward, (localStorage.getItem('nwcConnectionString') || null));
      if (result.success) {
        console.log(`[Scheduler] Streak reward payout successful (TxID: ${result.txid}). Updating lastRewardedDay.`);
        updateLastRewardedDay(effectiveDaysForReward);
      } else {
        console.error(`[Scheduler] Streak reward payout failed:`, result.error);
        // Consider retry logic or error logging
      }
    } else {
      console.warn('[Scheduler] Cannot process streak reward: user pubkey not found.');
    }
  }

  localStorage.setItem(LAST_CHECK_KEY_STREAK, today);
};

/** Check and process daily leaderboard rewards. */
const checkLeaderboardRewards = async () => {
  const today = getTodayLocalISO();
  const yesterday = getYesterdayLocalISO();
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY_LEADERBOARD);

  if (lastCheck === today) {
    console.log('[Scheduler] Leaderboard rewards already checked today.');
    return;
  }

  console.log(`[Scheduler] Checking leaderboard rewards for ${yesterday}...`);
  // Fetch runs from *yesterday*
  const runsYesterday = getRunsForDate(yesterday);
  const optInPubkeys = getOptedInUsers(); // Get the set of users who opted in

  if (runsYesterday.length > 0 && optInPubkeys.size > 0) {
    const winners = computeDailyWinners(runsYesterday, optInPubkeys);
    if (winners.length > 0) {
      console.log(`[Scheduler] Found winners for ${yesterday}:`, winners);
      // Trigger payouts (this function is in useLeaderboard hook, ideally should be callable from here)
      // For now, directly call the payout service. A dedicated function would be better.
      const { first, second, third } = REWARDS.DAILY_LEADERBOARD;
      const amounts = [first, second, third];
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const amount = amounts[i];
        if (winner.pubkey && amount) {
           console.log(`[Scheduler] Paying rank ${winner.rank} (${winner.pubkey}): ${amount} sats.`);
           await rewardsPayoutService.sendLeaderboardReward(winner.pubkey, amount, winner.rank, yesterday);
           // Basic logging, more robust status tracking needed in a real app
        }
      }
    } else {
      console.log(`[Scheduler] No eligible winners found for ${yesterday}.`);
    }
  } else {
    console.log(`[Scheduler] No runs recorded or no users opted in for ${yesterday}.`);
  }

  localStorage.setItem(LAST_CHECK_KEY_LEADERBOARD, today);
};

/** Check and process event payouts *after* the event end date. */
const checkEventPayouts = async () => {
    const today = getTodayLocalISO();
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY_EVENT_PAYOUT);
    const eventEnd = new Date(REWARDS.EVENT_100K.endUtc);

    // Only run after event end and only once per day
    if (new Date() <= eventEnd || lastCheck === today) {
        if(lastCheck === today) console.log('[Scheduler] Event payouts already checked today.');
        return;
    }

    console.log(`[Scheduler] Checking event payouts for ${event100kService.EVENT_ID}...`);
    try {
        const result = await event100kService.processEventPayouts();
        console.log('[Scheduler] Event payout processing complete:', result);
    } catch (error) {
        console.error('[Scheduler] Error processing event payouts:', error);
    }

    localStorage.setItem(LAST_CHECK_KEY_EVENT_PAYOUT, today);
};

// --- Scheduler Initialization ---

let schedulerIntervalId: NodeJS.Timeout | null = null;

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('[Scheduler] Unhandled Rejection:', event.reason);
  // Potentially add more robust error reporting here
};

export const startRewardScheduler = () => {
  if (schedulerIntervalId) {
    console.log('[Scheduler] Reward scheduler already running.');
    return;
  }

  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  console.log(`[Scheduler] Starting reward scheduler (checking every ${DAILY_CHECK_INTERVAL_MS / 60000} minutes).`);

  const runChecks = () => {
    console.log('[Scheduler] Running scheduled checks...');
    checkStreakRewards().catch(console.error);
    // Leaderboard and event reward processing disabled for now
    // checkLeaderboardRewards().catch(console.error);
    // checkEventPayouts().catch(console.error);
  };

  // Run immediately on start, then set interval
  runChecks();
  schedulerIntervalId = setInterval(runChecks, DAILY_CHECK_INTERVAL_MS);
};

export const stopRewardScheduler = () => {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    schedulerIntervalId = null;
    console.log('[Scheduler] Reward scheduler stopped.');
  }
};

// Optional: Auto-start the scheduler when the app loads
// startRewardScheduler(); 