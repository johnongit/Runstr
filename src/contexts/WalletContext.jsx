import React, { createContext, useContext } from 'react';

const WalletContext = createContext();

/**
 * Minimal WalletProvider that provides compatibility interface
 * without the ecash wallet functionality which is temporarily disabled
 */
export const WalletProvider = ({ children }) => {
  // Minimal ensureConnected function for compatibility
  const ensureConnected = async () => {
    // This is a stub for compatibility with existing components
    // Lightning wallet connection will be handled separately via NWC
    console.log('[WalletContext] ensureConnected called - Lightning wallet connection handled separately via NWC');
    return false; // Return false since ecash wallet is disabled
  };

  // Minimal wallet interface for compatibility
  const wallet = {
    ensureConnected,
    isConnected: false,
    // Add other minimal properties as needed for compatibility
  };

  const contextValue = {
    // Lightning wallet compatibility interface
    wallet,
    isConnected: false,
    ensureConnected,
    
    // Minimal ecash-style properties for components that might expect them
    loading: false,
    error: null,
    isInitialized: true,
    hasWallet: false, // Ecash wallet is disabled
    balance: 0,
    currentMint: null,
    tokenEvents: [],
    walletEvent: null,
    mintEvent: null,
    
    // Stub functions for compatibility
    initializeWallet: async () => {
      console.log('[WalletContext] Ecash wallet initialization disabled');
      return false;
    },
    refreshWallet: async () => {
      console.log('[WalletContext] Ecash wallet refresh disabled');
    },
    
    // Constants
    SUPPORTED_MINTS: [],
    DEFAULT_MINT_URL: ''
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook to consume wallet context
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