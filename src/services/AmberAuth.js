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
    return canOpen;
  } catch (error) {
    console.error('Error checking if Amber is installed:', error);
    return false;
  }
};

/**
 * Request authentication using Amber
 * This will open Amber and prompt the user for authentication
 * @returns {Promise<boolean>} Success status
 */
const requestAuthentication = async () => {
  logDebug('Requesting authentication with Amber');
  
  if (Platform.OS !== 'android') {
    console.warn('Amber authentication is only supported on Android');
    return false;
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
        ['relay', 'wss://relay.nostr.band']
      ]
    };
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    logDebug('Opening Amber with URI:', amberUri);
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Authentication success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      return false;
    }
    return false;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<boolean>} Success status
 */
const signEvent = async (event) => {
  logDebug('Signing event with Amber:', event);
  
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return false;
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
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    logDebug('Opening Amber to sign event with URI:', amberUri);
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Signing success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      return false;
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
        
        // Handle different URL parsing methods
        if (typeof URL !== 'undefined') {
          urlObj = new URL(url);
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
        }
        
        // Get response parameter
        let response;
        if (urlObj.searchParams instanceof URLSearchParams) {
          response = urlObj.searchParams.get('response');
        } else {
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
          } catch (error) {
            console.error('Error parsing Amber response JSON:', error);
            if (pendingCallbacks.auth) {
              pendingCallbacks.auth(null);
            }
          }
        } else {
          console.error('No response data in callback URL');
          if (pendingCallbacks.auth) {
            pendingCallbacks.auth(null);
          }
        }
      } catch (error) {
        console.error('Error processing callback URL:', error);
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
    if (linkingListener && typeof linkingListener.remove === 'function') {
      linkingListener.remove();
    }
  };
};

export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling
}; 