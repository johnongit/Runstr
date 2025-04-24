import { useContext } from 'react';
import { WalletContext, CONNECTION_STATES } from '../contexts/WalletContext';

/**
 * Hook to access wallet functionality from the WalletContext
 * @returns {Object} Wallet context values and utility functions
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  
  // Derived computed properties
  const isConnected = context.connectionState === CONNECTION_STATES.CONNECTED;
  const isConnecting = context.connectionState === CONNECTION_STATES.CONNECTING;
  const isDisconnected = context.connectionState === CONNECTION_STATES.DISCONNECTED;
  const hasError = context.connectionState === CONNECTION_STATES.ERROR;
  
  return {
    ...context,
    // Add computed properties
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,
    CONNECTION_STATES,
  };
};

export default useWallet; 