/**
 * Transaction Service
 * Manages Bitcoin transaction history and persistence
 */

import nwcService from './nwcService.js';
import { fetchLnAddressFromProfile } from '../utils/lnAddressResolver';

// Transaction types
export const TRANSACTION_TYPES = {
  STREAK_REWARD: 'streak_reward',
  LEADERBOARD_REWARD: 'leaderboard_reward',
  MANUAL_WITHDRAWAL: 'manual_withdrawal',
  DEPOSIT: 'deposit'
};

// Transaction statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Get all saved transactions from local storage
 * @returns {Array} List of transactions
 */
const getStoredTransactions = () => {
  try {
    const storedData = localStorage.getItem('bitcoinTransactions');
    if (!storedData) return [];
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error loading transaction history:', error);
    return [];
  }
};

/**
 * Save transactions to local storage
 * @param {Array} transactions - List of transactions to save
 */
const saveTransactions = (transactions) => {
  try {
    localStorage.setItem('bitcoinTransactions', JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error('Error saving transaction history:', error);
    return false;
  }
};

// Make resolveDestination an async, module-scoped helper
const resolveDestination = async (key) => {
  if (!key) return key;

  // Check if key is already a Lightning Address or LNURL
  if (key.includes('@') || key.startsWith('lnurl') || key.startsWith('lightning:') || key.startsWith('lnbc')) {
    return key.replace(/^lightning:/, '');
  }

  // Check local cache (e.g., for user's own explicitly set or previously resolved LN Address)
  try {
    // IMPORTANT: This specific cache key 'runstr_lightning_addr' should ideally be for the *current user's*
    // explicitly set or resolved payout address. If resolving for *other* pubkeys,
    // a more generic caching mechanism (e.g., pubkey -> lnAddress map) might be needed.
    // For now, we'll assume it's okay to check/update this for any key being resolved for payouts.
    const cached = localStorage.getItem('runstr_lightning_addr');
    if (cached) {
      // console.log('[TransactionService] Using cached runstr_lightning_addr:', cached);
      return cached;
    }
  } catch (_) {
    // Ignore localStorage errors
  }

  // If it looks like a pubkey (hex or npub) and not an LN address, try to fetch from Nostr profile
  // (fetchLnAddressFromProfile handles npub decoding and hex validation)
  // console.log(`[TransactionService] Attempting to fetch LN address for potential pubkey: ${key}`);
  const lnAddressFromProfile = await fetchLnAddressFromProfile(key);

  if (lnAddressFromProfile) {
    // console.log(`[TransactionService] Found LN address for ${key} from profile: ${lnAddressFromProfile}.`);
    // Caching it to 'runstr_lightning_addr' assumes this resolution is primarily for the app user's rewards.
    // If this service pays out to arbitrary pubkeys, this caching key might need to be more specific
    // or use a different caching strategy (e.g., a map of pubkey -> resolved LN address).
    try {
      localStorage.setItem('runstr_lightning_addr', lnAddressFromProfile);
      // console.log('[TransactionService] Cached resolved LN address to runstr_lightning_addr.');
    } catch (cacheErr) {
      console.error('[TransactionService] Error caching fetched LN address:', cacheErr);
    }
    return lnAddressFromProfile;
  }

  // console.warn(`[TransactionService] Could not resolve LN address for ${key} from profile. Returning original key.`);
  return key; // Return original key if still not resolved (will likely fail NWC payment)
};

/**
 * Transaction Service
 */
const transactionService = {
  /**
   * Record a new transaction
   * @param {Object} transaction - Transaction details
   * @returns {Object} Transaction with assigned ID
   */
  recordTransaction: (transaction) => {
    // Validate required fields
    if (!transaction.type || !transaction.amount || !transaction.recipient) {
      throw new Error('Missing required transaction fields');
    }

    // Prepare transaction object
    const newTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: transaction.status || TRANSACTION_STATUS.PENDING,
      ...transaction
    };

    // Add to storage
    const transactions = getStoredTransactions();
    transactions.unshift(newTransaction);
    saveTransactions(transactions);
    
    // Dispatch event to notify updates
    // Ensure this runs only in browser environment
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('bitcoinTransactionAdded', { 
            detail: { transaction: newTransaction }
        }));
    }
    
    return newTransaction;
  },
  
  /**
   * Update an existing transaction
   * @param {string} transactionId - Transaction ID to update
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated transaction or null if not found
   */
  updateTransaction: (transactionId, updates) => {
    const transactions = getStoredTransactions();
    const index = transactions.findIndex(tx => tx.id === transactionId);
    
    if (index === -1) return null;
    
    // Update transaction
    transactions[index] = {
      ...transactions[index],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    saveTransactions(transactions);
    
    // Dispatch event - Ensure this runs only in browser environment
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('bitcoinTransactionUpdated', { 
          detail: { transaction: transactions[index] }
        }));
    }
    
    return transactions[index];
  },
  
  /**
   * Get all transactions
   * @param {Object} filters - Optional filters (type, status, etc.)
   * @returns {Array} Filtered transactions
   */
  getTransactions: (filters = {}) => {
    const transactions = getStoredTransactions();
    
    if (Object.keys(filters).length === 0) {
      return transactions;
    }
    
    return transactions.filter(tx => {
      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(tx[key]);
        }
        return tx[key] === value;
      });
    });
  },
  
  /**
   * Get transactions for a specific user
   * @param {string} pubkey - User's public key
   * @returns {Array} User's transactions
   */
  getUserTransactions: (pubkey) => {
    if (!pubkey) return [];
    
    const transactions = getStoredTransactions();
    return transactions.filter(tx => 
      tx.pubkey === pubkey || tx.recipient === pubkey
    );
  },
  
  /**
   * Process a streak reward transaction
   * @param {string} pubkey - User's public key
   * @param {number} amount - Reward amount in satoshis
   * @param {string} reason - Reward reason (e.g. "7-day streak")
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Transaction result
   */
  processStreakReward: async (pubkey, amount, reason, metadata = {}) => {
    const destination = await resolveDestination(pubkey); // Now async

    try {
      const transaction = transactionService.recordTransaction({
        type: TRANSACTION_TYPES.STREAK_REWARD,
        amount,
        recipient: destination,
        reason,
        pubkey: destination, // Using resolved destination here too
        metadata
      });
      
      const result = await nwcService.payLightningAddress(
        destination,
        amount,
        reason
      );
      
      if (result.success) {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.COMPLETED,
          rail: 'nwc',
          preimage: result.result?.preimage || null
        });
        return { success: true, transaction: { ...transaction, rail: 'nwc', status: TRANSACTION_STATUS.COMPLETED } };
      } else {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.FAILED,
          error: result.error
        });
        return { success: false, error: result.error, transaction };
      }
    } catch (error) {
      console.error('Error processing streak reward:', error);
      return { success: false, error: error.message || 'Unknown error', transaction: null };
    }
  },
  
  /**
   * Sync with Bitvora for latest transaction status
   * @param {string} transactionId - Local transaction ID
   * @returns {Promise<Object>} Updated transaction status
   */
  syncTransactionStatus: async () => ({
    success: false,
    error: 'Sync not supported – Bitvora rail removed'
  }),
  
  /**
   * Sync all pending transactions with Bitvora
   * @returns {Promise<Object>} Sync results
   */
  syncAllPendingTransactions: async () => ({
    success: false,
    error: 'Sync not supported – Bitvora rail removed'
  }),
  
  /**
   * Generic reward processor (used by TypeScript services)
   * @param {string} pubkey - User's destination lightning address
   * @param {number} amount - Amount in sats
   * @param {string} type - One of TRANSACTION_TYPES values
   * @param {string} reason - Human-readable reason (e.g. "2-day streak reward")
   * @param {Object} metadata - Extra fields recorded with the tx
   */
  processReward: async (pubkey, amount, type, reason, metadata = {}) => {
    // Resolve destination ONCE here, before specific reward processing
    const destination = await resolveDestination(pubkey);

    if (type === TRANSACTION_TYPES.STREAK_REWARD) {
      // Pass the already resolved (or attempted to resolve) destination
      return transactionService.processStreakReward(destination, amount, reason, metadata);
    }
    
    // Handle other reward types if they become supported
    // if (type === TRANSACTION_TYPES.LEADERBOARD_REWARD) { ... }

    console.warn(`[TransactionService] Reward type '${type}' not supported for processing.`);
    return {
      success: false,
      error: `Reward type '${type}' not supported in this build`
    };
  }
};

export default transactionService; 