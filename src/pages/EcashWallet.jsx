import { useState } from 'react';
import { useNip60 } from '../contexts/WalletContext';

export const EcashWallet = () => {
  const {
    loading,
    error,
    hasWallet,
    balance,
    currentMint,
    tokenEvents,
    initializeWallet,
    refreshWallet,
    SUPPORTED_MINTS,
    DEFAULT_MINT_URL
  } = useNip60();

  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitializeWallet = async () => {
    setIsInitializing(true);
    try {
      console.log('[EcashWallet] User requested wallet initialization with CoinOS...');
      const success = await initializeWallet(DEFAULT_MINT_URL);
      if (!success) {
        // Error is already set by the context
        console.log('[EcashWallet] Wallet initialization failed, error shown to user');
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      // Error is handled by the context
    } finally {
      setIsInitializing(false);
    }
  };

  if (loading && !hasWallet) {
    return (
      <div className="ecash-wallet-page">
        <div className="loading-state">
          <h2>🔍 Checking for Wallet...</h2>
          <p>Looking for your existing wallet (no signing required)...</p>
          <div className="loading-spinner">⏳</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ecash-wallet-page">
        <div className="error-state">
          <h2>❌ Wallet Error</h2>
          <p>{error}</p>
          <button onClick={refreshWallet} className="retry-button">
            Retry Discovery
          </button>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="ecash-wallet-page">
        <div className="wallet-creation">
          <h2>🚀 Initialize Your Wallet</h2>
          <p>No existing wallet found. Initialize your wallet to start receiving and sending sats.</p>
          
          <div className="wallet-setup-info">
            <div className="setup-step">
              <h3>What happens when you initialize:</h3>
              <ul>
                <li>📱 Your wallet will be created securely using your Nostr identity</li>
                <li>🔒 Default mint: CoinOS (trusted and reliable)</li>
                <li>⚡ Zero starting balance - ready to receive sats</li>
                <li>⚙️ Advanced mint settings available in Settings</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="error-message" style={{ 
              background: 'rgba(255, 99, 99, 0.2)', 
              color: '#ff6363', 
              padding: '12px', 
              borderRadius: '8px', 
              margin: '16px 0',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button 
            onClick={handleInitializeWallet}
            disabled={isInitializing}
            className="create-wallet-btn"
          >
            {isInitializing ? '🔐 Requesting Amber Signature...' : '🚀 Initialize Wallet'}
          </button>
          
          {isInitializing && (
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.9rem', 
              marginTop: '12px',
              textAlign: 'center'
            }}>
              📱 Check Amber for signing prompts. You'll need to approve 2 signatures to initialize your wallet.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ecash-wallet-page">
      <div className="wallet-header">
        <h2>💰 Your Wallet</h2>
        <div className="wallet-info">
          <div className="balance-display">
            <span className="balance-label">Balance:</span>
            <span className="balance-amount">{balance} sats</span>
          </div>
          <div className="mint-info">
            <span className="mint-label">Provider:</span>
            <span className="mint-name">{currentMint?.name || 'Unknown'}</span>
          </div>
        </div>
        <div className="wallet-description">
          <p>Secure wallet powered by Nostr. Balance calculated from {tokenEvents.length} transactions.</p>
        </div>
      </div>

      <div className="wallet-actions">
        <button onClick={refreshWallet} disabled={loading} className="refresh-button">
          {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="transaction-history">
        <h3>📝 Transaction History</h3>
        {tokenEvents.length === 0 ? (
          <div className="no-events">
            <p>🎉 Wallet initialized successfully!</p>
            <p>No transactions yet. Your wallet is ready to receive sats.</p>
          </div>
        ) : (
          <div className="event-list">
            <p className="events-summary">Found {tokenEvents.length} transactions</p>
            {tokenEvents.slice(0, 10).map(event => (
              <div key={event.id} className="event-item">
                <span className={`event-type ${event.content?.type || 'unknown'}`}>
                  {event.content?.type === 'send' ? '📤 Send' : 
                   event.content?.type === 'receive' ? '📥 Receive' : '❓ Unknown'}
                </span>
                <span className="event-amount">
                  {event.content?.type === 'send' ? '-' : '+'}{event.content?.amount || 0} sats
                </span>
                <span className="event-date">
                  {new Date(event.created_at * 1000).toLocaleDateString()}
                </span>
              </div>
            ))}
            {tokenEvents.length > 10 && (
              <p className="more-events">... and {tokenEvents.length - 10} more transactions</p>
            )}
          </div>
        )}
      </div>

      <div className="debug-info">
        <details>
          <summary>🔧 Technical Details</summary>
          <pre>{JSON.stringify({ 
            hasWallet, 
            balance, 
            transactionCount: tokenEvents.length,
            provider: currentMint?.name,
            walletStatus: hasWallet ? 'initialized' : 'not initialized',
            providerStatus: currentMint ? 'connected' : 'none'
          }, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}; 