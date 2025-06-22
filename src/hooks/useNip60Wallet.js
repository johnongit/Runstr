import { useNip60 } from '../contexts/WalletContext';

/**
 * Legacy hook for backward compatibility.
 * Now simply wraps the centralized WalletContext.
 * @deprecated Use useNip60() from WalletContext directly instead.
 */
export const useNip60Wallet = () => {
  const walletContext = useNip60();
  
  // Map new context to old interface for backward compatibility
  return {
    // State
    walletEvent: walletContext.walletEvent,
    mintEvent: walletContext.mintEvent,
    tokenEvents: walletContext.tokenEvents,
    loading: walletContext.loading,
    error: walletContext.error,
    isInitialized: walletContext.isInitialized,
    balance: walletContext.balance,
    hasWallet: walletContext.hasWallet,
    currentMint: walletContext.currentMint,
    walletMints: walletContext.currentMint ? [walletContext.currentMint.url] : [],
    
    // Actions - map new names to old names
    createWallet: walletContext.initializeWallet, // Map old createWallet to new initializeWallet
    refreshWallet: walletContext.refreshWallet,
    discoverWallet: walletContext.refreshWallet, // Map old discoverWallet to refreshWallet
    
    // Constants
    SUPPORTED_MINTS: walletContext.SUPPORTED_MINTS
  };
}; 