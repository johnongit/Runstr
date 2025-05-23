/**
 * Streak Rewards Utility
 * Manages streak state and calculations based on the new linear model.
 */
import { REWARDS } from '../config/rewardsConfig';
import rewardsPayoutService from '../services/rewardsPayoutService';

const STREAK_DATA_KEY = 'runstrStreakData';

export interface StreakData {
  currentStreakDays: number;
  lastRewardedDay: number; // The streak day number for which a reward was last given
  lastRunDate: string | null; // ISO date string of the last recorded run
}

/**
 * Get streak data from localStorage.
 * @returns {StreakData} The current streak data.
 */
export const getStreakData = (): StreakData => {
  try {
    const storedData = localStorage.getItem(STREAK_DATA_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (err) {
    console.error('Error loading streak data:', err);
  }
  // Default initial state
  return { currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null };
};

/**
 * Save streak data to localStorage.
 * @param {StreakData} data - The streak data to save.
 * @returns {boolean} Success status.
 */
export const saveStreakData = (data: StreakData): boolean => {
  try {
    localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Error saving streak data:', err);
    return false;
  }
};

/**
 * Updates the user's streak based on a new run.
 * This should be called after a new run is successfully recorded.
 * All date comparisons are done in the user's local time zone.
 * @param {Date} newRunDateObject - The Date object of the new run (in user's local time).
 * @returns {StreakData} The updated streak data.
 */
export const updateUserStreak = (newRunDateObject: Date, publicKey: string | null): StreakData => {
  const data = getStreakData();
  const { capDays } = REWARDS.STREAK;

  const newRunLocalISO = newRunDateObject.toLocaleDateString('sv'); // YYYY-MM-DD format

  if (data.lastRunDate === newRunLocalISO) {
    // Multiple runs on the same day, no change to streak days
    return data;
  }

  let updatedStreakDays = data.currentStreakDays;
  let updatedLastRunDate = data.lastRunDate;

  if (data.lastRunDate) {
    const lastRunDateObject = new Date(data.lastRunDate);
    const diffDays = Math.round((newRunDateObject.getTime() - lastRunDateObject.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      updatedStreakDays++;
    } else if (diffDays > 1) {
      // Missed day(s), streak resets
      updatedStreakDays = 1;
    } else if (diffDays <= 0) {
      // New run is on or before the last run date (e.g. due to time zone changes or manual entry)
      // If it's a different day and earlier, this implies a reset or complex handling.
      // For simplicity now, if it's not the *next* day, assume streak resets if it's a new distinct day.
      // If it's the *same* day, it's handled by the first check.
      // This part might need more robust logic for out-of-order run entries.
      updatedStreakDays = 1;
    }
  } else {
    // First run ever
    updatedStreakDays = 1;
  }

  // If streak exceeds cap, it effectively rolls over for reward calculation logic.
  // The actual currentStreakDays can continue to grow past capDays,
  // but effectiveDaysForReward will be capped.

  const newData: StreakData = {
    ...data, // Preserve lastRewardedDay
    currentStreakDays: updatedStreakDays,
    lastRunDate: newRunLocalISO,
  };

  saveStreakData(newData);

  // Determine if a payout is needed (also enforces capDays)
  const { amountToReward, effectiveDaysForReward } = calculateStreakReward(newData);
  if (amountToReward > 0) {
    const lightningAddress = localStorage.getItem('lightningAddress');
    if (!lightningAddress) {
      console.warn('[StreakRewards] Lightning address not set – cannot pay reward. Ask user to add it in Settings > Wallet.');
    }
    const dest = lightningAddress || publicKey;

    if (dest) {
      rewardsPayoutService
        .sendStreakReward(dest, amountToReward, effectiveDaysForReward, (localStorage.getItem('nwcConnectionString') || null))
        .then((result) => {
          if (result.success) {
            updateLastRewardedDay(effectiveDaysForReward);
            // Notify user
            const successMsg = `🎉 Streak reward sent: ${amountToReward} sats for day ${effectiveDaysForReward}!`;
            if ((window as any).Android?.showToast) {
              (window as any).Android.showToast(successMsg);
            } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Runstr Reward', { body: successMsg });
            } else {
              console.log(successMsg);
            }
          } else {
            console.error('[StreakRewards] Auto-payout failed:', result.error);
            const errMsg = `Reward error: ${result.error}`;
            if ((window as any).Android?.showToast) {
              (window as any).Android.showToast(errMsg);
            } else if (typeof window !== 'undefined') {
              alert(errMsg);
            }
          }
        })
        .catch((err) => {
          console.error('[StreakRewards] Error during auto-payout:', err);
          const errMsg2 = `Reward error: ${err.message || err}`;
          if ((window as any).Android?.showToast) {
            (window as any).Android.showToast(errMsg2);
          } else if (typeof window !== 'undefined') {
            alert(errMsg2);
          }
        });
    } else {
      console.warn('[StreakRewards] Cannot auto-pay reward – pubkey not set.');
    }
  }
  return newData;
};

/**
 * Calculates the reward amount for the current streak status.
 * Does NOT trigger a payout, only calculates.
 * @param {StreakData} streakData - The current streak data for the user.
 * @returns {{ amountToReward: number, effectiveDaysForReward: number, message: string }}
 */
export const calculateStreakReward = (streakData: StreakData): { amountToReward: number, effectiveDaysForReward: number, message: string } => {
  const { currentStreakDays, lastRewardedDay } = streakData;
  const { satsPerDay, capDays } = REWARDS.STREAK;

  if (currentStreakDays === 0) {
    return { amountToReward: 0, effectiveDaysForReward: 0, message: 'No current streak.' };
  }

  // Effective days for reward calculation is capped.
  const effectiveDaysForReward = Math.min(currentStreakDays, capDays);

  // We only reward for days *beyond* the last day we gave a reward for,
  // up to the current effective (capped) streak.
  // Example: lastRewardedDay = 2, currentStreakDays = 4 (effectiveDaysForReward = 4)
  //         Reward for day 3 and day 4. (4 - 2) * satsPerDay = 2 * 50 = 100
  // Example: lastRewardedDay = 0, currentStreakDays = 1 (effectiveDaysForReward = 1)
  //         Reward for day 1. (1 - 0) * satsPerDay = 1 * 50 = 50
  // Example: lastRewardedDay = 7, currentStreakDays = 8 (effectiveDaysForReward = 7)
  //         No new reward, already at cap. (7 - 7) * satsPerDay = 0
  let daysToRewardIncrement = 0;
  if (effectiveDaysForReward > lastRewardedDay) {
      daysToRewardIncrement = effectiveDaysForReward - lastRewardedDay;
  }

  const amountToReward = daysToRewardIncrement * satsPerDay;

  let message = '';
  if (amountToReward > 0) {
      message = `Eligible for ${amountToReward} sats for reaching ${effectiveDaysForReward}-day streak (rewarded for ${daysToRewardIncrement} new day(s)).`;
  } else if (currentStreakDays > 0 && effectiveDaysForReward === lastRewardedDay && effectiveDaysForReward === capDays) {
      message = `Streak at ${currentStreakDays} days (max reward cap of ${capDays} days reached, last rewarded for day ${lastRewardedDay}).`;
  } else if (currentStreakDays > 0 && effectiveDaysForReward <= lastRewardedDay) {
      message = `Current streak: ${currentStreakDays} days. Last rewarded for day ${lastRewardedDay}. No new increment to reward.`;
  } else {
      message = `Current streak: ${currentStreakDays} days.`;
  }

  return { amountToReward, effectiveDaysForReward, message };
};

/**
 * Updates the lastRewardedDay after a successful payout.
 * @param {number} rewardedDayNum - The streak day number that was just successfully rewarded.
 * @returns {StreakData} The updated streak data.
 */
export const updateLastRewardedDay = (rewardedDayNum: number): StreakData => {
  const data = getStreakData();
  const newData: StreakData = {
    ...data,
    lastRewardedDay: Math.max(data.lastRewardedDay, rewardedDayNum)
  };
  saveStreakData(newData);
  return newData;
};

/**
 * Resets all streak data. Called if user account is reset or for debugging.
 */
export const resetStreakDataCompletely = (): StreakData => {
    const initialData: StreakData = { currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null };
    saveStreakData(initialData);
    return initialData;
}

// NOTE: The old functions like getStreakRewards, saveStreakRewards, getEligibleRewards,
// claimReward (local marking), updateRewardTransaction, getClaimedRewardsHistory,
// resetRewardsForNewStreak, checkAndResetRewards, getNextMilestone,
// getRewardsSettings, saveRewardsSettings ARE NO LONGER VALID with the new linear model.
// They are effectively replaced by the functions above and the logic in useStreakRewards.ts hook.
// This file will be renamed to streakUtils.ts or similar to reflect its new purpose.

// ------------- NEW HELPER -----------------
/**
 * Sync streak state coming from an external calculation (e.g. Stats page).
 * If this raises the streak beyond lastRewardedDay, the required sats are
 * automatically paid out.
 * @param {number} externalStreakDays - Current streak length calculated elsewhere.
 */
export const syncStreakWithStats = async (externalStreakDays: number, publicKey: string | null): Promise<StreakData> => {
  const data = getStreakData();
  if (externalStreakDays <= 0) {
    return data;
  }
  const merged: StreakData = {
    ...data,
    currentStreakDays: externalStreakDays,
  };
  saveStreakData(merged);

  // Determine if a payout is needed (also enforces capDays)
  const { amountToReward, effectiveDaysForReward } = calculateStreakReward(merged);
  if (amountToReward > 0) {
    const lightningAddress = localStorage.getItem('lightningAddress');
    if (!lightningAddress) {
      console.warn('[StreakRewards] Lightning address not set – cannot pay reward. Ask user to add it in Settings > Wallet.');
    }
    const dest = lightningAddress || publicKey;

    if (dest) {
      try {
        const result = await rewardsPayoutService.sendStreakReward(dest, amountToReward, effectiveDaysForReward, (localStorage.getItem('nwcConnectionString') || null));
        if (result.success) {
          updateLastRewardedDay(effectiveDaysForReward);
          // Notify user
          const successMsg = `🎉 Streak reward sent: ${amountToReward} sats for day ${effectiveDaysForReward}!`;
          if ((window as any).Android?.showToast) {
            (window as any).Android.showToast(successMsg);
          } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Runstr Reward', { body: successMsg });
          } else {
            console.log(successMsg);
          }
        } else {
          console.error('[StreakRewards] Auto-payout failed:', result.error);
          const errMsg = `Reward error: ${result.error}`;
          if ((window as any).Android?.showToast) {
            (window as any).Android.showToast(errMsg);
          } else if (typeof window !== 'undefined') {
            alert(errMsg);
          }
        }
      } catch (err) {
        console.error('[StreakRewards] Error during auto-payout:', err);
        const errMsg2 = `Reward error: ${err.message || err}`;
        if ((window as any).Android?.showToast) {
          (window as any).Android.showToast(errMsg2);
        } else if (typeof window !== 'undefined') {
          alert(errMsg2);
        }
      }
    } else {
      console.warn('[StreakRewards] Cannot auto-pay reward – pubkey not set.');
    }
  }
  return getStreakData();
};
// ------------- END NEW HELPER -------------

/* 
  The getStoredPubkey function was previously defined here.
  It is no longer used by updateUserStreak or syncStreakWithStats directly through this path.
  It is commented out for now and can be removed if confirmed unused elsewhere.

  const getStoredPubkey = (): string | null => {
    const pk = localStorage.getItem('userPubkey') || localStorage.getItem('nostrPublicKey');
    if (pk) {
      try {
        localStorage.setItem('userPubkey', pk); // normalise key for modules that expect it
      } catch (_) {
        // ignore quota errors 
      }
    }
    return pk;
  };
*/ 