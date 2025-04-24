import { createContext } from 'react';

// Create the Nostr context with default values
export const NostrContext = createContext({
  publicKey: null,
  isNostrReady: false,
  isAmberAvailable: false,
  isAuthenticating: false,
  authError: null,
  requestNostrPermissions: async () => false,
  signEvent: async () => { throw new Error('Not initialized'); },
  defaultZapAmount: 1000,
  updateDefaultZapAmount: () => {}
});
