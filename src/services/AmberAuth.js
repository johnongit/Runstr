/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim';

// Debug mode
const DEBUG = true;

// Debug log
const logDebug = (...args) => {
  if (DEBUG) {
    console.log('[AmberAuth]', ...args);
  }
};

// Maximum number of retries for Amber operations
const MAX_RETRIES = 2;

// Timeout for operations (in milliseconds)
const OPERATION_TIMEOUT = 30000;

// Tracking state for operations
let pendingOperations = {
  auth: null,
  sign: null
};

// Check if Amber is installed (will only work in native context)
const isAmberInstalled = async () => {
  logDebug('Checking if Amber is installed');
  
  if (Platform.OS !== 'android') {
    logDebug('Not on Android, Amber is not available');
    return false;
  }
  
  try {
    // This will check if the app can handle the nostrsigner: URI scheme
    const canOpen = await Linking.canOpenURL('nostrsigner:');
    logDebug('Can open nostrsigner URI:', canOpen);
    
    // Store result in localStorage for faster future checks
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('amber_installed', canOpen ? 'true' : 'false');
      localStorage.setItem('amber_check_timestamp', Date.now().toString());
    }
    
    return canOpen;
  } catch (error) {
    console.error('Error checking if Amber is installed:', error);
    // Try to use cached result if available
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('amber_installed');
      if (cached === 'true' || cached === 'false') {
        logDebug('Using cached Amber installed status:', cached);
        return cached === 'true';
      }
    }
    return false;
  }
};

/**
 * Request authentication using Amber
 * This will open Amber and prompt the user for authentication
 * @returns {Promise<boolean>} Success status
 */
const requestAuthentication = async (retryCount = 0) => {
  logDebug('Requesting authentication with Amber (attempt ' + (retryCount + 1) + ')');
  
  if (Platform.OS !== 'android') {
    console.warn('Amber authentication is only supported on Android');
    return false;
  }
  
  // Clear any existing auth operation
  if (pendingOperations.auth) {
    logDebug('Cancelling previous auth operation');
    pendingOperations.auth = null;
  }
  
  try {
    // Create an authentication request event
    const authEvent = {
      kind: 22242, // Auth event kind
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to Runstr',
      tags: [
        ['relay', 'wss://relay.damus.io'],
        ['relay', 'wss://nos.lol'],
        ['relay', 'wss://relay.nostr.band'],
        ['relay', 'wss://relay.snort.social'] // Additional relay for redundancy
      ]
    };
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    // Add a unique identifier to prevent caching issues
    const uniqueId = Date.now();
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}&_=${uniqueId}`;
    
    logDebug('Opening Amber with URI:', amberUri);
    
    // Create operation tracking
    const operationPromise = new Promise((resolve, reject) => {
      pendingOperations.auth = { resolve, reject };
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (pendingOperations.auth) {
          pendingOperations.auth = null;
          reject(new Error('Authentication timeout'));
        }
      }, OPERATION_TIMEOUT);
    });
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Wait for callback to resolve/reject the promise
    return await operationPromise;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      // Update stored state to reflect Amber not being available
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('amber_installed', 'false');
        localStorage.setItem('amber_check_timestamp', Date.now().toString());
      }
      return false;
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      logDebug(`Retrying authentication (${retryCount + 1}/${MAX_RETRIES})`);
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      return requestAuthentication(retryCount + 1);
    }
    
    return false;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<boolean>} Success status
 */
const signEvent = async (event, retryCount = 0) => {
  logDebug('Signing event with Amber (attempt ' + (retryCount + 1) + '):', event);
  
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return false;
  }
  
  // Clear any existing sign operation
  if (pendingOperations.sign) {
    logDebug('Cancelling previous sign operation');
    pendingOperations.sign = null;
  }
  
  try {
    // Make sure event has required fields
    if (!event.kind || !event.content) {
      console.error('Invalid event object for signing');
      return false;
    }
    
    // Ensure created_at is set
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    // Make sure tags is an array
    if (!event.tags) {
      event.tags = [];
    }
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    // Add a unique identifier to prevent caching issues
    const uniqueId = Date.now();
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}&_=${uniqueId}`;
    
    logDebug('Opening Amber to sign event with URI:', amberUri);
    
    // Create operation tracking
    const operationPromise = new Promise((resolve, reject) => {
      pendingOperations.sign = { resolve, reject, event };
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (pendingOperations.sign) {
          pendingOperations.sign = null;
          reject(new Error('Signing timeout'));
        }
      }, OPERATION_TIMEOUT);
    });
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Wait for callback to resolve/reject the promise
    return await operationPromise;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      // Update stored state to reflect Amber not being available
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('amber_installed', 'false');
        localStorage.setItem('amber_check_timestamp', Date.now().toString());
      }
      return false;
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      logDebug(`Retrying signing (${retryCount + 1}/${MAX_RETRIES})`);
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      return signEvent(event, retryCount + 1);
    }
    
    return false;
  }
};

