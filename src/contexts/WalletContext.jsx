import { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AlbyWallet } from '../services/albyWallet';

// Connection states
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

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
  const [connectionCheckInterval, setConnectionCheckInterval] = useState(null);

  // Initialize wallet instance
  useEffect(() => {
    const walletInstance = new AlbyWallet();
    setWallet(walletInstance);
    
    // Try to reconnect using saved credentials
    const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
    const savedConnectionString = localStorage.getItem('nwcConnectionString');
    
    if (savedAuthUrl || savedConnectionString) {
      // Attempt to reconnect on mount
      setTimeout(async () => {
        try {
          setConnectionState(CONNECTION_STATES.CONNECTING);
          await walletInstance.ensureConnected();
          const isConnected = await walletInstance.checkConnection();
          if (isConnected) {
            setConnectionState(CONNECTION_STATES.CONNECTED);
          } else {
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
          }
        } catch (err) {
          console.error('Failed to reconnect on mount:', err);
          setConnectionState(CONNECTION_STATES.DISCONNECTED);
        }
      }, 500);
    }
    
    return () => {
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      // Disconnect wallet on unmount if connected
      if (walletInstance && connectionState === CONNECTION_STATES.CONNECTED) {
        walletInstance.disconnect();
      }
    };
  }, []);

  // Set up periodic connection check
  useEffect(() => {
    if (wallet && connectionState === CONNECTION_STATES.CONNECTED) {
      const interval = setInterval(() => {
        checkConnection();
      }, 30000); // Check every 30 seconds
      
      setConnectionCheckInterval(interval);
      
      return () => clearInterval(interval);
    }
  }, [wallet, connectionState]);

  /**
   * Reconnect using saved credentials from local storage
   */
  const reconnectWithSavedCredentials = useCallback(async () => {
    if (!wallet) return false;
    
    try {
      setConnectionState(CONNECTION_STATES.CONNECTING);
      setError(null);
      
      const connected = await wallet.ensureConnected();
      
      if (connected) {
        setConnectionState(CONNECTION_STATES.CONNECTED);
        refreshBalance();
        return true;
      } else {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
        return false;
      }
    } catch (err) {
      console.error('Failed to reconnect wallet:', err);
      setError(err.message || 'Failed to reconnect wallet');
      setConnectionState(CONNECTION_STATES.ERROR);
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
      setConnectionState(CONNECTION_STATES.CONNECTING);
      setError(null);
      
      const connected = await wallet.connect(url);
      
      if (connected) {
        setConnectionState(CONNECTION_STATES.CONNECTED);
        refreshBalance();
        return true;
      } else {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
        return false;
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      setConnectionState(CONNECTION_STATES.ERROR);
      return false;
    }
  }, [wallet]);

  /**
   * Check if wallet is still connected
   */
  const checkConnection = useCallback(async () => {
    if (!wallet) return false;
    
    try {
      const isConnected = await wallet.checkConnection();
      
      if (isConnected) {
        // Only update state if different to avoid re-renders
        if (connectionState !== CONNECTION_STATES.CONNECTED) {
          setConnectionState(CONNECTION_STATES.CONNECTED);
        }
        return true;
      } else {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
        return false;
      }
    } catch (err) {
      console.error('Wallet connection check failed:', err);
      setError(err.message || 'Wallet connection check failed');
      setConnectionState(CONNECTION_STATES.ERROR);
      return false;
    }
  }, [wallet, connectionState]);

  /**
   * Disconnect the wallet
   */
  const disconnect = useCallback(() => {
    if (!wallet) return;
    
    try {
      wallet.disconnect();
      setConnectionState(CONNECTION_STATES.DISCONNECTED);
      setError(null);
      setBalance(null);
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      setError(err.message || 'Failed to disconnect wallet');
    }
  }, [wallet]);

  /**
   * Ensure wallet is connected before making payments
   * Attempts to reconnect if disconnected
   */
  const ensureConnected = useCallback(async () => {
    if (!wallet) return false;
    
    // If already connected, return true
    if (connectionState === CONNECTION_STATES.CONNECTED) {
      const isConnected = await checkConnection();
      if (isConnected) return true;
    }
    
    // Try to reconnect with saved credentials
    return await reconnectWithSavedCredentials();
  }, [wallet, connectionState, checkConnection, reconnectWithSavedCredentials]);

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
      
      const invoice = await wallet.generateZapInvoice(pubkey, amount, comment);
      return invoice;
    } catch (err) {
      console.error('Failed to generate zap invoice:', err);
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
      console.error('Failed to fetch wallet balance:', err);
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