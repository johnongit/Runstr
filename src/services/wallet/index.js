import { AlbyWallet } from '../albyWallet';
import { WalletContext, WalletProvider, CONNECTION_STATES } from '../../contexts/WalletContext';
import { useWallet } from '../../hooks/useWallet';
import {
  initWalletService,
  connectWallet,
  softDisconnectWallet,
  hardDisconnectWallet,
  checkWalletConnection,
  getWalletInstance,
  getConnectionState,
  subscribeToConnectionChanges,
  getWalletAPI
} from './WalletPersistenceService';

export { 
  AlbyWallet,
  WalletContext,
  WalletProvider, 
  CONNECTION_STATES,
  useWallet,
  initWalletService,
  connectWallet,
  softDisconnectWallet,
  hardDisconnectWallet,
  checkWalletConnection,
  getWalletInstance,
  getConnectionState,
  subscribeToConnectionChanges,
  getWalletAPI
}; 