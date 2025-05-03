import { useState, useEffect, useCallback } from 'react';
import {
  getLeaderboardParticipation,
  saveLeaderboardParticipation,
  createDistanceLeaderboard,
  createStreakLeaderboard,
  createImprovementLeaderboard
} from '../utils/leaderboardUtils';
import bitcoinRewardsService from '../services/bitcoinRewardsService';

/**
 * Custom hook for managing leaderboards
 * @param {string} publicKey - Current user's public key
 * @param {Map} profiles - Map of user profiles
 * @param {Array} runHistory - Current user's run history
 * @param {Object} stats - Current user's stats
 * @returns {Object} Leaderboard state and functions
 */
export const useLeaderboard = (publicKey, profiles, runHistory, stats) => {
  const [participating, setParticipating] = useState(getLeaderboardParticipation());
  const [distanceLeaderboard, setDistanceLeaderboard] = useState([]);
  const [streakLeaderboard, setStreakLeaderboard] = useState([]);
  const [improvementLeaderboard, setImprovementLeaderboard] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState('week');
  const [distributionStatus, setDistributionStatus] = useState({
    distributing: false,
    success: false,
    error: null
  });
  
  // Toggle participation
  const toggleParticipation = useCallback(() => {
    const newValue = !participating;
    const success = saveLeaderboardParticipation(newValue);
    if (success) {
      setParticipating(newValue);
    }
    return success;
  }, [participating]);
  
  // Change current period
  const changePeriod = useCallback((period) => {
    if (['week', 'month', 'all-time'].includes(period)) {
      setCurrentPeriod(period);
      return true;
    }
    return false;
  }, []);
  
  // Generate user data for leaderboards
  const generateUserData = useCallback(() => {
    if (!publicKey || !participating) return null;
    
    const userProfile = profiles.get(publicKey) || {};
    const userName = userProfile.name || userProfile.display_name || 'You';
    const userPicture = userProfile.picture || '';
    
    return {
      pubkey: publicKey,
      name: userName,
      picture: userPicture,
      isCurrentUser: true,
      runHistory: runHistory,
      stats: stats,
      streak: stats?.currentStreak || 0
    };
  }, [publicKey, profiles, runHistory, stats, participating]);
  
  // Update leaderboards
  useEffect(() => {
    if (!participating) return;
    
    const userData = generateUserData();
    if (!userData) return;
    
    // Until we have real users from Nostr, create a demo leaderboard with current user
    const demoUsers = [
      userData,
      // Add some simulated users for testing
      {
        pubkey: 'user1',
        name: 'Runner 1',
        picture: '',
        streak: Math.floor(Math.random() * 14) + 1,
        stats: { weeklyImprovementRate: Math.floor(Math.random() * 30) - 5 },
        runHistory: [{ date: new Date().toISOString(), distance: Math.random() * 10000 }]
      },
      {
        pubkey: 'user2',
        name: 'Runner 2',
        picture: '',
        streak: Math.floor(Math.random() * 14) + 1,
        stats: { weeklyImprovementRate: Math.floor(Math.random() * 30) - 5 },
        runHistory: [{ date: new Date().toISOString(), distance: Math.random() * 10000 }]
      },
      {
        pubkey: 'user3',
        name: 'Runner 3',
        picture: '',
        streak: Math.floor(Math.random() * 14) + 1,
        stats: { weeklyImprovementRate: Math.floor(Math.random() * 30) - 5 },
        runHistory: [{ date: new Date().toISOString(), distance: Math.random() * 10000 }]
      }
    ];
    
    // Update leaderboards
    setDistanceLeaderboard(createDistanceLeaderboard(demoUsers, currentPeriod));
    setStreakLeaderboard(createStreakLeaderboard(demoUsers));
    setImprovementLeaderboard(createImprovementLeaderboard(demoUsers));
    
  }, [generateUserData, currentPeriod, participating]);
  
  /**
   * Distribute rewards for a specific leaderboard
   * @param {string} leaderboardType - Type of leaderboard ('distance', 'streak', 'improvement')
   * @returns {Promise<Object>} Distribution result
   */
  const distributeRewards = useCallback(async (leaderboardType) => {
    setDistributionStatus({
      distributing: true,
      success: false,
      error: null
    });
    
    try {
      // Select the appropriate leaderboard
      let leaderboard;
      switch (leaderboardType) {
        case 'distance':
          leaderboard = distanceLeaderboard;
          break;
        case 'streak':
          leaderboard = streakLeaderboard;
          break;
        case 'improvement':
          leaderboard = improvementLeaderboard;
          break;
        default:
          throw new Error('Invalid leaderboard type');
      }
      
      // Call the Bitcoin rewards service
      const result = await bitcoinRewardsService.distributeLeaderboardRewards(
        leaderboard,
        leaderboardType
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to distribute rewards');
      }
      
      setDistributionStatus({
        distributing: false,
        success: true,
        error: null,
        result
      });
      
      return result;
    } catch (error) {
      console.error('Error distributing rewards:', error);
      setDistributionStatus({
        distributing: false,
        success: false,
        error: error.message || 'Failed to distribute rewards'
      });
      return { success: false, error: error.message };
    }
  }, [distanceLeaderboard, streakLeaderboard, improvementLeaderboard]);
  
  return {
    participating,
    toggleParticipation,
    currentPeriod,
    changePeriod,
    distanceLeaderboard,
    streakLeaderboard,
    improvementLeaderboard,
    distributionStatus,
    distributeRewards
  };
}; 