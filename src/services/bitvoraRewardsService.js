/**
 * Bitvora Rewards Service
 * Handles Bitcoin rewards using Bitvora API integration
 */

import bitvoraService from './bitvoraService';
import transactionService, { TRANSACTION_TYPES } from './transactionService';

// Constants
const DEMO_MODE = false; // Set to false to use real Bitvora API with correct key format

// Simulated API call for testing (only used in demo mode)
const simulateApiCall = async (result) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  return result;
};

/**
 * Bitvora Rewards Service
 */
const bitvoraRewardsService = {
  /**
   * Initialize the service and check API connection
   * @returns {Promise<Object>} Connection status
   */
  init: async () => {
    try {
      if (DEMO_MODE) {
        return {
          valid: true,
          balance: 100000, // 100,000 sats
          message: 'Demo mode active'
        };
      }
      
      return await bitvoraService.checkConnection();
    } catch (error) {
      console.error('Bitcoin rewards service initialization error:', error);
      return {
        valid: false,
        message: error.message || 'Failed to connect to Bitcoin API'
      };
    }
  },
  
  /**
   * Get Bitcoin balance available for rewards
   * @returns {Promise<number>} Balance in satoshis
   */
  getBalance: async () => {
    if (DEMO_MODE) {
      return simulateApiCall(100000); // 100,000 sats
    }
    
    return await bitvoraService.getBalance();
  },
  
  /**
   * Request a Bitcoin reward for the user
   * @param {string} pubkey - User's public key
   * @param {number} amount - Amount in satoshis
   * @param {string} reason - Reason for the reward (e.g., "2-day streak")
   * @returns {Promise<Object>} Transaction result
   */
  claimReward: async (pubkey, amount, reason = '') => {
    if (!pubkey || !amount) {
      return { 
        success: false,
        error: 'Missing required parameters'
      };
    }
    
    try {
      if (DEMO_MODE) {
        return await simulateApiCall({
          success: true,
          txid: `sim_${Date.now().toString(16)}`,
          amount,
          pubkey,
          reason,
          timestamp: Date.now()
        });
      }
      
      // Determine reward type from reason
      const isStreakReward = reason.toLowerCase().includes('streak');
      const isLeaderboardReward = reason.toLowerCase().includes('leaderboard') || 
        reason.toLowerCase().includes('place');
      
      // Process the reward through the transaction service
      let result;
      if (isStreakReward) {
        result = await transactionService.processStreakReward(
          pubkey, 
          amount, 
          reason, 
          { source: 'streak_rewards', timestamp: new Date().toISOString() }
        );
      } else if (isLeaderboardReward) {
        result = await transactionService.processLeaderboardReward(
          pubkey,
          amount,
          reason,
          { source: 'leaderboard', timestamp: new Date().toISOString() }
        );
      } else {
        // Generic reward
        result = await transactionService.processStreakReward(
          pubkey,
          amount,
          reason,
          { source: 'reward', timestamp: new Date().toISOString() }
        );
      }
      
      return {
        success: result.success,
        ...(result.success 
          ? { 
              txid: result.transaction.bitvora_txid, 
              amount, 
              pubkey, 
              timestamp: new Date().toISOString() 
            }
          : { error: result.error }
        )
      };
    } catch (error) {
      console.error('Error claiming Bitcoin reward:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to claim reward'
      };
    }
  },
  
  /**
   * Check the status of a Bitcoin reward
   * @param {string} txid - Transaction ID
   * @returns {Promise<Object>} Transaction status
   */
  checkRewardStatus: async (txid) => {
    if (!txid) {
      return {
        success: false,
        error: 'Transaction ID required'
      };
    }
    
    try {
      if (DEMO_MODE) {
        // For demo mode, just return completed status
        return await simulateApiCall({
          success: true,
          txid,
          status: 'completed',
          settled: true
        });
      }
      
      return await bitvoraService.checkPaymentStatus(txid);
    } catch (error) {
      console.error('Error checking reward status:', error);
      return {
        success: false,
        error: error.message || 'Failed to check reward status'
      };
    }
  },
  
  /**
   * Record a claim in local storage
   * @param {Object} claimData - Claim data
   * @returns {boolean} Success status
   */
  recordClaim: (claimData) => {
    try {
      const claims = bitvoraRewardsService.getClaims();
      claims.unshift({
        ...claimData,
        timestamp: new Date().toISOString()
      });
      
      localStorage.setItem('bitcoinRewardClaims', JSON.stringify(claims));
      return true;
    } catch (error) {
      console.error('Error recording claim:', error);
      return false;
    }
  },
  
  /**
   * Get all recorded claims
   * @returns {Array} List of claims
   */
  getClaims: () => {
    try {
      const claims = localStorage.getItem('bitcoinRewardClaims');
      return claims ? JSON.parse(claims) : [];
    } catch (error) {
      console.error('Error getting claims:', error);
      return [];
    }
  },
  
  /**
   * Create a lightning address for a user
   * @param {string} pubkey - User's public key
   * @returns {Promise<Object>} Lightning address result
   */
  createLightningAddress: async (pubkey) => {
    if (!pubkey) {
      return {
        success: false,
        error: 'Public key required'
      };
    }
    
    try {
      if (DEMO_MODE) {
        const randomHandle = `user${Math.floor(Math.random() * 10000)}`;
        return await simulateApiCall({
          success: true,
          address: `${randomHandle}@bitvora.me`,
          handle: randomHandle,
          domain: 'bitvora.me'
        });
      }
      
      return await bitvoraService.createLightningAddress({
        pubkey,
        source: 'runstr_app'
      });
    } catch (error) {
      console.error('Error creating lightning address:', error);
      return {
        success: false,
        error: error.message || 'Failed to create lightning address'
      };
    }
  },
  
  /**
   * Get a user's transactions
   * @param {string} pubkey - User's public key
   * @returns {Promise<Object>} User's transactions
   */
  getUserTransactions: async (pubkey) => {
    if (!pubkey) {
      return {
        success: false,
        error: 'Public key required'
      };
    }
    
    try {
      return {
        success: true,
        transactions: transactionService.getUserTransactions(pubkey)
      };
    } catch (error) {
      console.error('Error getting user transactions:', error);
      return {
        success: false,
        error: error.message || 'Failed to get transactions'
      };
    }
  },
  
  /**
   * Sync all pending transactions with current status
   * @returns {Promise<Object>} Sync results
   */
  syncTransactions: async () => {
    try {
      if (DEMO_MODE) {
        return await simulateApiCall({
          success: true,
          message: 'Demo mode: No actual syncing performed'
        });
      }
      
      return await transactionService.syncAllPendingTransactions();
    } catch (error) {
      console.error('Error syncing transactions:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync transactions'
      };
    }
  }
};

export default bitvoraRewardsService; 