/**
 * Transaction Service
 * Manages Bitcoin transaction history and persistence
 */

import nwcService from './nwcService.js';

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
    document.dispatchEvent(new CustomEvent('bitcoinTransactionAdded', { 
      detail: { transaction: newTransaction }
    }));
    
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
    
    // Dispatch event
    document.dispatchEvent(new CustomEvent('bitcoinTransactionUpdated', { 
      detail: { transaction: transactions[index] }
    }));
    
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
    // Ensure we are sending sats to a Lightning address / LNURL rather than a raw hex pubkey
    const resolveDestination = (key) => {
      if (!key) return key;
      if (key.includes('@') || key.startsWith('lnurl') || key.startsWith('lightning:') || key.startsWith('lnbc')) {
        return key.replace(/^lightning:/, '');
      }
      try {
        const cached = localStorage.getItem('runstr_lightning_addr');
        if (cached) return cached;
      } catch (_) {}
      return key;
    };
    const destination = resolveDestination(pubkey);
    try {
      // Record transaction in our system first
      const transaction = transactionService.recordTransaction({
        type: TRANSACTION_TYPES.STREAK_REWARD,
        amount,
        recipient: destination,
        reason,
        pubkey: destination,
        metadata
      });
      
      // Send sats using NWC (LNURL → invoice → NWC pay)
      const result = await nwcService.payLightningAddress(
        destination,
        amount,
        reason
      );
      
      // Update transaction with result
      if (result.success) {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.COMPLETED,
          rail: 'nwc',
          preimage: result.result?.preimage || null
        });
        
        return {
          success: true,
          transaction: {
            ...transaction,
            rail: 'nwc',
            status: TRANSACTION_STATUS.COMPLETED
          }
        };
      } else {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.FAILED,
          error: result.error
        });
        
        return {
          success: false,
          error: result.error,
          transaction
        };
      }
    } catch (error) {
      console.error('Error processing streak reward:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        transaction: null
      };
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
    const resolveDestination = (key) => {
      if (!key) return key;
      if (key.includes('@') || key.startsWith('lnurl') || key.startsWith('lightning:') || key.startsWith('lnbc')) {
        return key.replace(/^lightning:/, '');
      }
      try {
        const cached = localStorage.getItem('runstr_lightning_addr');
        if (cached) return cached;
      } catch (_) {}
      return key;
    };
    const destination = resolveDestination(pubkey);
    if (type === TRANSACTION_TYPES.STREAK_REWARD) {
      return transactionService.processStreakReward(destination, amount, reason, metadata);
    }

    // Unsupported reward type in current build
    return {
      success: false,
      error: 'Reward type not supported in this build'
    };
  }
};

export default transactionService; 