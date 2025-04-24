/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim';

// Check if Amber is installed (will only work in native context)
const isAmberInstalled = async () => {
  if (Platform.OS !== 'android') return false;
  
  try {
    // Check both the newer 'amber:' and the older 'nostrsigner:' URI schemes
    const canOpenAmber = await Linking.canOpenURL('amber:');
    if (canOpenAmber) return true;
    
    const canOpenNostrSigner = await Linking.canOpenURL('nostrsigner:');
    return canOpenNostrSigner;
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
    
    // Create the URI with the appropriate scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    
    // Try the newer amber: scheme first, then fall back to nostrsigner:
    let amberUri;
    const canOpenAmber = await Linking.canOpenURL('amber:');
    if (canOpenAmber) {
      amberUri = `amber:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    } else {
      amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    }
    
    console.log('Opening Amber with URI:', amberUri);
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Authentication success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding. Please ensure Amber is installed.');
      return {
        success: false,
        error: 'AMBER_NOT_INSTALLED',
        message: 'Amber app not found. Please install Amber from the Google Play Store.'
      };
    }
    
    return {
      success: false,
      error: 'AUTHENTICATION_FAILED',
      message: error.message || 'Failed to authenticate with Amber'
    };
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object|boolean>} Success status or error object
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return false;
  }
  
  try {
    // Make sure event has required fields
    if (!event.kind || !event.content) {
      console.error('Invalid event object for signing');
      return {
        success: false,
        error: 'INVALID_EVENT',
        message: 'Event must have kind and content fields'
      };
    }
    
    // Ensure created_at is set
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the appropriate scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    
    // Try the newer amber: scheme first, then fall back to nostrsigner:
    let amberUri;
    const canOpenAmber = await Linking.canOpenURL('amber:');
    if (canOpenAmber) {
      amberUri = `amber:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    } else {
      amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    }
    
    console.log('Opening Amber to sign event');
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Signing success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      return {
        success: false,
        error: 'AMBER_NOT_INSTALLED',
        message: 'Amber app not found. Please install Amber from the Google Play Store.'
      };
    }
    
    return {
      success: false,
      error: 'SIGNING_FAILED',
      message: error.message || 'Failed to sign event with Amber'
    };
  }
};

/**
 * Setup deep link handling for Amber response
 * @param {Function} callback - The callback to handle the response
 */
const setupDeepLinkHandling = (callback) => {
  console.log('Setting up deep link handling for Amber responses');
  
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    console.log('Received deep link URL:', url);
    
    // Handle the response from Amber
    // URL format: runstr://callback?response=...
    if (url && url.startsWith('runstr://callback')) {
      try {
        // Parse the URL to get the response
        // Try using the URL constructor first
        let response;
        try {
          const urlObj = new URL(url);
          response = urlObj.searchParams.get('response');
        } catch (urlError) {
          // If URL constructor fails, fall back to manual parsing
          const queryStart = url.indexOf('?');
          if (queryStart !== -1) {
            const query = url.substring(queryStart + 1);
            const params = new URLSearchParams(query);
            response = params.get('response');
          }
        }
        
        if (response) {
          try {
            // Decode and parse the response
            const decodedResponse = decodeURIComponent(response);
            const parsedResponse = JSON.parse(decodedResponse);
            
            console.log('Successfully parsed Amber response:', parsedResponse);
            
            // Handle potential permission errors
            if (parsedResponse.error) {
              console.error('Amber response contains an error:', parsedResponse.error);
              callback({ 
                error: parsedResponse.error,
                message: parsedResponse.message || 'Unknown Amber error'
              });
              return;
            }
            
            // Call the callback with the parsed response
            callback(parsedResponse);
            
            // If pubkey is present, store it for future use
            if (parsedResponse.pubkey) {
              localStorage.setItem('userPublicKey', parsedResponse.pubkey);
            }
          } catch (error) {
            console.error('Error parsing Amber response JSON:', error);
            callback({
              error: 'PARSE_ERROR',
              message: 'Could not parse response from Amber'
            });
          }
        } else {
          console.error('No response data in callback URL');
          callback({
            error: 'NO_RESPONSE',
            message: 'No response data received from Amber'
          });
        }
      } catch (error) {
        console.error('Error processing callback URL:', error);
        callback({
          error: 'CALLBACK_ERROR',
          message: 'Error processing response from Amber'
        });
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    linkingListener.remove();
  };
};

/**
 * Check if additional permissions are needed from Amber
 * @returns {Promise<boolean>} Whether additional permissions are needed
 */
const checkPermissionsNeeded = async () => {
  // Check if we have a stored public key
  const storedPubkey = localStorage.getItem('userPublicKey');
  
  // If no public key, permissions are definitely needed
  if (!storedPubkey) {
    return true;
  }
  
  // Otherwise, assume permissions are granted
  // (Amber will handle permission revocation on its side)
  return false;
};

export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling,
  checkPermissionsNeeded
}; 