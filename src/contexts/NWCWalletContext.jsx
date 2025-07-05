import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  initWalletService, 
  connectWallet, 
  softDisconnectWallet, 
  hardDisconnectWallet,
  checkWalletConnection,
  getWalletInstance,
  getConnectionState,
  subscribeToConnectionChanges,
  getWalletAPI,
  CONNECTION_STATES 
} from '../services/wallet/WalletPersistenceService';

const NWCWalletContext = createContext();

export const useNWCWallet = () => {
  const context = useContext(NWCWalletContext);
  if (!context) {
    throw new Error('useNWCWallet must be used within NWCWalletProvider');
  }
  return context;
};

export const NWCWalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletAPI, setWalletAPI] = useState(null);

  // Initialize wallet service and set up connection monitoring
  useEffect(() => {
    console.log('[NWCWalletContext] Initializing wallet service...');
    
    const initializeWallet = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Initialize the wallet service
        const walletInstance = await initWalletService();
        const connectionState = getConnectionState();
        
        console.log('[NWCWalletContext] Wallet service initialized:', {
          hasInstance: !!walletInstance,
          connectionState
        });
        
        // Update state based on initialization result
        if (connectionState === CONNECTION_STATES.CONNECTED) {
          setIsConnected(true);
          setWalletAPI(getWalletAPI());
          await fetchBalance();
        } else {
          setIsConnected(false);
          setBalance(0);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('[NWCWalletContext] Failed to initialize wallet:', error);
        setError(error.message || 'Failed to initialize wallet');
        setIsConnected(false);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    initializeWallet();

    // Subscribe to connection state changes
    const unsubscribe = subscribeToConnectionChanges((state, instance) => {
      console.log('[NWCWalletContext] Connection state changed:', state);
      
      setIsConnecting(state === CONNECTION_STATES.CONNECTING);
      setIsConnected(state === CONNECTION_STATES.CONNECTED);
      setError(state === CONNECTION_STATES.ERROR ? 'Connection error' : null);
      
      if (state === CONNECTION_STATES.CONNECTED) {
        setWalletAPI(getWalletAPI());
        fetchBalance();
      } else {
        setWalletAPI(null);
        setBalance(0);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch wallet balance
  const fetchBalance = async () => {
    try {
      console.log('[NWCWalletContext] Fetching balance...');
      const walletAPIInstance = getWalletAPI();
      
      if (!walletAPIInstance) {
        console.warn('[NWCWalletContext] No wallet API available for balance fetch');
        return;
      }
      
      const balanceResult = await walletAPIInstance.getBalance();
      console.log('[NWCWalletContext] Balance fetched:', balanceResult);
      
      // Handle different response formats
      const balanceValue = typeof balanceResult === 'number' ? balanceResult : 0;
      setBalance(balanceValue);
      setError(null);
    } catch (error) {
      console.error('[NWCWalletContext] Error fetching balance:', error);
      setError(error.message || 'Failed to fetch balance');
      setBalance(0);
    }
  };

  // Connect wallet
  const connect = async (url) => {
    try {
      console.log('[NWCWalletContext] Attempting to connect wallet...');
      setIsConnecting(true);
      setError(null);
      
      const success = await connectWallet(url);
      
      if (success) {
        console.log('[NWCWalletContext] Wallet connected successfully');
        setIsConnected(true);
        setWalletAPI(getWalletAPI());
        await fetchBalance();
      } else {
        console.log('[NWCWalletContext] Wallet connection failed');
        setError('Failed to connect wallet');
      }
      
      return success;
    } catch (error) {
      console.error('[NWCWalletContext] Connect error:', error);
      setError(error.message || 'Failed to connect wallet');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet (soft disconnect - keeps credentials)
  const disconnect = async () => {
    try {
      console.log('[NWCWalletContext] Disconnecting wallet...');
      await softDisconnectWallet();
      setIsConnected(false);
      setWalletAPI(null);
      setBalance(0);
      setError(null);
    } catch (error) {
      console.error('[NWCWalletContext] Disconnect error:', error);
      setError(error.message || 'Failed to disconnect wallet');
    }
  };

  // Hard disconnect wallet (removes credentials)
  const hardDisconnect = async () => {
    try {
      console.log('[NWCWalletContext] Hard disconnecting wallet...');
      await hardDisconnectWallet();
      setIsConnected(false);
      setWalletAPI(null);
      setBalance(0);
      setError(null);
    } catch (error) {
      console.error('[NWCWalletContext] Hard disconnect error:', error);
      setError(error.message || 'Failed to disconnect wallet');
    }
  };

  // Make payment
  const makePayment = async (invoice) => {
    try {
      console.log('[NWCWalletContext] Making payment...');
      
      if (!walletAPI) {
        throw new Error('Wallet not connected');
      }
      
      const result = await walletAPI.makePayment(invoice);
      console.log('[NWCWalletContext] Payment successful:', result);
      
      // Refresh balance after payment
      await fetchBalance();
      
      return result;
    } catch (error) {
      console.error('[NWCWalletContext] Payment error:', error);
      throw error;
    }
  };

  // Generate invoice
  const generateInvoice = async (amount, memo = '') => {
    try {
      console.log('[NWCWalletContext] Generating invoice...');
      
      if (!walletAPI) {
        throw new Error('Wallet not connected');
      }
      
      const walletInstance = getWalletInstance();
      if (!walletInstance) {
        throw new Error('No wallet instance available');
      }
      
      const invoice = await walletInstance.generateInvoice(amount, memo);
      console.log('[NWCWalletContext] Invoice generated successfully');
      
      return invoice;
    } catch (error) {
      console.error('[NWCWalletContext] Invoice generation error:', error);
      throw error;
    }
  };

  // Generate zap invoice
  const generateZapInvoice = async (pubkey, amount, content = '') => {
    try {
      console.log('[NWCWalletContext] Generating zap invoice...');
      
      if (!walletAPI) {
        throw new Error('Wallet not connected');
      }
      
      const invoice = await walletAPI.generateZapInvoice(pubkey, amount, content);
      console.log('[NWCWalletContext] Zap invoice generated successfully');
      
      return invoice;
    } catch (error) {
      console.error('[NWCWalletContext] Zap invoice generation error:', error);
      throw error;
    }
  };

  // Check connection
  const checkConnection = async () => {
    try {
      const isConnected = await checkWalletConnection();
      return isConnected;
    } catch (error) {
      console.error('[NWCWalletContext] Connection check error:', error);
      return false;
    }
  };

  // Refresh wallet (fetch balance and check connection)
  const refreshWallet = async () => {
    try {
      console.log('[NWCWalletContext] Refreshing wallet...');
      const connectionActive = await checkConnection();
      
      if (connectionActive) {
        await fetchBalance();
      }
      
      return connectionActive;
    } catch (error) {
      console.error('[NWCWalletContext] Refresh error:', error);
      setError(error.message || 'Failed to refresh wallet');
      return false;
    }
  };

  const contextValue = {
    // Connection state
    isConnected,
    isConnecting,
    loading,
    error,
    isInitialized,
    
    // Wallet data
    balance,
    
    // Actions
    connect,
    disconnect,
    hardDisconnect,
    makePayment,
    generateInvoice,
    generateZapInvoice,
    checkConnection,
    refreshWallet,
    
    // Compatibility with existing components
    hasWallet: isConnected,
    wallet: walletAPI,
    
    // Additional properties that might be expected
    currentMint: null,
    transactions: [],
    tokenEvents: [],
    walletEvent: null,
    mintEvent: null,
    SUPPORTED_MINTS: [],
    DEFAULT_MINT_URL: '',
    
    // Stub functions for compatibility
    initializeWallet: async () => {
      console.log('[NWCWalletContext] Initialize wallet called');
      return refreshWallet();
    },
    ensureConnected: async () => {
      console.log('[NWCWalletContext] Ensure connected called');
      return checkConnection();
    }
  };

  return (
    <NWCWalletContext.Provider value={contextValue}>
      {children}
    </NWCWalletContext.Provider>
  );
};

export { NWCWalletContext }; 