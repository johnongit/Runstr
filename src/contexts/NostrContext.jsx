import { createContext } from 'react';

// Create the Nostr context with default values
export const NostrContext = createContext({
  publicKey: null,
  isNostrReady: false,
  isAmberAvailable: false,
  requestNostrPermissions: async () => false,
  signEvent: async () => { throw new Error('Not implemented') },
  defaultZapAmount: 1000,
  updateDefaultZapAmount: () => {},
  authError: null,
  clearAuthError: () => {},
  isAuthenticating: false
});
