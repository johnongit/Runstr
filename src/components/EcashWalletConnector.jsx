import { useState, useEffect, useContext } from 'react';
import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { NDKEvent } from '@nostr-dev-kit/ndk';
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
  const { ndk, user } = useContext(NostrContext);
  
  // State management
  const [selectedMint, setSelectedMint] = useState('');
  const [customMintUrl, setCustomMintUrl] = useState('');
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [mintStatus, setMintStatus] = useState('');

  // Send/Receive Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Transaction History State
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);

  // Initialize wallet on mount and check for existing wallet
  useEffect(() => {
    if (ndk && user) {
      checkExistingWallet();
      loadTransactionHistory();
    }
  }, [ndk, user]);

  // Load transaction history from localStorage
  const loadTransactionHistory = () => {
    try {
      const storedTxs = localStorage.getItem('ecash_transactions');
      if (storedTxs) {
        setTransactions(JSON.parse(storedTxs));
      }
    } catch (error) {
      console.error('[EcashWallet] Error loading transaction history:', error);
    }
  };

  // Save transaction to history
  const saveTransaction = (transaction) => {
    try {
      const newTransaction = {
        id: `ecash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        mint: getEffectiveMintUrl(),
        ...transaction
      };

      const updatedTxs = [newTransaction, ...transactions].slice(0, 50); // Keep last 50 transactions
      setTransactions(updatedTxs);
      localStorage.setItem('ecash_transactions', JSON.stringify(updatedTxs));
      
      return newTransaction;
    } catch (error) {
      console.error('[EcashWallet] Error saving transaction:', error);
    }
  };

  // Check for existing NIP-60 wallet events
  const checkExistingWallet = async () => {
    try {
      console.log('[EcashWallet] Checking for existing wallet...');
      // TODO: Scan for existing kind:17375 events to detect existing mints
      // For now, we'll just initialize a fresh wallet
    } catch (error) {
      console.error('[EcashWallet] Error checking existing wallet:', error);
    }
  };

  // Handle mint selection
  const handleMintSelection = (mintUrl) => {
    setSelectedMint(mintUrl);
    setCustomMintUrl('');
    setConnectionError('');
  };

  // Handle custom mint URL input
  const handleCustomMintChange = (e) => {
    const url = e.target.value;
    setCustomMintUrl(url);
    setSelectedMint('custom');
    setConnectionError('');
  };

  // Get the effective mint URL (selected predefined mint or custom)
  const getEffectiveMintUrl = () => {
    if (selectedMint === 'custom') {
      return customMintUrl;
    }
    return selectedMint;
  };

  // Connect to selected mint
  const handleConnect = async () => {
    const mintUrl = getEffectiveMintUrl();
    
    if (!mintUrl || !mintUrl.startsWith('https://')) {
      setConnectionError('Please enter a valid mint URL starting with https://');
      return;
    }

    if (!ndk || !user) {
      setConnectionError('Nostr connection required. Please check your profile.');
      return;
    }

    setIsConnecting(true);
    setConnectionError('');
    setMintStatus('Connecting to mint...');

    try {
      console.log(`[EcashWallet] Connecting to mint: ${mintUrl}`);
      
      // Initialize NDK Cashu Wallet
      const cashuWallet = new NDKCashuWallet(ndk);
      
      // Add the selected mint
      await cashuWallet.addMint(mintUrl);
      
      // Test the connection by getting mint info
      setMintStatus('Testing mint connection...');
      
      // Get balance (this will also verify the mint works)
      const currentBalance = await cashuWallet.getBalance();
      
      // Set up wallet state
      setWallet(cashuWallet);
      setBalance(currentBalance);
      setIsConnected(true);
      setMintStatus(`Connected to ${SUPPORTED_MINTS.find(m => m.url === mintUrl)?.name || 'Custom Mint'}`);

      // Listen for balance changes
      cashuWallet.on('balance_changed', (newBalance) => {
        console.log('[EcashWallet] Balance changed:', newBalance);
        setBalance(newBalance);
      });

      console.log('[EcashWallet] Successfully connected to mint');
      
    } catch (error) {
      console.error('[EcashWallet] Connection error:', error);
      setConnectionError(`Failed to connect to mint: ${error.message}`);
      setMintStatus('');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from mint
  const handleDisconnect = () => {
    setWallet(null);
    setBalance(0);
    setIsConnected(false);
    setSelectedMint('');
    setCustomMintUrl('');
    setMintStatus('');
    setConnectionError('');
    console.log('[EcashWallet] Disconnected from mint');
  };

  // Refresh balance
  const refreshBalance = async () => {
    if (wallet) {
      try {
        const currentBalance = await wallet.getBalance();
        setBalance(currentBalance);
        console.log('[EcashWallet] Balance refreshed:', currentBalance);
      } catch (error) {
        console.error('[EcashWallet] Error refreshing balance:', error);
        setConnectionError('Failed to refresh balance');
      }
    }
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
      console.log(`[EcashWallet] Sending ${amount} sats to ${sendRecipient}`);
      
      // Record transaction as pending
      const transaction = saveTransaction({
        type: 'send',
        amount,
        recipient: sendRecipient,
        memo: sendMemo,
        status: 'pending'
      });

      // Validate recipient format (npub or hex pubkey)
      let recipientPubkey = sendRecipient;
      if (sendRecipient.startsWith('npub')) {
        try {
          const decoded = ndk.nip19.decode(sendRecipient);
          if (decoded.type === 'npub') {
            recipientPubkey = decoded.data;
          }
        } catch (e) {
          throw new Error('Invalid npub format');
        }
      } else if (!/^[0-9a-fA-F]{64}$/.test(sendRecipient)) {
        throw new Error('Invalid pubkey format. Use npub or 64-character hex.');
      }

      // Create a token from existing balance (spend tokens, don't mint new ones)
      console.log('[EcashWallet] Creating transferable token from balance...');
      const token = await wallet.mintTokens(amount);
      
      if (!token) {
        throw new Error('Failed to create token from balance');
      }
      
      console.log('[EcashWallet] Token created successfully:', token);

      // Send the token via encrypted DM
      console.log('[EcashWallet] Sending token via encrypted DM...');
      await sendTokenViaDM(recipientPubkey, token, sendMemo);

      // Update transaction as completed
      const updatedTxs = transactions.map(tx => 
        tx.id === transaction.id 
          ? { 
              ...tx, 
              status: 'completed',
              token: token
            }
          : tx
      );
      setTransactions(updatedTxs);
      localStorage.setItem('ecash_transactions', JSON.stringify(updatedTxs));

      // Update balance
      const newBalance = balance - amount;
      setBalance(newBalance);

      // Reset form and close modal
      setSendAmount('');
      setSendRecipient('');
      setSendMemo('');
      setShowSendModal(false);

      console.log('[EcashWallet] Send completed successfully');
      
    } catch (error) {
      console.error('[EcashWallet] Send error:', error);
      setSendError(`Failed to send tokens: ${error.message}`);
      
      // Update transaction as failed
      const updatedTxs = transactions.map(tx => 
        tx.id === transaction.id 
          ? { ...tx, status: 'failed', error: error.message }
          : tx
      );
      setTransactions(updatedTxs);
      localStorage.setItem('ecash_transactions', JSON.stringify(updatedTxs));
    } finally {
      setIsSending(false);
    }
  };

  // Send token via encrypted DM
  const sendTokenViaDM = async (recipientPubkey, token, memo) => {
    try {
      if (!ndk || !ndk.signer) {
        throw new Error('NDK or signer not available');
      }

      // Create DM content with token and memo
      const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token: ${token}`;
      
      // Create encrypted DM event (kind 4) - CORRECTED SYNTAX
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 4;
      ndkEvent.content = dmContent;
      ndkEvent.tags = [['p', recipientPubkey]];
      ndkEvent.created_at = Math.floor(Date.now() / 1000);

      // Encrypt the content for the recipient
      await ndkEvent.encrypt(recipientPubkey);
      
      // Publish the encrypted DM
      await ndkEvent.publish();
      
      console.log('[EcashWallet] Token sent via DM successfully');
      
    } catch (error) {
      console.error('[EcashWallet] Failed to send DM:', error);
      throw new Error('Failed to send token via DM: ' + error.message);
    }
  };

  // Handle receiving tokens (enhanced with token detection)
  const handleReceiveTokens = async (tokenString) => {
    if (!wallet || !tokenString) {
      console.error('[EcashWallet] Cannot receive tokens: wallet not connected or no token provided');
      return false;
    }

    try {
      console.log('[EcashWallet] Attempting to receive tokens:', tokenString);
      
      // Parse and validate the cashu token
      const tokenData = await wallet.receiveTokens(tokenString);
      
      if (tokenData && tokenData.amount > 0) {
        // Record successful receive transaction
        const transaction = saveTransaction({
          type: 'receive',
          amount: tokenData.amount,
          status: 'completed',
          token: tokenString,
          memo: 'Received ecash tokens'
        });

        // Update balance
        const newBalance = balance + tokenData.amount;
        setBalance(newBalance);

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
      
      // Record failed receive transaction
      saveTransaction({
        type: 'receive',
        amount: 0,
        status: 'failed',
        error: error.message,
        memo: 'Failed to receive tokens'
      });
      
      return false;
    }
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

  // Listen for incoming tokens via Nostr events
  useEffect(() => {
    if (!ndk || !user || !wallet) return;

    const handleNostrEvent = async (event) => {
      try {
        // Check for DMs with cashu tokens
        if (event.kind === 4 && event.pubkey !== user.pubkey) {
          const content = event.content;
          
          // Look for cashu token patterns in the message
          const tokenMatch = content.match(/cashu[A-Za-z0-9+/=]+/);
          if (tokenMatch) {
            console.log('[EcashWallet] Found potential cashu token in DM');
            const success = await handleReceiveTokens(tokenMatch[0]);
            if (success) {
              console.log('[EcashWallet] Successfully processed token from DM');
            }
          }
        }
        
        // Check for nutzap events (kind 9321)
        if (event.kind === 9321 && event.tags.find(tag => tag[0] === 'p' && tag[1] === user.pubkey)) {
          console.log('[EcashWallet] Received nutzap event');
          const tokenTag = event.tags.find(tag => tag[0] === 'cashu');
          if (tokenTag && tokenTag[1]) {
            const success = await handleReceiveTokens(tokenTag[1]);
            if (success) {
              console.log('[EcashWallet] Successfully processed nutzap');
            }
          }
        }
      } catch (error) {
        console.error('[EcashWallet] Error processing Nostr event:', error);
      }
    };

    // Subscribe to DMs and nutzaps
    const dmFilter = {
      kinds: [4],
      '#p': [user.pubkey],
      since: Math.floor(Date.now() / 1000) - 3600 // Last hour
    };
    
    const nutzapFilter = {
      kinds: [9321],
      '#p': [user.pubkey],
      since: Math.floor(Date.now() / 1000) - 3600 // Last hour
    };

    const dmSub = ndk.subscribe([dmFilter], { closeOnEose: false });
    const nutzapSub = ndk.subscribe([nutzapFilter], { closeOnEose: false });
    
    dmSub.on('event', handleNostrEvent);
    nutzapSub.on('event', handleNostrEvent);

    return () => {
      dmSub.stop();
      nutzapSub.stop();
    };
  }, [ndk, user, wallet, handleReceiveTokens]);

  // Request notification permissions on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('[EcashWallet] Notification permission:', permission);
      });
    }
  }, []);

  return (
    <div className="ecash-wallet-connector">
      
      {/* Connection Section */}
      <div className="connection-section">
        <h3>Select Cashu Mint</h3>
        
        {!isConnected ? (
          <>
            {/* Predefined Mints */}
            <div className="mint-selection">
              <p className="helper-text">Choose a trusted Cashu mint:</p>
              
              {SUPPORTED_MINTS.map((mint) => (
                <div 
                  key={mint.url}
                  className={`mint-option ${selectedMint === mint.url ? 'selected' : ''}`}
                  onClick={() => handleMintSelection(mint.url)}
                >
                  <div className="mint-info">
                    <strong>{mint.name}</strong>
                    <p className="mint-description">{mint.description}</p>
                    <p className="mint-url">{mint.url}</p>
                  </div>
                </div>
              ))}
              
              {/* Custom Mint Input */}
              <div className={`mint-option ${selectedMint === 'custom' ? 'selected' : ''}`}>
                <div className="mint-info">
                  <strong>Custom Mint</strong>
                  <input
                    type="text"
                    value={customMintUrl}
                    onChange={handleCustomMintChange}
                    placeholder="https://your-mint-url.com"
                    className="custom-mint-input"
                  />
                  <p className="mint-description">Enter your own mint URL</p>
                </div>
              </div>
            </div>

            {/* Connect Button */}
            <button 
              onClick={handleConnect} 
              disabled={isConnecting || !getEffectiveMintUrl()}
              className="connect-button"
            >
              {isConnecting ? 'Connecting...' : 'Connect to Mint'}
            </button>
            
            {/* Connection Status */}
            {mintStatus && (
              <p className="mint-status">{mintStatus}</p>
            )}
            
            {connectionError && (
              <p className="error-message">{connectionError}</p>
            )}
          </>
        ) : (
          /* Connected State */
          <div className="connected-state">
            <div className="wallet-info">
              <h4>✅ Wallet Connected</h4>
              <p className="connected-mint">{mintStatus}</p>
              
              {/* Balance Display */}
              <div className="balance-section">
                <div className="balance-display">
                  <span className="balance-label">Balance:</span>
                  <span className="balance-amount">{balance.toLocaleString()} sats</span>
                </div>
                <button onClick={refreshBalance} className="refresh-button">
                  🔄 Refresh
                </button>
              </div>
            </div>
            
            {/* Wallet Actions */}
            <div className="wallet-actions">
              <button 
                className="action-button send-button" 
                onClick={() => setShowSendModal(true)}
                disabled={balance <= 0}
              >
                📤 Send Tokens
              </button>
              <button 
                className="action-button receive-button" 
                onClick={() => setShowReceiveModal(true)}
              >
                📥 Receive Tokens
              </button>
            </div>

            {/* Transaction History Button */}
            <div className="history-section">
              <button 
                className="history-button" 
                onClick={() => setShowTransactions(!showTransactions)}
              >
                📋 Transaction History ({transactions.length})
              </button>
            </div>
            
            {/* Disconnect Button */}
            <button onClick={handleDisconnect} className="disconnect-button">
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Transaction History Display */}
      {showTransactions && transactions.length > 0 && (
        <div className="transaction-history-section">
          <h3>Recent Transactions</h3>
          <div className="transaction-list">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className={`transaction-item ${tx.type} ${tx.status}`}>
                <div className="transaction-info">
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
                      onClick={() => {
                        const tokenInput = document.getElementById('tokenInput');
                        const token = tokenInput.value.trim();
                        if (token) {
                          handleReceiveTokens(token).then(success => {
                            if (success) {
                              tokenInput.value = '';
                              setShowReceiveModal(false);
                            }
                          });
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

      {/* Wallet Features Info */}
      <div className="features-section">
        <h3>Ecash Wallet Features</h3>
        <ul className="features-list">
          <li>🔒 Private token transactions</li>
          <li>🌐 Sync across all your devices</li>
          <li>⚡ Send/receive nutzaps in social feeds</li>
          <li>📱 Works offline, syncs when online</li>
          <li>🔄 Encrypted backup via Nostr events</li>
        </ul>
      </div>
    </div>
  );
}; 