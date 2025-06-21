import { createContext, useContext, useState, useEffect } from 'react';
import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrContext } from './NostrContext';

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

// Default to CoinOS mint
const DEFAULT_MINT = SUPPORTED_MINTS[0].url; // CoinOS

const EcashWalletContext = createContext();

export const useEcashWallet = () => {
  const context = useContext(EcashWalletContext);
  if (!context) {
    throw new Error('useEcashWallet must be used within an EcashWalletProvider');
  }
  return context;
};

export const EcashWalletProvider = ({ children }) => {
  const { ndk, user } = useContext(NostrContext);
  
  // Wallet state - Default to CoinOS mint
  const [selectedMint, setSelectedMint] = useState(DEFAULT_MINT);
  const [customMintUrl, setCustomMintUrl] = useState('');
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [mintStatus, setMintStatus] = useState('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  
  // Transaction state
  const [transactions, setTransactions] = useState([]);
  
  // Initialize wallet on mount - works with global NDK, doesn't require immediate user
  useEffect(() => {
    if (ndk) {
      // Load transaction history immediately
      loadTransactionHistory();
      
      // Check for existing wallet only if user is available (from Amber)
      if (user) {
        checkExistingWallet();
      } else {
        // If no user yet, still allow mint connection without metadata lookup
        console.log('[EcashWallet] NDK available, user pending (Amber external signer)');
      }
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

  // Get the effective mint URL (selected predefined mint or custom)
  const getEffectiveMintUrl = () => {
    if (selectedMint === 'custom') {
      return customMintUrl;
    }
    return selectedMint;
  };

  // Check for existing NIP-60 wallet events (only when user is available)
  const checkExistingWallet = async () => {
    if (!ndk || !user) return;
    
    setIsLoadingExisting(true);
    setMintStatus('Checking for existing wallet...');
    
    try {
      console.log('[EcashWallet] Checking for existing NIP-60 wallet events...');
      
      // Look for existing wallet events (kind:37375 - wallet metadata)
      const walletFilter = {
        kinds: [37375],
        authors: [user.pubkey],
        limit: 10
      };
      
      const walletEvents = await ndk.fetchEvents(walletFilter);
      
      if (walletEvents.size > 0) {
        console.log(`[EcashWallet] Found ${walletEvents.size} existing wallet events`);
        
        // Get the most recent wallet event
        const sortedEvents = Array.from(walletEvents).sort((a, b) => b.created_at - a.created_at);
        const latestWalletEvent = sortedEvents[0];
        
        try {
          // Try to parse wallet metadata
          const walletData = JSON.parse(latestWalletEvent.content);
          
          if (walletData.mints && walletData.mints.length > 0) {
            console.log('[EcashWallet] Found existing wallet with mints:', walletData.mints);
            
            // Auto-select the first mint from existing wallet
            const existingMint = walletData.mints[0];
            const supportedMint = SUPPORTED_MINTS.find(m => m.url === existingMint);
            
            if (supportedMint) {
              setSelectedMint(existingMint);
              console.log(`[EcashWallet] Auto-selected existing mint: ${supportedMint.name}`);
            } else {
              setSelectedMint('custom');
              setCustomMintUrl(existingMint);
              console.log(`[EcashWallet] Auto-selected custom mint: ${existingMint}`);
            }
            
            // Automatically connect to the existing wallet
            await connectToExistingWallet(existingMint);
            return;
          }
        } catch (parseError) {
          console.warn('[EcashWallet] Could not parse wallet metadata:', parseError);
        }
      }
      
      console.log('[EcashWallet] No existing wallet found');
      setMintStatus('');
      
    } catch (error) {
      console.error('[EcashWallet] Error checking existing wallet:', error);
      setConnectionError('Failed to check for existing wallet');
    } finally {
      setIsLoadingExisting(false);
    }
  };

  // Connect to existing wallet from NIP-60 events
  const connectToExistingWallet = async (mintUrl) => {
    setIsConnecting(true);
    setMintStatus('Connecting to existing wallet...');
    
    try {
      console.log(`[EcashWallet] Connecting to existing wallet with mint: ${mintUrl}`);
      
      // Initialize NDK Cashu Wallet with global NDK
      const cashuWallet = new NDKCashuWallet(ndk);
      
      // Set mints as array property (correct NDK API)
      cashuWallet.mints = [mintUrl];
      
      // Load existing proofs from Nostr events
      await cashuWallet.start();
      
      // REQUIRED: Generate and publish the wallet's P2PK for receiving tokens
      setMintStatus('Generating wallet P2PK...');
      await cashuWallet.getP2pk();
      console.log(`[EcashWallet] P2PK generated: ${cashuWallet.p2pk}`);
      
      // REQUIRED: Publish the wallet's mint list for token/nutzap reception
      if (user) {
        setMintStatus('Publishing wallet configuration...');
        await cashuWallet.publish();
        console.log('[EcashWallet] Wallet published successfully');
        
        // Publish CashuMintList event (kind:10019) for nutzap reception
        await publishCashuMintList([mintUrl]);
      }
      
      // Get current balance from loaded proofs  
      const currentBalance = await cashuWallet.getBalance() || 0;
      
      // Set up wallet state
      setWallet(cashuWallet);
      setBalance(currentBalance);
      setIsConnected(true);
      
      // Configure NDK to use this wallet for zapping (NIP-60 compliance)
      ndk.wallet = cashuWallet;
      console.log('[EcashWallet] NDK wallet configured for zapping');
      
      const mintName = SUPPORTED_MINTS.find(m => m.url === mintUrl)?.name || 'Custom Mint';
      setMintStatus(`Connected to existing wallet: ${mintName}`);

      // Listen for balance changes
      cashuWallet.on('balance_changed', (newBalance) => {
        console.log('[EcashWallet] Balance changed:', newBalance);
        setBalance(newBalance);
      });

      console.log('[EcashWallet] Successfully connected to existing wallet');
      
    } catch (error) {
      console.error('[EcashWallet] Error connecting to existing wallet:', error);
      setConnectionError(`Failed to connect to existing wallet: ${error.message}`);
      setMintStatus('');
      // Reset selections so user can manually connect
      setSelectedMint(DEFAULT_MINT); // Reset to CoinOS default
      setCustomMintUrl('');
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to selected mint - AMBER COMPATIBLE (doesn't require immediate user)
  const connectToMint = async (mintUrl) => {
    if (!mintUrl || !mintUrl.startsWith('https://')) {
      setConnectionError('Please enter a valid mint URL starting with https://');
      return false;
    }

    // Only require NDK (global connection), not immediate user (Amber signing)
    if (!ndk) {
      setConnectionError('Nostr connection not available. Please check your connection.');
      return false;
    }

    setIsConnecting(true);
    setConnectionError('');
    setMintStatus('Connecting to mint...');

    try {
      console.log(`[EcashWallet] Connecting to mint: ${mintUrl}`);
      
      // Initialize NDK Cashu Wallet with global NDK
      const cashuWallet = new NDKCashuWallet(ndk);
      
      // Set mints as array property (correct NDK API)
      setMintStatus('Configuring wallet with mint...');
      cashuWallet.mints = [mintUrl];
      
      // Start the wallet to initialize NIP-60 event handling
      setMintStatus('Initializing wallet...');
      await cashuWallet.start();
      
      // REQUIRED: Generate and publish the wallet's P2PK for receiving tokens
      setMintStatus('Generating wallet P2PK...');
      await cashuWallet.getP2pk();
      console.log(`[EcashWallet] P2PK generated: ${cashuWallet.p2pk}`);
      
      // Test mint connection by getting balance
      setMintStatus('Testing mint connection...');
      
      // For new wallets, balance will be 0 initially
      const currentBalance = await cashuWallet.getBalance() || 0;
      
      // REQUIRED: Publish wallet configuration if user is available
      if (user) {
        setMintStatus('Publishing wallet configuration...');
        await cashuWallet.publish();
        console.log('[EcashWallet] Wallet published successfully');
        
        // Publish CashuMintList event (kind:10019) for nutzap reception
        await publishCashuMintList([mintUrl]);
        
        // Also create our legacy wallet metadata event for compatibility
        await createWalletMetadataEvent(mintUrl);
      } else {
        console.log('[EcashWallet] User not available (Amber), deferring wallet publish');
        setMintStatus('Wallet connected (will publish when user signs in)');
      }
      
      // Set up wallet state
      setWallet(cashuWallet);
      setBalance(currentBalance);
      setIsConnected(true);
      
      // Configure NDK to use this wallet for zapping (NIP-60 compliance)
      ndk.wallet = cashuWallet;
      console.log('[EcashWallet] NDK wallet configured for zapping');
      
      setMintStatus(`Connected to ${SUPPORTED_MINTS.find(m => m.url === mintUrl)?.name || 'Custom Mint'}`);

      // Listen for balance changes
      cashuWallet.on('balance_changed', (newBalance) => {
        console.log('[EcashWallet] Balance changed:', newBalance);
        setBalance(newBalance);
      });

      console.log('[EcashWallet] Successfully connected to mint');
      return true;
      
    } catch (error) {
      console.error('[EcashWallet] Connection error:', error);
      setConnectionError(`Failed to connect to mint: ${error.message}`);
      setMintStatus('');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Publish CashuMintList event (kind:10019) for nutzap reception - NIP-60 compliance
  const publishCashuMintList = async (mints) => {
    if (!user || !ndk) {
      console.log('[EcashWallet] User/NDK not available, skipping CashuMintList publication');
      return;
    }

    try {
      console.log('[EcashWallet] Publishing CashuMintList event (kind:10019)...');
      
      const mintListEvent = new NDKEvent(ndk);
      mintListEvent.kind = 10019; // CashuMintList
      mintListEvent.content = JSON.stringify({
        mints: mints.map(mint => ({ url: mint, units: ['sat'] }))
      });
      mintListEvent.tags = mints.map(mint => ['mint', mint]);
      mintListEvent.created_at = Math.floor(Date.now() / 1000);

      await mintListEvent.publish();
      console.log('[EcashWallet] CashuMintList event published successfully');
      
    } catch (error) {
      console.warn('[EcashWallet] Failed to publish CashuMintList event:', error);
      // Don't fail the connection for this
    }
  };

  // Deposit money to wallet via Lightning (NIP-60 compliance)
  const depositMoney = async (amount) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    if (!wallet.mints || wallet.mints.length === 0) {
      throw new Error('No mints configured');
    }

    try {
      console.log(`[EcashWallet] Starting deposit of ${amount} sats...`);
      
      const mint = wallet.mints[0]; // Use first mint
      const deposit = wallet.deposit(amount, mint);
      
      // Get Lightning invoice
      const bolt11 = await deposit.start();
      console.log(`[EcashWallet] Lightning invoice generated: ${bolt11}`);
      
      // Listen for successful deposit
      deposit.on('success', () => {
        console.log('[EcashWallet] Deposit successful! Balance:', wallet.balance);
        setBalance(wallet.balance);
        
        // Show success notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Deposit Successful', {
            body: `Successfully deposited ${amount} sats`,
            icon: '/icon.png'
          });
        }
      });
      
      deposit.on('error', (error) => {
        console.error('[EcashWallet] Deposit failed:', error);
      });
      
      return { invoice: bolt11, deposit };
      
    } catch (error) {
      console.error('[EcashWallet] Deposit error:', error);
      throw error;
    }
  };

  // Receive ecash tokens (NIP-60 compliance)
  const receiveToken = async (token) => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('[EcashWallet] Receiving ecash token...');
      
      const tokenEvent = await wallet.receiveToken(token);
      
      if (tokenEvent) {
        console.log('[EcashWallet] Token received successfully:', tokenEvent);
        
        // Refresh balance
        const newBalance = await wallet.getBalance();
        setBalance(newBalance);
        
        // Save to transaction history
        saveTransaction({
          type: 'receive',
          amount: tokenEvent.amount || 0,
          status: 'completed',
          token: token
        });
        
        // Show success notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Ecash Received', {
            body: `Successfully received ecash tokens`,
            icon: '/icon.png'
          });
        }
        
        return tokenEvent;
      }
      
    } catch (error) {
      console.error('[EcashWallet] Error receiving token:', error);
      throw error;
    }
  };

  // Create wallet metadata event (kind:37375) for NIP-60 compliance - DEFERRED AUTH
  const createWalletMetadataEvent = async (mintUrl) => {
    // Only create metadata if user is available (Amber has been used for signing)
    if (!user) {
      console.log('[EcashWallet] User not available, deferring metadata creation');
      return;
    }

    try {
      const walletMetadata = {
        name: "RUNSTR Ecash Wallet",
        mints: [mintUrl],
        created_at: Math.floor(Date.now() / 1000)
      };

      const metadataEvent = new NDKEvent(ndk);
      metadataEvent.kind = 37375;
      metadataEvent.content = JSON.stringify(walletMetadata);
      metadataEvent.tags = [
        ['name', 'RUNSTR Ecash Wallet'],
        ['mint', mintUrl]
      ];
      metadataEvent.created_at = Math.floor(Date.now() / 1000);

      await metadataEvent.publish();
      console.log('[EcashWallet] Wallet metadata event published');
      
    } catch (error) {
      console.warn('[EcashWallet] Failed to create wallet metadata event:', error);
      // Don't fail the connection for this
    }
  };

  // Disconnect from mint
  const disconnect = () => {
    if (wallet) {
      // Clean up wallet listeners
      try {
        wallet.removeAllListeners('balance_changed');
      } catch (error) {
        console.warn('[EcashWallet] Error cleaning up wallet listeners:', error);
      }
    }
    
    // Clear NDK wallet reference
    if (ndk) {
      ndk.wallet = undefined;
      console.log('[EcashWallet] NDK wallet reference cleared');
    }
    
    setWallet(null);
    setBalance(0);
    setIsConnected(false);
    setSelectedMint(DEFAULT_MINT); // Reset to CoinOS default
    setCustomMintUrl('');
    setMintStatus('');
    setConnectionError('');
    console.log('[EcashWallet] Disconnected from mint');
  };

  // Refresh balance from wallet
  const refreshBalance = async () => {
    if (!wallet) {
      setConnectionError('Wallet not connected');
      return;
    }
    
    try {
      setMintStatus('Refreshing balance...');
      
      // Force wallet to refresh from Nostr events
      await wallet.start();
      
      // Get updated balance
      const currentBalance = await wallet.getBalance() || 0;
      setBalance(currentBalance);
      setMintStatus(`Balance refreshed: ${currentBalance} sats`);
      
      console.log('[EcashWallet] Balance refreshed:', currentBalance);
      
      // Clear status message after delay
      setTimeout(() => {
        setMintStatus(`Connected to ${SUPPORTED_MINTS.find(m => m.url === getEffectiveMintUrl())?.name || 'Custom Mint'}`);
      }, 2000);
      
    } catch (error) {
      console.error('[EcashWallet] Error refreshing balance:', error);
      setConnectionError('Failed to refresh balance');
      setMintStatus('');
    }
  };

  // Send tokens function - DEFERRED AUTH (requires Amber signing)
  const sendTokens = async (recipientPubkey, amount, memo = '') => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    if (amount > balance) {
      throw new Error('Insufficient balance');
    }

    // This operation requires signing, so user must be available (Amber interaction)
    if (!user) {
      throw new Error('Authentication required for sending tokens. Please sign in with Amber.');
    }

    try {
      console.log(`[EcashWallet] Sending ${amount} sats to ${recipientPubkey}`);
      
      // Record transaction as pending
      const transaction = saveTransaction({
        type: 'send',
        amount,
        recipient: recipientPubkey,
        memo,
        status: 'pending'
      });

      // Create a transferable token from existing balance (spend tokens)
      console.log('[EcashWallet] Creating transferable token from balance...');
      const token = await wallet.send(amount);
      
      if (!token) {
        throw new Error('Failed to create transferable token. Please check your balance and try again.');
      }
      
      console.log('[EcashWallet] Token created successfully:', token);

      // Send the token via encrypted DM (requires Amber signing)
      console.log('[EcashWallet] Sending token via encrypted DM...');
      await sendTokenViaDM(recipientPubkey, token, memo);

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

      // Refresh balance from wallet after successful send
      const updatedBalance = await wallet.getBalance();
      setBalance(updatedBalance);

      // Show success notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Ecash Sent', {
          body: `Successfully sent ${amount} sats`,
          icon: '/icon.png'
        });
      }

      console.log('[EcashWallet] Send completed successfully');
      return true;
      
    } catch (error) {
      console.error('[EcashWallet] Send error:', error);
      
      // Update transaction as failed if transaction was created
      if (transaction) {
        const updatedTxs = transactions.map(tx => 
          tx.id === transaction.id 
            ? { ...tx, status: 'failed', error: error.message }
            : tx
        );
        setTransactions(updatedTxs);
        localStorage.setItem('ecash_transactions', JSON.stringify(updatedTxs));
      }
      
      throw error;
    }
  };

  // Send token via encrypted DM - DEFERRED AUTH (requires Amber signing)
  const sendTokenViaDM = async (recipientPubkey, token, memo) => {
    try {
      // Check for NDK signer availability (Amber interaction required)
      if (!ndk || !ndk.signer) {
        throw new Error('NDK signer not available. Authentication required.');
      }

      // User must be available for encryption (Amber signing)
      if (!user) {
        throw new Error('User not available for encryption. Please authenticate with Amber.');
      }

      // Create DM content with token and memo
      const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token: ${token}`;
      
      // Create encrypted DM event (kind 4)
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 4;
      ndkEvent.content = dmContent;
      ndkEvent.tags = [['p', recipientPubkey]];
      ndkEvent.created_at = Math.floor(Date.now() / 1000);

      // Encrypt and publish the DM (triggers Amber signing)
      await ndkEvent.encrypt(user);
      await ndkEvent.publish();
      
      console.log('[EcashWallet] Token sent via encrypted DM');
      
    } catch (error) {
      console.error('[EcashWallet] Error sending token via DM:', error);
      throw new Error(`Failed to send DM: ${error.message}`);
    }
  };

  // Auto-connect to CoinOS on first load if no wallet exists
  useEffect(() => {
    if (ndk && !isConnected && !isConnecting && !wallet && selectedMint === DEFAULT_MINT) {
      console.log('[EcashWallet] Auto-connecting to default CoinOS mint...');
      // Small delay to ensure context is fully initialized
      setTimeout(() => {
        connectToMint(DEFAULT_MINT);
      }, 500);
    }
  }, [ndk, isConnected, isConnecting, wallet, selectedMint]);

  // Context value
  const contextValue = {
    // State
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
    
    // Actions
    setSelectedMint,
    setCustomMintUrl,
    connectToMint,
    disconnect,
    refreshBalance,
    sendTokens,
    getEffectiveMintUrl,
    
    // New NIP-60 compliant methods
    depositMoney,
    receiveToken,
    publishCashuMintList,
    
    // Constants
    SUPPORTED_MINTS
  };

  return (
    <EcashWalletContext.Provider value={contextValue}>
      {children}
    </EcashWalletContext.Provider>
  );
};

export default EcashWalletContext; 