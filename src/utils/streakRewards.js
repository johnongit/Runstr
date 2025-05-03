/**
 * Streak Rewards Utility
 * Manages streak rewards, tracking eligibility, and claim status.
 */

// Default streak rewards configuration
const DEFAULT_STREAK_REWARDS = [
  { days: 2, sats: 100, claimed: false },
  { days: 4, sats: 250, claimed: false },
  { days: 7, sats: 500, claimed: false }
];

/**
 * Initialize or get streak rewards from localStorage
 * @returns {Array} Array of streak reward objects
 */
export const getStreakRewards = () => {
  try {
    const storedRewards = localStorage.getItem('streakRewards');
    if (storedRewards) {
      return JSON.parse(storedRewards);
    }
  } catch (err) {
    console.error('Error loading streak rewards:', err);
  }
  
  // Initialize with default rewards if not found
  saveStreakRewards(DEFAULT_STREAK_REWARDS);
  return DEFAULT_STREAK_REWARDS;
};

/**
 * Save streak rewards to localStorage
 * @param {Array} rewards - Array of streak reward objects
 * @returns {boolean} Success status
 */
export const saveStreakRewards = (rewards) => {
  try {
    localStorage.setItem('streakRewards', JSON.stringify(rewards));
    return true;
  } catch (err) {
    console.error('Error saving streak rewards:', err);
    return false;
  }
};

/**
 * Check if user is eligible for any unclaimed rewards
 * @param {number} currentStreak - User's current streak
 * @returns {Array} Array of eligible unclaimed rewards
 */
export const getEligibleRewards = (currentStreak) => {
  const rewards = getStreakRewards();
  return rewards.filter(reward => 
    currentStreak >= reward.days && !reward.claimed
  );
};

/**
 * Mark a reward as claimed and record in history
 * @param {number} days - The streak days milestone
 * @param {string} pubkey - User's public key for Bitcoin rewards
 * @returns {boolean} Success status
 */
export const claimReward = (days, pubkey) => {
  const rewards = getStreakRewards();
  const rewardIndex = rewards.findIndex(reward => reward.days === days);
  
  if (rewardIndex === -1) {
    console.error('Reward not found for days:', days);
    return false;
  }
  
  // Get the reward amount
  const satAmount = rewards[rewardIndex].sats;
  
  // Mark as claimed
  rewards[rewardIndex].claimed = true;
  
  // Save the claimed reward to history
  const claimedHistory = getClaimedRewardsHistory();
  claimedHistory.push({
    days,
    sats: satAmount,
    pubkey: pubkey || 'unknown',
    date: new Date().toISOString(),
    status: 'claimed' // Initial status before Bitcoin confirmation
  });
  
  // Save both updates
  localStorage.setItem('claimedRewards', JSON.stringify(claimedHistory));
  return saveStreakRewards(rewards);
};

/**
 * Update a claimed reward with transaction details
 * @param {Object} txInfo - The transaction information
 * @returns {boolean} Success status
 */
export const updateRewardTransaction = (txInfo) => {
  const { days, txid, status } = txInfo;
  
  if (!days || !status) {
    console.error('Invalid transaction info:', txInfo);
    return false;
  }
  
  const claimedHistory = getClaimedRewardsHistory();
  const updatedHistory = claimedHistory.map(record => {
    if (record.days === days && record.status === 'claimed') {
      return {
        ...record,
        txid: txid || record.txid,
        status: status,
        confirmedAt: status === 'confirmed' ? new Date().toISOString() : record.confirmedAt
      };
    }
    return record;
  });
  
  try {
    localStorage.setItem('claimedRewards', JSON.stringify(updatedHistory));
    return true;
  } catch (err) {
    console.error('Error updating reward transaction:', err);
    return false;
  }
};

/**
 * Get history of claimed rewards
 * @returns {Array} Array of claimed reward records
 */
export const getClaimedRewardsHistory = () => {
  try {
    const history = localStorage.getItem('claimedRewards');
    if (history) {
      return JSON.parse(history);
    }
  } catch (err) {
    console.error('Error loading claimed rewards history:', err);
  }
  return [];
};

/**
 * Reset rewards for a new streak
 * Call this when a streak is broken
 * @returns {boolean} Success status
 */
export const resetRewardsForNewStreak = () => {
  const rewards = getStreakRewards();
  const resetRewards = rewards.map(reward => ({
    ...reward,
    claimed: false
  }));
  return saveStreakRewards(resetRewards);
};

/**
 * Check if a new streak requires resetting rewards
 * @param {number} prevStreak - Previous streak length
 * @param {number} currentStreak - Current streak length
 * @returns {boolean} Whether reward reset is needed
 */
export const checkAndResetRewards = (prevStreak, currentStreak) => {
  // If current streak is 1 and previous was higher, streak was broken
  if (currentStreak === 1 && prevStreak > 1) {
    return resetRewardsForNewStreak();
  }
  return false;
};

/**
 * Get the next milestone reward
 * @param {number} currentStreak - Current streak length
 * @returns {Object|null} Next milestone or null if all claimed
 */
export const getNextMilestone = (currentStreak) => {
  const rewards = getStreakRewards();
  
  // Find the next unclaimed milestone
  const nextMilestone = rewards
    .filter(reward => !reward.claimed && reward.days > currentStreak)
    .sort((a, b) => a.days - b.days)[0];
    
  return nextMilestone || null;
};

/**
 * Get rewards configuration (for settings)
 * @returns {Object} Rewards configuration settings
 */
export const getRewardsSettings = () => {
  try {
    const settings = localStorage.getItem('rewardsSettings');
    if (settings) {
      return JSON.parse(settings);
    }
  } catch (err) {
    console.error('Error loading rewards settings:', err);
  }
  
  // Default settings
  return {
    enabled: true,
    showNotifications: true,
    autoClaimRewards: false
  };
};

/**
 * Save rewards configuration
 * @param {Object} settings - Rewards configuration settings
 * @returns {boolean} Success status
 */
export const saveRewardsSettings = (settings) => {
  try {
    localStorage.setItem('rewardsSettings', JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('Error saving rewards settings:', err);
    return false;
  }
}; 