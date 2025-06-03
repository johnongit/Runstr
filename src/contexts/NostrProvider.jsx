import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler -- THIS useEffect block will be removed.
  /*useEffect(() => {
    if (Platform.OS === 'android') {
      // Check if Amber is installed
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
      });
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        if (response && response.pubkey) {
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          localStorage.setItem('permissionsGranted', 'true');
        }
      });
      
      // Cleanup
      return () => {
        removeListener();
      };
    }
  }, []);*/

  // Check Amber availability on mount for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
        if (installed) {
          console.log('[NostrProvider] Amber is installed.');
        } else {
          console.log('[NostrProvider] Amber is NOT installed.');
        }
      });
    }
  }, []);

  const updateDefaultZapAmount = useCallback((amount) => {
    const numAmount = parseInt(amount, 10);
    if (!isNaN(numAmount) && numAmount > 0) {
      setDefaultZapAmount(numAmount);
      localStorage.setItem('defaultZapAmount', numAmount.toString());
    }
  }, []);

  /**
   * Request authentication using appropriate method based on platform
   */
  const requestNostrPermissions = useCallback(async () => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        console.log('[NostrProvider] Requesting Amber authentication via AmberAuth.requestAuthentication...');
        // AmberAuth.requestAuthentication() now returns a Promise that resolves with the pubkey
        const pubkeyFromAmber = await AmberAuth.requestAuthentication();
        
        if (pubkeyFromAmber && typeof pubkeyFromAmber === 'string') {
          console.log('[NostrProvider] Amber authentication successful, pubkey:', pubkeyFromAmber);
          setPublicKey(pubkeyFromAmber);
          setIsNostrReady(true); // Indicate that Nostr is ready with a signer
          localStorage.setItem('userPublicKey', pubkeyFromAmber); // Persist for other parts of the app
          localStorage.setItem('permissionsGranted', 'true');
          return true; // Indicate success
        } else {
          // This case should ideally be handled by the promise rejecting in AmberAuth
          console.warn('[NostrProvider] Amber authentication did not return a valid pubkey.');
          return false;
        }
      } catch (error) {
        console.error('[NostrProvider] Error requesting Amber authentication:', error);
        // Optionally, update UI to inform the user, e.g., set an error state
        return false;
      }
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      try {
        // This will trigger the extension permission dialog
        const pubkey = await window.nostr.getPublicKey();
        setPublicKey(pubkey);
        setIsNostrReady(true);
        localStorage.setItem('permissionsGranted', 'true');
        return true;
      } catch (error) {
        console.error('Error getting Nostr public key:', error);
        return false;
      }
    } else {
      console.warn('No authentication method available');
      return false;
    }
  }, [isAmberAvailable]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      console.log('[NostrProvider] Signing event with Amber...');
      return AmberAuth.signEvent(event); // This now returns a Promise<SignedEvent>
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      return window.nostr.signEvent(event);
    } else {
      throw new Error('No signing method available');
    }
  }, [isAmberAvailable]);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      const storedPubkey = localStorage.getItem('userPublicKey');
      
      if (permissionsGranted && storedPubkey) {
        console.log('[NostrProvider] Permissions previously granted and pubkey found. Initializing with pubkey:', storedPubkey);
        setPublicKey(storedPubkey);
        setIsNostrReady(true);
        // For Android, also check Amber's availability as it might have been uninstalled/reinstalled
        if (Platform.OS === 'android') {
          const installed = await AmberAuth.isAmberInstalled();
          setIsAmberAvailable(installed);
        }
      } else if (permissionsGranted && Platform.OS === 'android') {
        // Permissions granted but no pubkey stored - this might mean app was closed before callback.
        // AmberAuth.requestAuthentication() during a login attempt will handle this.
        // We can check Amber availability here.
        const installed = await AmberAuth.isAmberInstalled();
        setIsAmberAvailable(installed);
        console.log('[NostrProvider] Permissions granted on Android, Amber availability:', installed);
      }
      // For web, if permissionsGranted but no storedPubkey, NIP-07 will be prompted on next action
    };

    initNostr();
  }, [isAmberAvailable]);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      isAmberAvailable,
      requestNostrPermissions,
      signEvent,
      defaultZapAmount,
      updateDefaultZapAmount 
    }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
