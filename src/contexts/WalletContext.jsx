import React, { createContext, useContext, useState, useEffect } from 'react';
import { NostrContext } from './NostrContext';
import { 
  findWalletEvents, 
  createWalletEvents, 
  queryTokenEvents, 
  calculateBalance,
  SUPPORTED_MINTS,
  getMintInfo 
} from '../utils/nip60Events';

// Default mint for new users (CoinOS)
const DEFAULT_MINT_URL = 'https://mint.coinos.io';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const { ndk, publicKey } = useContext(NostrContext);
  
  // Centralized wallet state
  const [walletState, setWalletState] = useState({
    walletEvent: null,
    mintEvent: null,
    tokenEvents: [],
    loading: false,
    error: null,
    isInitialized: false
  });

  // Auto-discover wallet on user connection
  useEffect(() => {
    if (ndk && publicKey && !walletState.isInitialized) {
      discoverWallet();
    }
  }, [ndk, publicKey, walletState.isInitialized]);

  /**
   * Auto-discover existing wallet or prepare for creation
   */
  const discoverWallet = async () => {
    if (!publicKey) {
      console.log('[WalletProvider] No publicKey available, cannot discover wallet');
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: 'Please sign in with Amber to access your wallet',
        isInitialized: true
      }));
      return;
    }

    setWalletState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('[WalletProvider] Discovering existing NIP60 wallet for pubkey:', publicKey.substring(0, 8) + '...');
      const walletData = await findWalletEvents(ndk, publicKey);
      
      if (walletData && walletData.hasWallet) {
        console.log('[WalletProvider] Found existing wallet');
        
        // Load token events for balance calculation
        const tokens = await queryTokenEvents(ndk, publicKey);
        
        setWalletState({
          walletEvent: walletData.walletEvent,
          mintEvent: walletData.mintEvent,
          tokenEvents: tokens,
          loading: false,
          error: null,
          isInitialized: true
        });
      } else {
        console.log('[WalletProvider] No existing wallet found - ready for initialization');
        setWalletState({
          walletEvent: null,
          mintEvent: null,
          tokenEvents: [],
          loading: false,
          error: null,
          isInitialized: true
        });
      }
    } catch (error) {
      console.error('[WalletProvider] Discovery error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        isInitialized: true
      }));
    }
  };

  /**
   * Initialize new wallet with default CoinOS mint
   */
  const initializeWallet = async (mintUrl = DEFAULT_MINT_URL) => {
    if (!publicKey) {
      throw new Error('Please sign in with Amber first to initialize your wallet.');
    }

    if (!ndk || !ndk.signer) {
      throw new Error('NDK signer not available. Please sign in with Amber to initialize your wallet.');
    }

    setWalletState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[WalletProvider] Initializing new wallet with mint:', mintUrl, 'for pubkey:', publicKey.substring(0, 8) + '...');
      const result = await createWalletEvents(ndk, mintUrl);
      
      if (result && result.walletEvent) {
        // Refresh wallet data after creation
        await discoverWallet();
        return true;
      } else {
        throw new Error('Failed to create wallet events');
      }
    } catch (error) {
      console.error('[WalletProvider] Wallet initialization error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      return false;
    }
  };

  /**
   * Refresh wallet data (re-query all events)
   */
  const refreshWallet = async () => {
    if (!walletState.isInitialized || !publicKey) return;
    
    console.log('[WalletProvider] Refreshing wallet data for pubkey:', publicKey.substring(0, 8) + '...');
    setWalletState(prev => ({ ...prev, loading: true, error: null }));
    await discoverWallet();
  };

  // Computed values
  const hasWallet = walletState.walletEvent !== null;
  const balance = calculateBalance(walletState.tokenEvents);
  const currentMint = walletState.mintEvent ? getMintInfo(walletState.mintEvent) : null;

  const contextValue = {
    // State
    loading: walletState.loading,
    error: walletState.error,
    isInitialized: walletState.isInitialized,
    hasWallet,
    balance,
    currentMint,
    tokenEvents: walletState.tokenEvents,
    walletEvent: walletState.walletEvent,
    mintEvent: walletState.mintEvent,
    
    // Actions
    initializeWallet,
    refreshWallet,
    
    // Constants
    SUPPORTED_MINTS,
    DEFAULT_MINT_URL
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook to consume NIP60 wallet context
export const useNip60 = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useNip60 must be used within a WalletProvider');
  }
  return context;
};

// Legacy export for backward compatibility
export const useWallet = useNip60;

// Export context for advanced usage
export { WalletContext }; 