// Global callback storage to handle async operations
let pendingCallbacks = {};

/**
 * Setup deep link handling for Amber response
 * @param {Function} callback - The callback to handle the response
 */
const setupDeepLinkHandling = (callback) => {
  logDebug('Setting up deep link handling for Amber responses');
  
  // Store the callback for later use
  pendingCallbacks.auth = callback;
  
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    logDebug('Received deep link URL:', url);
    
    // Handle the response from Amber
    // URL format: runstr://callback?response=...
    if (url && url.startsWith('runstr://callback')) {
      try {
        // Parse the URL to get the response
        let urlObj;
        let response = null;
        
        // Handle different URL parsing methods
        if (typeof URL !== 'undefined') {
          urlObj = new URL(url);
          response = urlObj.searchParams.get('response');
        } else {
          // Simple URL parser fallback
          const searchParams = {};
          const queryString = url.split('?')[1];
          if (queryString) {
            const params = queryString.split('&');
            params.forEach(param => {
              const [key, value] = param.split('=');
              if (key && value) {
                searchParams[key] = value;
              }
            });
          }
          urlObj = { searchParams };
          response = urlObj.searchParams.response;
        }
        
        logDebug('Extracted response:', response);
        
        if (response) {
          try {
            // Decode and parse the response
            const decodedResponse = decodeURIComponent(response);
            const parsedResponse = JSON.parse(decodedResponse);
            
            logDebug('Successfully parsed Amber response:', parsedResponse);
            
            // Call the appropriate callback
            if (pendingCallbacks.auth) {
              pendingCallbacks.auth(parsedResponse);
            }
            
            // Resolve pending operations if any
            if (pendingOperations.auth) {
              pendingOperations.auth.resolve(true);
              pendingOperations.auth = null;
            }
            
            if (pendingOperations.sign && parsedResponse.id) {
              pendingOperations.sign.resolve(true);
              pendingOperations.sign = null;
            }
          } catch (error) {
            console.error('Error parsing Amber response JSON:', error);
            
            // Reject pending operations
            if (pendingOperations.auth) {
              pendingOperations.auth.reject(new Error('Failed to parse Amber response'));
              pendingOperations.auth = null;
            }
            
            if (pendingOperations.sign) {
              pendingOperations.sign.reject(new Error('Failed to parse Amber response'));
              pendingOperations.sign = null;
            }
            
            if (pendingCallbacks.auth) {
              pendingCallbacks.auth(null);
            }
          }
        } else {
          console.error('No response data in callback URL');
          
          // Reject pending operations
          if (pendingOperations.auth) {
            pendingOperations.auth.reject(new Error('No response data in callback URL'));
            pendingOperations.auth = null;
          }
          
          if (pendingOperations.sign) {
            pendingOperations.sign.reject(new Error('No response data in callback URL'));
            pendingOperations.sign = null;
          }
          
          if (pendingCallbacks.auth) {
            pendingCallbacks.auth(null);
          }
        }
      } catch (error) {
        console.error('Error processing callback URL:', error);
        
        // Reject pending operations
        if (pendingOperations.auth) {
          pendingOperations.auth.reject(error);
          pendingOperations.auth = null;
        }
        
        if (pendingOperations.sign) {
          pendingOperations.sign.reject(error);
          pendingOperations.sign = null;
        }
        
        if (pendingCallbacks.auth) {
          pendingCallbacks.auth(null);
        }
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    logDebug('Removing deep link listener');
    pendingCallbacks = {};
    pendingOperations = { auth: null, sign: null };
    if (linkingListener && typeof linkingListener.remove === 'function') {
      linkingListener.remove();
    }
  };
};

/**
 * Check the readiness of the Amber deep link connection
 * @returns {Promise<boolean>} True if ready
 */
const checkAmberConnection = async () => {
  logDebug('Checking Amber connection');
  
  // Verify Amber is installed
  const installed = await isAmberInstalled();
  if (!installed) {
    logDebug('Amber is not installed');
    return false;
  }
  
  return true;
};

export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling,
  checkAmberConnection
}; 