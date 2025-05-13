import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getStreakRewards, 
  getEligibleRewards, 
  claimReward, 
  checkAndResetRewards,
  getNextMilestone,
  getRewardsSettings
} from '../utils/streakRewards';
import bitvoraRewardsService from '../services/bitvoraRewardsService';

/**
 * Custom hook to manage streak rewards
 * @param {number} currentStreak - User's current streak
 * @param {string} lightningAddress - User's lightning address for Bitcoin rewards
 * @returns {Object} Streak rewards state and functions
 */
export const useStreakRewards = (currentStreak, lightningAddress) => {
  const [rewards, setRewards] = useState([]);
  const [eligibleRewards, setEligibleRewards] = useState([]);
  const [nextMilestone, setNextMilestone] = useState(null);
  const [claimStatus, setClaimStatus] = useState({
    claiming: false,
    success: false,
    error: null
  });
  const [settings, setSettings] = useState(getRewardsSettings());
  const prevEligibleRewardsRef = useRef([]);
  
  const isValidLightningAddress = (addr) => /.+@.+\..+/.test(addr);
  
  /**
   * Claim a streak reward
   * @param {number} days - The streak milestone (days)
   * @returns {Promise<Object>} Claim result
   */
  const handleClaimReward = useCallback(async (days) => {
    if (!lightningAddress || !isValidLightningAddress(lightningAddress)) {
      setClaimStatus({
        claiming: false,
        success: false,
        error: 'Valid lightning address required for reward payout'
      });
      return { success: false, error: 'Lightning address required' };
    }
    
    setClaimStatus({
      claiming: true,
      success: false,
      error: null
    });
    
    try {
      // Find the reward amount
      const reward = rewards.find(r => r.days === days);
      if (!reward) {
        throw new Error(`Reward for ${days} days streak not found`);
      }
      
      // Mark as claimed in local storage
      const claimed = claimReward(days, lightningAddress);
      if (!claimed) {
        throw new Error('Failed to record claim');
      }
      
      // Request the Bitcoin reward
      const result = await bitvoraRewardsService.claimReward(
        lightningAddress,
        reward.sats,
        `${days}-day streak reward`
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to claim Bitcoin reward');
      }
      
      // Record the successful claim
      bitvoraRewardsService.recordClaim({
        type: 'streak',
        days,
        sats: reward.sats,
        pubkey: lightningAddress,
        txid: result.txid,
        reason: `${days}-day streak reward`
      });
      
      // Update state
      setClaimStatus({
        claiming: false,
        success: true,
        error: null,
        result
      });
      
      // Refresh rewards list
      setRewards(getStreakRewards());
      setEligibleRewards(getEligibleRewards(currentStreak));
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Error claiming reward:', error);
      setClaimStatus({
        claiming: false,
        success: false,
        error: error.message || 'Failed to claim reward'
      });
      return { success: false, error: error.message };
    }
  }, [lightningAddress, rewards, currentStreak]);
  
  // Load rewards data on mount
  useEffect(() => {
    const rewardsData = getStreakRewards();
    setRewards(rewardsData);
  }, []);
  
  // Update eligible rewards and next milestone when streak changes
  useEffect(() => {
    // Load current streak from stats if not provided
    let streak = currentStreak;
    
    if (streak === undefined) {
      try {
        const storedStats = localStorage.getItem('runStats');
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          streak = stats.currentStreak || 0;
        }
      } catch (err) {
        console.error('Error loading streak from stats:', err);
        streak = 0;
      }
    }
    
    // Check if we need to reset rewards (if streak was broken)
    const storedStreak = Number(localStorage.getItem('lastStreakCheck') || '0');
    if (storedStreak !== streak) {
      checkAndResetRewards(storedStreak, streak);
      localStorage.setItem('lastStreakCheck', streak.toString());
    }
    
    // Get eligible unclaimed rewards
    const eligible = getEligibleRewards(streak);
    setEligibleRewards(eligible);
    
    // Get next milestone
    const next = getNextMilestone(streak);
    setNextMilestone(next);
  }, [currentStreak, rewards]);
  
  // Auto-claim newly eligible rewards
  useEffect(() => {
    // Auto-claim for every newly eligible reward
    const newlyEligible = eligibleRewards.filter(
      reward => !prevEligibleRewardsRef.current.some(prev => prev.days === reward.days)
    );

    if (newlyEligible.length > 0 && lightningAddress && isValidLightningAddress(lightningAddress)) {
      newlyEligible.forEach(async reward => {
        try {
          await handleClaimReward(reward.days);
        } catch (e) {
          console.error('Auto-claim failed:', e);
        }
      });
    }
  }, [eligibleRewards, handleClaimReward, lightningAddress]);
  
  /**
   * Update reward settings
   * @param {Object} newSettings - New settings object
   * @returns {boolean} Success status
   */
  const updateSettings = useCallback((newSettings) => {
    // Merge with existing settings
    const updatedSettings = {
      ...settings,
      ...newSettings
    };
    
    // Save to localStorage
    const success = true;
    try {
      localStorage.setItem('rewardsSettings', JSON.stringify(updatedSettings));
    } catch (err) {
      console.error('Error saving reward settings:', err);
      return false;
    }
    
    // Update state
    setSettings(updatedSettings);
    return success;
  }, [settings]);
  
  return {
    rewards,
    eligibleRewards,
    nextMilestone,
    claimStatus,
    settings,
    claimReward: handleClaimReward,
    updateSettings
  };
}; 