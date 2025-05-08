import { useState, useEffect } from 'react';
import { useNostr } from '../hooks/useNostr';
import transactionService, { TRANSACTION_TYPES, TRANSACTION_STATUS } from '../services/transactionService';
import bitvoraRewardsService from '../services/bitvoraRewardsService';

/**
 * Component for displaying Bitcoin transaction history
 */
const BitcoinTransactionHistory = () => {
  // Handle case where NostrContext might not be fully initialized yet
  const nostrContext = useNostr();
  const publicKey = nostrContext?.publicKey || null;
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ inProgress: false, message: '' });
  
  useEffect(() => {
    if (!publicKey) return;
    
    const loadTransactions = async () => {
      setLoading(true);
      try {
        const result = await bitvoraRewardsService.getUserTransactions(publicKey);
        if (result.success) {
          setTransactions(result.transactions || []);
          setError(null);
        } else {
          setError(result.error || 'Failed to load transactions');
        }
      } catch (err) {
        console.error('Error loading Bitcoin transactions:', err);
        setError('Error loading transactions');
      } finally {
        setLoading(false);
      }
    };
    
    loadTransactions();
    
    // Add event listener for transaction updates
    const handleTransactionAdded = (event) => {
      setTransactions(prevTx => [event.detail.transaction, ...prevTx]);
    };
    
    const handleTransactionUpdated = (event) => {
      setTransactions(prevTx => 
        prevTx.map(tx => 
          tx.id === event.detail.transaction.id ? event.detail.transaction : tx
        )
      );
    };
    
    document.addEventListener('bitcoinTransactionAdded', handleTransactionAdded);
    document.addEventListener('bitcoinTransactionUpdated', handleTransactionUpdated);
    
    return () => {
      document.removeEventListener('bitcoinTransactionAdded', handleTransactionAdded);
      document.removeEventListener('bitcoinTransactionUpdated', handleTransactionUpdated);
    };
  }, [publicKey]);
  
  const handleSyncTransactions = async () => {
    if (syncStatus.inProgress) return;
    
    setSyncStatus({ inProgress: true, message: 'Syncing transactions...' });
    try {
      const result = await bitvoraRewardsService.syncTransactions();
      if (result.success) {
        // Refresh transaction list
        const txResult = await bitvoraRewardsService.getUserTransactions(publicKey);
        if (txResult.success) {
          setTransactions(txResult.transactions || []);
        }
        
        setSyncStatus({ 
          inProgress: false,
          message: `Sync complete. Updated: ${result.results?.updated || 0}, Completed: ${result.results?.completed || 0}`
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSyncStatus({ inProgress: false, message: '' });
        }, 3000);
      } else {
        setSyncStatus({ inProgress: false, message: `Sync failed: ${result.error}` });
      }
    } catch (err) {
      console.error('Error syncing transactions:', err);
      setSyncStatus({ inProgress: false, message: `Error: ${err.message}` });
    }
  };
  
  // Helper function to format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Helper to get status badge class
  const getStatusClass = (status) => {
    switch (status) {
      case TRANSACTION_STATUS.COMPLETED:
        return 'status-completed';
      case TRANSACTION_STATUS.FAILED:
        return 'status-failed';
      case TRANSACTION_STATUS.PENDING:
        return 'status-pending';
      default:
        return '';
    }
  };
  
  // Helper to get transaction type label
  const getTypeLabel = (type) => {
    switch (type) {
      case TRANSACTION_TYPES.STREAK_REWARD:
        return 'Streak Reward';
      case TRANSACTION_TYPES.LEADERBOARD_REWARD:
        return 'Leaderboard Reward';
      case TRANSACTION_TYPES.MANUAL_WITHDRAWAL:
        return 'Withdrawal';
      case TRANSACTION_TYPES.DEPOSIT:
        return 'Deposit';
      default:
        return type;
    }
  };
  
  return (
    <div className="bitcoin-transaction-history">
      <div className="transaction-header">
        <h3>Bitcoin Transaction History</h3>
        <button 
          onClick={handleSyncTransactions}
          disabled={syncStatus.inProgress}
          className="sync-button"
        >
          {syncStatus.inProgress ? 'Syncing...' : 'Sync Status'}
        </button>
      </div>
      
      {syncStatus.message && (
        <div className={`sync-message ${syncStatus.inProgress ? 'syncing' : ''}`}>
          {syncStatus.message}
        </div>
      )}
      
      {loading ? (
        <div className="loading-transactions">Loading transaction history...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="no-transactions">
          <p>No Bitcoin transactions yet</p>
        </div>
      ) : (
        <div className="transactions-list">
          {transactions.map(tx => (
            <div key={tx.id} className="transaction-item">
              <div className="transaction-info">
                <div className="transaction-type">
                  {getTypeLabel(tx.type)}
                </div>
                <div className="transaction-amount">
                  {tx.amount} sats
                </div>
                <div className={`transaction-status ${getStatusClass(tx.status)}`}>
                  {tx.status}
                </div>
                <div className="transaction-date">
                  {formatDate(tx.timestamp)}
                </div>
              </div>
              <div className="transaction-details">
                <div className="transaction-reason">
                  {tx.reason || 'No description'}
                </div>
                {tx.bitvora_txid && (
                  <div className="transaction-id">
                    TX: {tx.bitvora_txid.slice(0, 8)}...
                  </div>
                )}
                {tx.error && (
                  <div className="transaction-error">
                    Error: {tx.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BitcoinTransactionHistory; 