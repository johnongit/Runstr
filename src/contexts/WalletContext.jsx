import { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  getWalletAPI,
  getConnectionState, 
  subscribeToConnectionChanges, 
  CONNECTION_STATES,
  initWalletService
} from '../services/wallet/WalletPersistenceService';

// Export connection states
export { CONNECTION_STATES };

// Create the context with initial values
export const WalletContext = createContext({
  wallet: null,
  connectionState: CONNECTION_STATES.DISCONNECTED,
  error: null,
  balance: null,
  reconnectWithSavedCredentials: () => {},
  connectWithUrl: () => {},
  checkConnection: () => {},
  disconnect: () => {},
  ensureConnected: () => Promise.resolve(false),
  generateZapInvoice: () => Promise.resolve(''),
  refreshBalance: () => Promise.resolve(0),
});

/**
 * WalletProvider component for managing global wallet state
 */
export const WalletProvider = ({ children }) => {
  // Core state
  const [wallet, setWallet] = useState(null);
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);

  // Initialize wallet API
  useEffect(() => {
    console.log('[WalletContext] Initializing wallet provider');
    
    // Set the wallet API from our persistence service
    const walletAPI = getWalletAPI();
    setWallet(walletAPI);
    
    // Initialize the service (attempt to reconnect)
    initWalletService().catch(err => {
      console.error('[WalletContext] Error initializing wallet service:', err);
      setError(err.message || 'Failed to initialize wallet service');
    });
    
    // Subscribe to connection state changes
    const unsubscribe = subscribeToConnectionChanges((state) => {
      console.log('[WalletContext] Connection state changed:', state);
      setConnectionState(state);
      
      // If connected, refresh balance
      if (state === CONNECTION_STATES.CONNECTED) {
        refreshBalance();
      }
    });
    
    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Reconnect using saved credentials from local storage
   */
  const reconnectWithSavedCredentials = useCallback(async () => {
    if (!wallet) return false;
    
    try {
      setError(null);
      const connected = await wallet.ensureConnected();
      
      if (connected) {
        refreshBalance();
      }
      
      return connected;
    } catch (err) {
      console.error('[WalletContext] Failed to reconnect wallet:', err);
      setError(err.message || 'Failed to reconnect wallet');
      return false;
    }
  }, [wallet]);

  /**
   * Connect wallet with NWC URL
   * @param {string} url - NWC connection URL
   */
  const connectWithUrl = useCallback(async (url) => {
    if (!wallet) return false;
    
    try {
      setError(null);
      const connected = await wallet.connect(url);
      
      if (connected) {
        refreshBalance();
      }
      
      return connected;
    } catch (err) {
      console.error('[WalletContext] Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      return false;
    }
  }, [wallet]);

  /**
   * Check if wallet is still connected
   */
  const checkConnection = useCallback(async () => {
    if (!wallet) return false;
    
    try {
      return await wallet.checkConnection();
    } catch (err) {
      console.error('[WalletContext] Wallet connection check failed:', err);
      setError(err.message || 'Wallet connection check failed');
      return false;
    }
  }, [wallet]);

  /**
   * Disconnect the wallet
   */
  const disconnect = useCallback(() => {
    if (!wallet) return;
    
    try {
      wallet.disconnect();
      setBalance(null);
    } catch (err) {
      console.error('[WalletContext] Failed to disconnect wallet:', err);
      setError(err.message || 'Failed to disconnect wallet');
    }
  }, [wallet]);

  /**
   * Ensure wallet is connected before making payments
   * Attempts to reconnect if disconnected
   */
  const ensureConnected = useCallback(async () => {
    if (!wallet) return false;
    return await wallet.ensureConnected();
  }, [wallet]);

  /**
   * Generate a zap invoice for the given amount
   * @param {string} pubkey - Pubkey to zap
   * @param {number} amount - Amount in sats
   * @param {string} comment - Optional comment for the invoice
   */
  const generateZapInvoice = useCallback(async (pubkey, amount, comment = '') => {
    if (!wallet) throw new Error('Wallet not initialized');
    
    try {
      const connected = await ensureConnected();
      if (!connected) throw new Error('Wallet not connected');
      
      return await wallet.generateZapInvoice(pubkey, amount, comment);
    } catch (err) {
      console.error('[WalletContext] Failed to generate zap invoice:', err);
      // Handle specific error for zapping (HTTP 422)
      if (err.message && err.message.includes('422')) {
        throw new Error('Unable to generate invoice. Check your wallet connection and try again.');
      }
      throw err;
    }
  }, [wallet, ensureConnected]);

  /**
   * Refresh wallet balance
   */
  const refreshBalance = useCallback(async () => {
    if (!wallet) return 0;
    
    try {
      const connected = await ensureConnected();
      if (!connected) return 0;
      
      const currentBalance = await wallet.getBalance();
      setBalance(currentBalance);
      return currentBalance;
    } catch (err) {
      console.error('[WalletContext] Failed to fetch wallet balance:', err);
      setError(err.message || 'Failed to fetch wallet balance');
      return 0;
    }
  }, [wallet, ensureConnected]);

  const contextValue = {
    wallet,
    connectionState,
    error,
    balance,
    reconnectWithSavedCredentials,
    connectWithUrl,
    checkConnection,
    disconnect,
    ensureConnected,
    generateZapInvoice,
    refreshBalance,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

WalletProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default WalletProvider; 