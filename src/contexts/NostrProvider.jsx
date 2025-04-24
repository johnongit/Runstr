import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Check if Amber is installed - get from localStorage first if available for speed
      const cachedInstalled = localStorage.getItem('amber_installed');
      const cachedTimestamp = localStorage.getItem('amber_check_timestamp');
      const now = Date.now();
      const CACHE_TTL = 1000 * 60 * 60; // 1 hour
      
      if (cachedInstalled === 'true' && cachedTimestamp && (now - parseInt(cachedTimestamp, 10) < CACHE_TTL)) {
        console.log('Using cached Amber installed status:', cachedInstalled);
        setIsAmberAvailable(true);
      } else {
        // Perform a fresh check
        AmberAuth.isAmberInstalled().then(installed => {
          console.log('Fresh check if Amber is installed:', installed);
          setIsAmberAvailable(installed);
        });
      }
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        console.log('Received Amber response:', response);
        setIsAuthenticating(false);
        
        if (response && response.pubkey) {
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          setAuthError(null);
          
          // Save to localStorage for persistence
          localStorage.setItem('permissionsGranted', 'true');
          localStorage.setItem('userPublicKey', response.pubkey);
          
          console.log('Amber authentication successful with pubkey:', response.pubkey);
        } else {
          console.error('Failed to get public key from Amber response');
          setAuthError('Failed to get public key from Amber');
        }
      });
      
      // Cleanup
      return () => {
        removeListener();
      };
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
    // Clear previous errors
    setAuthError(null);
    
    // Check if already authenticated
    if (isNostrReady && publicKey) {
      console.log('Already authenticated with pubkey:', publicKey);
      return true;
    }
    
    // Set authenticating state to prevent multiple requests
    setIsAuthenticating(true);
    
    try {
      // For Android, use Amber if available
      if (Platform.OS === 'android') {
        // Verify Amber is still installed
        const amberReady = await AmberAuth.checkAmberConnection();
        
        if (!amberReady) {
          console.error('Amber not installed or not responding');
          setIsAmberAvailable(false);
          setIsAuthenticating(false);
          setAuthError('Amber not installed or not responding');
          return false;
        }
        
        setIsAmberAvailable(true);
        
        try {
          console.log('Requesting Amber authentication');
          const result = await AmberAuth.requestAuthentication();
          
          // The actual public key will be set by the deep link handler
          // But we can already return the success state
          return result;
        } catch (error) {
          console.error('Error requesting Amber authentication:', error);
          setAuthError(`Amber authentication error: ${error.message || 'Unknown error'}`);
          setIsAuthenticating(false);
          return false;
        }
      } 
      // For web or if Amber is not available, use window.nostr
      else if (window.nostr) {
        try {
          // This will trigger the extension permission dialog
          const pubkey = await window.nostr.getPublicKey();
          console.log('Got pubkey from window.nostr:', pubkey);
          setPublicKey(pubkey);
          setIsNostrReady(true);
          setAuthError(null);
          localStorage.setItem('permissionsGranted', 'true');
          localStorage.setItem('userPublicKey', pubkey);
          setIsAuthenticating(false);
          return true;
        } catch (error) {
          console.error('Error getting Nostr public key:', error);
          setAuthError(`Extension error: ${error.message || 'Unknown error'}`);
          setIsAuthenticating(false);
          return false;
        }
      } else {
        console.warn('No authentication method available');
        setAuthError('No Nostr authentication method available');
        setIsAuthenticating(false);
        return false;
      }
    } catch (error) {
      console.error('Unexpected error in requestNostrPermissions:', error);
      setAuthError(`Unexpected error: ${error.message || 'Unknown error'}`);
      setIsAuthenticating(false);
      return false;
    }
  }, [isNostrReady, publicKey, isAmberAvailable]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        // Verify Amber is still ready
        const amberReady = await AmberAuth.checkAmberConnection();
        if (!amberReady) {
          console.error('Amber not ready for signing');
          throw new Error('Amber not available for signing');
        }
        
        return AmberAuth.signEvent(event);
      } catch (error) {
        console.error('Error signing with Amber:', error);
        throw error;
      }
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      try {
        return window.nostr.signEvent(event);
      } catch (error) {
        console.error('Error signing with extension:', error);
        throw error;
      }
    } else {
      throw new Error('No signing method available');
    }
  }, [isAmberAvailable]);

  // Attempt to restore session on mount
  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      const storedPublicKey = localStorage.getItem('userPublicKey');
      
      if (permissionsGranted && storedPublicKey) {
        console.log('Restoring session with stored public key:', storedPublicKey);
        
        // For any platform, we can restore the stored public key
        setPublicKey(storedPublicKey);
        setIsNostrReady(true);
        
        // For Android, we also need to check if Amber is still available
        if (Platform.OS === 'android') {
          AmberAuth.isAmberInstalled().then(installed => {
            setIsAmberAvailable(installed);
          });
        } 
        // For web with extension
        else if (window.nostr) {
          try {
            // Verify the stored key matches the extension
            const extensionPubkey = await window.nostr.getPublicKey();
            
            if (extensionPubkey !== storedPublicKey) {
              console.warn('Stored pubkey does not match extension pubkey, updating');
              setPublicKey(extensionPubkey);
              localStorage.setItem('userPublicKey', extensionPubkey);
            }
          } catch (error) {
            console.error('Error verifying extension pubkey:', error);
            // Don't reset session on error, just continue with stored key
          }
        }
      }
    };

    initNostr();
  }, []);

  return (
    <NostrContext.Provider value={{ 
      publicKey, 
      isNostrReady,
      isAmberAvailable,
      isAuthenticating,
      authError,
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
