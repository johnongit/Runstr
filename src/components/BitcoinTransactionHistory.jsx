import React from 'react';

const BitcoinTransactionHistory = () => {
  // All original content is commented out to hide this feature for now.
  /*
  import { useState, useEffect } from 'react';
  import { useNostr } from '../hooks/useNostr';
  import transactionService from '../services/transactionService';
  import '../assets/styles/bitcoinTransactionHistory.css';

  const BitcoinTransactionHistory = () => { 
    const nostrContext = useNostr();
    const publicKey = nostrContext?.publicKey || null;
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [syncStatus, setSyncStatus] = useState('idle');

    const fetchTransactions = async () => {
      if (!publicKey) return;
      setIsLoading(true);
      setError(null);
      try {
        const userTransactions = transactionService.getTransactions({ pubkey: publicKey });
        setTransactions(userTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      } catch (err) {
        setError('Failed to load transactions.');
        console.error('Error fetching transactions:', err);
      }
      setIsLoading(false);
    };

    const handleSyncTransactions = async () => {
      if (!publicKey) {
        setError('Nostr public key not available for sync.');
        return;
      }
      setSyncStatus('syncing');
      setError(null);
      try {
        const result = await transactionService.syncAllUserTransactions(publicKey);
        if (result.success) {
          setSyncStatus('success');
          // Refetch transactions after sync
          await fetchTransactions();
        } else {
          setSyncStatus('failed');
          setError(result.error || 'Sync failed. Check console for details.');
        }
      } catch (err) {
        setSyncStatus('failed');
        setError('An error occurred during sync.');
        console.error('Error syncing transactions:', err);
      }
    };

    useEffect(() => {
      fetchTransactions();
    }, [publicKey]);

    // Helper to format date
    const formatDate = (isoString) => {
      if (!isoString) return 'N/A';
      try {
        return new Date(isoString).toLocaleString();
      } catch (e) {
        return 'Invalid Date';
      }
    };

    // Helper to get transaction type label
    const getTransactionTypeLabel = (type) => {
      switch (type) {
        case 'streak_reward':
          return 'Streak Reward';
        case 'leaderboard_reward':
          return 'Leaderboard Reward';
        case 'zap_sent':
          return 'Zap Sent';
        case 'zap_received':
          return 'Zap Received';
        case 'manual_payout':
          return 'Manual Payout';
        default:
          return 'Unknown';
      }
    };
    
    const getStatusIndicator = (status) => {
      switch(status) {
        case 'completed': return <span className="status-indicator completed">✓</span>;
        case 'pending': return <span className="status-indicator pending">⏳</span>;
        case 'failed': return <span className="status-indicator failed">✗</span>;
        default: return <span className="status-indicator unknown">?</span>;
      }
    };

    return (
      <div className="bitcoin-transaction-history">
        <div className="history-header">
          <h3>Bitcoin Transaction History</h3>
          <button onClick={handleSyncTransactions} disabled={syncStatus === 'syncing'}>
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Status'}
          </button>
        </div>

        {isLoading && <p>Loading transaction history...</p>}
        {error && <p className="error-message">{error}</p>}
        {!isLoading && !error && transactions.length === 0 && (
          <p>No transactions found.</p>
        )}

        {!isLoading && !error && transactions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount (sats)</th>
                <th>Reason/Recipient</th>
                <th>Status</th>
                <th>Bitvora TXID</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.timestamp)}</td>
                  <td>{getTransactionTypeLabel(tx.type)}</td>
                  <td className={`amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </td>
                  <td>{tx.reason || tx.recipient || 'N/A'}</td>
                  <td>
                    {getStatusIndicator(tx.status)} {tx.status}
                  </td>
                  <td title={tx.bitvora_txid}>{tx.bitvora_txid ? `${tx.bitvora_txid.substring(0, 8)}...` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {syncStatus === 'success' && <p className="sync-message success">Transactions synced successfully!</p>}
        {syncStatus === 'failed' && <p className="sync-message error">Transaction sync failed. Please try again.</p>}
      </div>
    );
  }; 
  */
  return null; // Return null to render nothing
};

export default BitcoinTransactionHistory; 