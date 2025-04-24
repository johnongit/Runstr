import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [isNostrReady, setIsNostrReady] = useState(false);
  const [isAmberAvailable, setIsAmberAvailable] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = useState(() => {
    const stored = localStorage.getItem('defaultZapAmount');
    return stored ? parseInt(stored, 10) : 1000; // Default to 1000 sats if not set
  });
  
  // Set up Amber deep linking handler
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Check if Amber is installed
      AmberAuth.isAmberInstalled().then(installed => {
        setIsAmberAvailable(installed);
        if (!installed) {
          console.log('Amber is not installed. Login will use extension if available.');
        }
      });
      
      // Set up deep link handler for Amber responses
      const removeListener = AmberAuth.setupDeepLinkHandling((response) => {
        setIsAuthenticating(false);
        
        // Check if there's an error in the response
        if (response && response.error) {
          console.error('Error in Amber response:', response.error);
          setAuthError({
            code: response.error,
            message: response.message || 'Unknown error occurred during authentication'
          });
          return;
        }
        
        // Handle successful authentication
        if (response && response.pubkey) {
          setPublicKey(response.pubkey);
          setIsNostrReady(true);
          setAuthError(null);
          localStorage.setItem('permissionsGranted', 'true');
          console.log('Successfully authenticated with Amber');
        } else if (response) {
          console.warn('Response received from Amber but no pubkey found:', response);
          setAuthError({
            code: 'NO_PUBKEY',
            message: 'No public key was returned from Amber'
          });
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
    // Clear any previous errors
    setAuthError(null);
    setIsAuthenticating(true);
    
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      try {
        // Check if permissions are needed
        const permissionsNeeded = await AmberAuth.checkPermissionsNeeded();
        
        if (!permissionsNeeded) {
          // If permissions are already granted, we can just use the stored pubkey
          const storedPubkey = localStorage.getItem('userPublicKey');
          if (storedPubkey) {
            setPublicKey(storedPubkey);
            setIsNostrReady(true);
            setIsAuthenticating(false);
            return true;
          }
        }
        
        // Request authentication from Amber
        const result = await AmberAuth.requestAuthentication();
        
        // If result is an object with an error field, authentication failed
        if (result && result.error) {
          console.error('Error during Amber authentication:', result.error);
          setAuthError({
            code: result.error,
            message: result.message || 'Unknown error occurred during authentication'
          });
          setIsAuthenticating(false);
          return false;
        }
        
        // The actual public key will be set by the deep link handler
        return result;
      } catch (error) {
        console.error('Error requesting Amber authentication:', error);
        setAuthError({
          code: 'UNKNOWN_ERROR',
          message: error.message || 'An unknown error occurred during authentication'
        });
        setIsAuthenticating(false);
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
        setAuthError(null);
        localStorage.setItem('permissionsGranted', 'true');
        setIsAuthenticating(false);
        return true;
      } catch (error) {
        console.error('Error getting Nostr public key:', error);
        setAuthError({
          code: 'EXTENSION_ERROR',
          message: error.message || 'Failed to get public key from Nostr extension'
        });
        setIsAuthenticating(false);
        return false;
      }
    } else {
      const errorMsg = 'No authentication method available. Please install Amber or a Nostr browser extension.';
      console.warn(errorMsg);
      setAuthError({
        code: 'NO_AUTH_METHOD',
        message: errorMsg
      });
      setIsAuthenticating(false);
      return false;
    }
  }, [isAmberAvailable]);

  /**
   * Sign an event using appropriate method based on platform
   */
  const signEvent = useCallback(async (event) => {
    // For Android, use Amber if available
    if (Platform.OS === 'android' && isAmberAvailable) {
      return AmberAuth.signEvent(event);
    } 
    // For web or if Amber is not available, use window.nostr
    else if (window.nostr) {
      return window.nostr.signEvent(event);
    } else {
      throw new Error('No signing method available');
    }
  }, [isAmberAvailable]);

  // Clear the authentication error
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    const initNostr = async () => {
      // Only auto-initialize if permissions were already granted
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (permissionsGranted) {
        // For Android, we may have a stored public key
        if (Platform.OS === 'android' && isAmberAvailable) {
          const storedPubkey = localStorage.getItem('userPublicKey');
          if (storedPubkey) {
            setPublicKey(storedPubkey);
            setIsNostrReady(true);
            return;
          }
          // Otherwise, we'll rely on the deep link handler
        } 
        // For web or if Amber is not available, use window.nostr
        else if (window.nostr) {
          try {
            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);
            setIsNostrReady(true);
          } catch (error) {
            console.error('Error getting Nostr public key:', error);
            // We don't set authError here because this is just initialization
          }
        }
      }
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
      updateDefaultZapAmount,
      authError,
      clearAuthError,
      isAuthenticating
    }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
