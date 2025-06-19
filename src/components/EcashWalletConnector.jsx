import { useState, useEffect, useContext } from 'react';
import { useEcashWallet } from '../contexts/EcashWalletContext';
import { NostrContext } from '../contexts/NostrContext';

// Supported Cashu mints
const SUPPORTED_MINTS = [
  {
    name: "CoinOS",
    url: "https://mint.coinos.io",
    description: "CoinOS community mint"
  },
  {
    name: "Minibits", 
    url: "https://mint.minibits.cash/Bitcoin",
    description: "Minibits mobile wallet mint"
  },
  {
    name: "0xchat",
    url: "https://mint.0xchat.com", 
    description: "0xchat messaging app mint"
  }
];

export const EcashWalletConnector = () => {
  const { user } = useContext(NostrContext);
  const {
    // State from context
    selectedMint,
    customMintUrl,
    wallet,
    balance,
    isConnecting,
    isConnected,
    connectionError,
    mintStatus,
    isLoadingExisting,
    transactions,
    
    // Actions from context
    setSelectedMint,
    setCustomMintUrl,
    connectToMint,
    disconnect,
    refreshBalance,
    sendTokens,
    getEffectiveMintUrl,
    
    // Constants
    SUPPORTED_MINTS
  } = useEcashWallet();

  // Local UI state for modals
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showTransactions, setShowTransactions] = useState(false);

  // Handle mint selection
  const handleMintSelection = (mintUrl) => {
    setSelectedMint(mintUrl);
    setCustomMintUrl('');
  };

  // Handle custom mint URL input
  const handleCustomMintChange = (e) => {
    const url = e.target.value;
    setCustomMintUrl(url);
    setSelectedMint('custom');
  };

  // Connect to selected mint
  const handleConnect = async () => {
    const mintUrl = getEffectiveMintUrl();
    await connectToMint(mintUrl);
  };

  // Handle send tokens
  const handleSendTokens = async () => {
    if (!sendAmount || !sendRecipient || !wallet) {
      setSendError('Please fill in all required fields');
      return;
    }

    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      setSendError('Insufficient balance');
      return;
    }

    setIsSending(true);
    setSendError('');

    try {
      await sendTokens(sendRecipient, amount, sendMemo);

      // Reset form and close modal
      setSendAmount('');
      setSendRecipient('');
      setSendMemo('');
      setShowSendModal(false);

      console.log('[EcashWallet] Send completed successfully');
      
    } catch (error) {
      setSendError(`Failed to send tokens: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle receive tokens - for manual token input
  const handleManualReceiveTokens = async (tokenString) => {
    if (!wallet || !tokenString) {
      console.error('[EcashWallet] Cannot receive tokens: wallet not connected or no token provided');
      return false;
    }

    try {
      console.log('[EcashWallet] Attempting to receive tokens:', tokenString);
      
      // Parse and validate the cashu token
      const tokenData = await wallet.receiveTokens(tokenString);
      
      if (tokenData && tokenData.amount > 0) {
        console.log(`[EcashWallet] Successfully received ${tokenData.amount} sats`);
        
        // Show notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Ecash Received', {
            body: `Received ${tokenData.amount} sats in your ecash wallet`,
            icon: '/icon.png'
          });
        }
        
        return true;
      } else {
        throw new Error('Invalid or empty token');
      }
      
    } catch (error) {
      console.error('[EcashWallet] Error receiving tokens:', error);
      return false;
    }
  };

  // Validate cashu token format
  const validateCashuToken = (tokenString) => {
    if (!tokenString || typeof tokenString !== 'string') {
      return false;
    }
    
    // Basic cashu token format validation
    // Cashu tokens typically start with "cashu" and contain base64-like characters
    const cashuTokenRegex = /^cashu[A-Za-z0-9+/=]+$/;
    return cashuTokenRegex.test(tokenString.trim());
  };

  // Enhanced receive info with QR code support
  const generateReceiveInfo = () => {
    if (!user) return null;
    
    const mintName = SUPPORTED_MINTS.find(m => m.url === getEffectiveMintUrl())?.name || 'Custom Mint';
    
    return {
      pubkey: user.pubkey,
      mint: getEffectiveMintUrl(),
      mintName: mintName,
      instructions: `Send ecash tokens to this pubkey using ${mintName}`,
      // Generate a receive URL for easier sharing
      receiveUrl: `nostr:${user.pubkey}?mint=${encodeURIComponent(getEffectiveMintUrl())}&name=${encodeURIComponent(mintName)}`
    };
  };

  return (
    <div className="ecash-wallet-connector">
      
      {/* Connection Status Card */}
      <div className="wallet-option ecash-connection-card">
        <h3>{isConnected ? '✅ Wallet Connected' : '🔌 Connect to Mint'}</h3>
        
        {!isConnected ? (
          <>
            <p>Choose a trusted Cashu mint to get started:</p>
            
            {/* Mint Selection Grid */}
            <div className="ecash-mint-grid">
              {SUPPORTED_MINTS.map((mint) => (
                <div 
                  key={mint.url}
                  className={`ecash-mint-option ${selectedMint === mint.url ? 'selected' : ''}`}
                  onClick={() => handleMintSelection(mint.url)}
                >
                  <strong>{mint.name}</strong>
                  <p className="mint-description">{mint.description}</p>
                </div>
              ))}
              
              {/* Custom Mint Option */}
              <div className={`ecash-mint-option ${selectedMint === 'custom' ? 'selected' : ''}`}>
                <strong>Custom Mint</strong>
                <input
                  type="text"
                  value={customMintUrl}
                  onChange={handleCustomMintChange}
                  placeholder="https://your-mint-url.com"
                  className="custom-mint-input"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="mint-description">Enter your own mint URL</p>
              </div>
            </div>

            {/* Connect Button */}
            <button 
              onClick={handleConnect} 
              disabled={isConnecting || isLoadingExisting || !getEffectiveMintUrl()}
              className="wallet-option-button"
            >
              {isConnecting ? 'Connecting...' : isLoadingExisting ? 'Loading...' : 'Connect to Mint'}
            </button>
            
            {/* Status Messages */}
            {mintStatus && <p className="mint-status">{mintStatus}</p>}
            {connectionError && <p className="error-message">{connectionError}</p>}
          </>
        ) : (
          <div className="connected-state">
            <p className="connected-mint">{mintStatus}</p>
            <button onClick={disconnect} className="disconnect-button">
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Balance Card - Only show when connected */}
      {isConnected && (
        <div className="wallet-option ecash-balance-card">
          <h3>💰 Wallet Balance</h3>
          <div className="balance-display-large">
            <span className="balance-amount-large">{balance.toLocaleString()}</span>
            <span className="balance-unit">sats</span>
          </div>
          <button onClick={refreshBalance} className="refresh-balance-button">
            🔄 Refresh Balance
          </button>
        </div>
      )}

      {/* Wallet Actions Card - Only show when connected */}
      {isConnected && (
        <div className="wallet-option ecash-actions-card">
          <h3>⚡ Wallet Actions</h3>
          <div className="wallet-actions-grid">
            <div className="action-item" onClick={() => setShowSendModal(true)}>
              <div className="action-icon">📤</div>
              <div className="action-info">
                <strong>Send Tokens</strong>
                <p>Send ecash to any pubkey</p>
              </div>
              <button className="action-button" disabled={balance <= 0}>
                Send
              </button>
            </div>

            <div className="action-item" onClick={() => setShowReceiveModal(true)}>
              <div className="action-icon">📥</div>
              <div className="action-info">
                <strong>Receive Tokens</strong>
                <p>Get your receive info</p>
              </div>
              <button className="action-button">
                Receive
              </button>
            </div>

            <div className="action-item" onClick={() => setShowTransactions(!showTransactions)}>
              <div className="action-icon">📋</div>
              <div className="action-info">
                <strong>Transaction History</strong>
                <p>{transactions.length} transactions</p>
              </div>
              <button className="action-button">
                {showTransactions ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Card - Only show when connected and toggled */}
      {isConnected && showTransactions && transactions.length > 0 && (
        <div className="wallet-option ecash-history-card">
          <h3>📋 Recent Transactions</h3>
          <div className="transaction-list">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className={`transaction-item ${tx.type} ${tx.status}`}>
                <div className="transaction-header">
                  <div className="transaction-type">
                    {tx.type === 'send' ? '📤' : '📥'} {tx.type === 'send' ? 'Sent' : 'Received'}
                  </div>
                  <div className="transaction-amount">
                    {tx.type === 'send' ? '-' : '+'}{tx.amount.toLocaleString()} sats
                  </div>
                </div>
                <div className="transaction-details">
                  <div className="transaction-date">
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                  <div className={`transaction-status status-${tx.status}`}>
                    {tx.status}
                  </div>
                </div>
                {tx.memo && (
                  <div className="transaction-memo">{tx.memo}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Info Card */}
      <div className="wallet-option ecash-features-card">
        <h3>🌟 Ecash Wallet Features</h3>
        <ul className="features-list">
          <li>🔒 Private token transactions</li>
          <li>🌐 Sync across all your devices</li>
          <li>⚡ Send/receive nutzaps in social feeds</li>
          <li>📱 Works offline, syncs when online</li>
          <li>🔄 Encrypted backup via Nostr events</li>
        </ul>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Send Ecash Tokens</h3>
            
            <div className="form-group">
              <label>Recipient (pubkey/npub):</label>
              <input
                type="text"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="npub... or hex pubkey"
                className="modal-input"
              />
            </div>

            <div className="form-group">
              <label>Amount (sats):</label>
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0"
                min="1"
                max={balance}
                className="modal-input"
              />
              <small>Available: {balance.toLocaleString()} sats</small>
            </div>

            <div className="form-group">
              <label>Memo (optional):</label>
              <input
                type="text"
                value={sendMemo}
                onChange={(e) => setSendMemo(e.target.value)}
                placeholder="Payment description"
                className="modal-input"
              />
            </div>

            {sendError && (
              <div className="error-message">{sendError}</div>
            )}

            <div className="modal-buttons">
              <button 
                onClick={() => setShowSendModal(false)}
                className="cancel-button"
                disabled={isSending}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTokens}
                className="send-confirm-button"
                disabled={isSending || !sendAmount || !sendRecipient}
              >
                {isSending ? 'Sending...' : `Send ${sendAmount || 0} sats`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Receive Ecash Tokens</h3>
            
            {user ? (
              <div className="receive-info">
                <p>Share this information to receive ecash tokens:</p>
                
                <div className="receive-field">
                  <label>Your Pubkey:</label>
                  <div className="receive-value">
                    <code>{user.pubkey}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(user.pubkey)}
                      className="copy-button"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                <div className="receive-field">
                  <label>Mint:</label>
                  <div className="receive-value">
                    <code>{getEffectiveMintUrl()}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(getEffectiveMintUrl())}
                      className="copy-button"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                <div className="receive-field">
                  <label>Share URL:</label>
                  <div className="receive-value">
                    <code>{generateReceiveInfo()?.receiveUrl}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(generateReceiveInfo()?.receiveUrl)}
                      className="copy-button"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                <div className="manual-receive-section">
                  <h4>Manual Token Input</h4>
                  <p>If someone sends you a cashu token directly, paste it here:</p>
                  <div className="token-input-group">
                    <input
                      type="text"
                      placeholder="Paste cashu token here..."
                      className="modal-input"
                      id="tokenInput"
                    />
                    <button 
                      onClick={async () => {
                        const tokenInput = document.getElementById('tokenInput');
                        const token = tokenInput.value.trim();
                        
                        if (!token) {
                          alert('Please paste a cashu token');
                          return;
                        }
                        
                        if (!validateCashuToken(token)) {
                          alert('Invalid cashu token format. Please check the token and try again.');
                          return;
                        }
                        
                        try {
                          const success = await handleManualReceiveTokens(token);
                          if (success) {
                            tokenInput.value = '';
                            setShowReceiveModal(false);
                            alert('Token received successfully!');
                          } else {
                            alert('Failed to receive token. Please check the token and try again.');
                          }
                        } catch (error) {
                          alert(`Error receiving token: ${error.message}`);
                        }
                      }}
                      className="receive-token-button"
                    >
                      Receive
                    </button>
                  </div>
                </div>

                <div className="receive-instructions">
                  <p>
                    <strong>Instructions:</strong> The sender needs to use the same mint 
                    ({SUPPORTED_MINTS.find(m => m.url === getEffectiveMintUrl())?.name || 'Custom Mint'}) 
                    and send tokens to your pubkey. Tokens will be automatically detected from Nostr DMs and nutzaps.
                  </p>
                </div>
              </div>
            ) : (
              <div className="error-message">
                Please connect your Nostr profile to receive tokens.
              </div>
            )}

            <div className="modal-buttons">
              <button 
                onClick={() => setShowReceiveModal(false)}
                className="close-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 