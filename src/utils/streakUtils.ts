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

  // Get YYYY-MM-DD from the Date object, using UTC methods
  // newRunDateObject is created from a UTC timestamp (Date.now() or runData.timestamp)
  // so .toISOString().split('T')[0] will give the YYYY-MM-DD in UTC.
  const newRunUTCDateString = newRunDateObject.toISOString().split('T')[0];

  if (data.lastRunDate === newRunUTCDateString) {
    // Multiple runs on the same UTC day, no change to streak days
    return data;
  }

  let updatedStreakDays = data.currentStreakDays;

  if (data.lastRunDate) {
    // data.lastRunDate is, or will become, a UTC YYYY-MM-DD string.
    // Construct Date objects as UTC midnight for fair day difference calculation.
    const lastRunEpoch = new Date(data.lastRunDate + 'T00:00:00Z').getTime();
    const currentRunEpoch = new Date(newRunUTCDateString + 'T00:00:00Z').getTime();

    const diffDays = Math.round((currentRunEpoch - lastRunEpoch) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive UTC day
      updatedStreakDays++;
    } else if (diffDays > 1) {
      // Missed UTC day(s), streak resets
      updatedStreakDays = 1;
    } else if (diffDays <= 0) { 
      // This case means: 
      // 1. diffDays === 0: Same UTC day, already handled by the initial check.
      //    (This exact condition should not be met here due to the first check if lastRunDate was already UTC YYYY-MM-DD)
      //    If lastRunDate was a local date string that parsed to the same UTC day as newRunUTCDateString, 
      //    it would be caught by the first `if`. 
      //    If it parsed to an *earlier part of the same UTC day*, diffDays could be < 1 but > 0 (e.g. 0.x for hours within same day)
      //    Rounding to 0 would mean it's treated as the same day.
      // 2. diffDays < 0: New run's UTC date is before the last run's UTC date. This implies an out-of-order entry or data issue.
      //    Streak should reset.
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
    lastRunDate: newRunUTCDateString, // Store the UTC YYYY-MM-DD string
  };

  saveStreakData(newData);

  // Determine if a payout is needed (also enforces capDays)
  const { amountToReward, effectiveDaysForReward } = calculateStreakReward(newData);
  console.log('[StreakUtils] updateUserStreak: Calculated reward. Amount:', amountToReward, 'Effective Days:', effectiveDaysForReward, 'Pubkey:', publicKey);

  if (amountToReward > 0) {
    const lightningAddress = localStorage.getItem('lightningAddress');
    // if (!lightningAddress) { // This warning is fine, primary is pubkey
    //   console.warn('[StreakRewards] Lightning address not set – cannot pay reward. Ask user to add it in Settings > Wallet.');
    // }
    const dest = lightningAddress || publicKey;
    console.log('[StreakUtils] updateUserStreak: Destination for reward:', dest);

    if (dest) {
      console.log('[StreakUtils] updateUserStreak: `dest` is valid, attempting optimistic notification.');
      const pendingMsg = `🚀 Sending ${amountToReward} sats reward…`;
      
      let optimisticToastShown = false;
      if ((window as any).Android?.showToast) {
        try {
          console.log('[StreakUtils] updateUserStreak: Attempting Android optimistic toast...');
          (window as any).Android.showToast(pendingMsg);
          optimisticToastShown = true;
          console.log('[StreakUtils] updateUserStreak: Android optimistic toast attempted.');
        } catch (e) {
          console.error('[StreakUtils] updateUserStreak: Error calling Android optimistic toast:', e);
        }
      }
      
      if (!optimisticToastShown && typeof window !== 'undefined') { // Fallback for web/dev
        console.log('[StreakUtils] updateUserStreak: Attempting console.log optimistic notification:', pendingMsg);
      } else if (!optimisticToastShown) {
        console.log('[StreakUtils] updateUserStreak: No optimistic notification method available (not Android, not browser window).');
      }

      rewardsPayoutService
        .sendStreakReward(dest, amountToReward, effectiveDaysForReward, (localStorage.getItem('nwcConnectionString') || null))
        .then((result) => {
          console.log('[StreakUtils] updateUserStreak: sendStreakReward promise resolved. Result success:', result.success);
          if (result.success) {
            updateLastRewardedDay(effectiveDaysForReward);
            const successMsg = `🎉 Streak reward sent: ${amountToReward} sats for day ${effectiveDaysForReward}!`;
            console.log('[StreakUtils] updateUserStreak: Attempting success notification.');

            let successToastShown = false;
            if ((window as any).Android?.showToast) {
              try {
                console.log('[StreakUtils] updateUserStreak: Attempting Android success toast...');
                (window as any).Android.showToast(successMsg);
                successToastShown = true;
                console.log('[StreakUtils] updateUserStreak: Android success toast attempted.');
              } catch (e) {
                console.error('[StreakUtils] updateUserStreak: Error calling Android success toast:', e);
              }
            }
            
            if (!successToastShown && typeof window !== 'undefined' && 'Notification' in window) {
              console.log('[StreakUtils] updateUserStreak: Attempting Browser Notification. Permission:', Notification.permission);
              if (Notification.permission === 'granted') {
                try {
                  new Notification('Runstr Reward', { body: successMsg });
                  successToastShown = true;
                  console.log('[StreakUtils] updateUserStreak: Browser Notification shown.');
                } catch (e) {
                   console.error('[StreakUtils] updateUserStreak: Error showing Browser Notification:', e);
                }
              } else if (Notification.permission === 'default') {
                console.log('[StreakUtils] updateUserStreak: Browser Notification permission is default. Requesting...');
                Notification.requestPermission().then(permission => {
                  console.log('[StreakUtils] updateUserStreak: Browser Notification permission result:', permission);
                  if (permission === 'granted') {
                    try {
                      new Notification('Runstr Reward', { body: successMsg });
                      console.log('[StreakUtils] updateUserStreak: Browser Notification shown after request.');
                    } catch (e) {
                       console.error('[StreakUtils] updateUserStreak: Error showing Browser Notification after request:', e);
                    }
                  }
                });
              }
            }
            
            if (!successToastShown) {
                 console.log('[StreakUtils] updateUserStreak: Fallback console.log success notification:', successMsg);
            }

          } else {
            console.warn('[StreakUtils] updateUserStreak: Payout service reported failure. Error:', result.error);
            // Opted to not show an error toast here as the payment might have gone through if NWC response was unparseable
            // console.warn('[StreakRewards] Payout may have succeeded but response decode failed:', result.error);
          }
        })
        .catch((err) => {
          console.warn('[StreakUtils] updateUserStreak: sendStreakReward promise was rejected. This is unusual as sendRewardZap should catch errors. Error:', err);
          // console.warn('[StreakRewards] Payout flow threw, but payment likely already sent:', err);
        });
    } else {
      console.warn('[StreakUtils] updateUserStreak: Reward payable, but `dest` is null/undefined. Pubkey:', publicKey, 'LN Address in LS:', lightningAddress);
    }
  } else {
    console.log('[StreakUtils] updateUserStreak: No reward amount due.');
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
          // Most NWC wallets return the payment result encrypted; if decryption fails
          // we may still have paid.  We log the error for developers but avoid alarming
          // the runner – the optimistic toast was already shown.
          console.warn('[StreakRewards] Payout may have succeeded but response decode failed:', result.error);
        }
      } catch (err) {
        console.warn('[StreakRewards] Payout flow threw, but payment likely already sent:', err);
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