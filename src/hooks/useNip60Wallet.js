import { useState, useEffect, useContext, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { 
  findWalletEvents, 
  createWalletEvents, 
  queryTokenEvents, 
  calculateBalance,
  SUPPORTED_MINTS,
  getMintInfo 
} from '../utils/nip60Events';

export const useNip60Wallet = () => {
  const { ndk, user } = useContext(NostrContext);
  
  // Simple state - just events and loading
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
    if (ndk && user && !walletState.isInitialized) {
      discoverWallet();
    }
  }, [ndk, user, walletState.isInitialized]);

  /**
   * Auto-discover existing wallet or show creation UI
   */
  const discoverWallet = async () => {
    setWalletState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('[NIP60Wallet] Discovering existing wallet...');
      const walletData = await findWalletEvents(ndk, user.pubkey);
      
      if (walletData && walletData.hasWallet) {
        console.log('[NIP60Wallet] Found existing wallet');
        
        // Load token events for balance calculation
        const tokens = await queryTokenEvents(ndk, user.pubkey);
        
        setWalletState({
          walletEvent: walletData.walletEvent,
          mintEvent: walletData.mintEvent,
          tokenEvents: tokens,
          loading: false,
          error: null,
          isInitialized: true
        });
      } else {
        console.log('[NIP60Wallet] No existing wallet found');
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
      console.error('[NIP60Wallet] Discovery error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        isInitialized: true
      }));
    }
  };

  /**
   * Create new wallet with selected mint
   */
  const createWallet = async (selectedMintUrl) => {
    if (!selectedMintUrl) {
      throw new Error('Mint URL is required');
    }

    setWalletState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[NIP60Wallet] Creating new wallet...');
      const { walletEvent, mintEvent } = await createWalletEvents(ndk, selectedMintUrl);
      
      setWalletState({
        walletEvent,
        mintEvent,
        tokenEvents: [], // New wallet starts with no tokens
        loading: false,
        error: null,
        isInitialized: true
      });

      return true;
    } catch (error) {
      console.error('[NIP60Wallet] Creation error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      return false;
    }
  };

  /**
   * Refresh wallet data from relays
   */
  const refreshWallet = async () => {
    if (!user) return;
    
    setWalletState(prev => ({ ...prev, loading: true }));
    
    try {
      const [walletData, tokens] = await Promise.all([
        findWalletEvents(ndk, user.pubkey),
        queryTokenEvents(ndk, user.pubkey)
      ]);

      setWalletState(prev => ({
        ...prev,
        walletEvent: walletData?.walletEvent || prev.walletEvent,
        mintEvent: walletData?.mintEvent || prev.mintEvent,
        tokenEvents: tokens,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('[NIP60Wallet] Refresh error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Computed values
  const balance = useMemo(() => {
    return calculateBalance(walletState.tokenEvents);
  }, [walletState.tokenEvents]);

  const hasWallet = Boolean(walletState.walletEvent);

  const currentMint = useMemo(() => {
    if (!walletState.mintEvent) return null;
    
    try {
      const mintData = JSON.parse(walletState.mintEvent.content);
      const mintUrl = mintData.mints?.[0]?.url;
      return getMintInfo(mintUrl);
    } catch (error) {
      return null;
    }
  }, [walletState.mintEvent]);

  const walletMints = useMemo(() => {
    if (!walletState.walletEvent) return [];
    
    try {
      const walletData = JSON.parse(walletState.walletEvent.content);
      return walletData.mints || [];
    } catch (error) {
      return [];
    }
  }, [walletState.walletEvent]);

  return {
    // State
    ...walletState,
    balance,
    hasWallet,
    currentMint,
    walletMints,
    
    // Actions
    createWallet,
    refreshWallet,
    discoverWallet,
    
    // Constants
    SUPPORTED_MINTS
  };
}; 