/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim.js';
import { URL } from 'react-native-url-polyfill'; // For robust URL parsing

// Check if Amber is installed (will only work in native context)
const isAmberInstalled = async () => {
  if (Platform.OS !== 'android') return false;
  
  try {
    // This will check if the app can handle the nostrsigner: URI scheme
    const canOpen = await Linking.canOpenURL('nostrsigner:');
    return canOpen;
  } catch (error) {
    console.error('Error checking if Amber is installed:', error);
    return false;
  }
};

// Store pending requests
const pendingSignRequests = new Map();

/**
 * Request authentication using Amber
 * This will open Amber and prompt the user for authentication
 * @returns {Promise<boolean>} Success status
 */
const requestAuthentication = async () => {
  if (Platform.OS !== 'android') {
    console.warn('Amber authentication is only supported on Android');
    return Promise.reject(new Error('Amber authentication is only supported on Android'));
  }
  
  try {
    const isAvailable = await isAmberInstalled();
    if (!isAvailable) {
      return Promise.reject(new Error('Amber app not found or not responding.'));
    }

    const requestId = `amberAuth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    // NIP-46 specifies callback_url, but some signers might use 'callback'
    const callbackParam = encodeURIComponent(`runstr://callback?type=get_public_key&requestId=${requestId}`);
    // Try with `callback_url` first as per NIP-46 for `get_public_key`
    let amberUri = `nostrsigner:get_public_key?callback_url=${callbackParam}&id=${requestId}`;
    
    // Fallback check if Linking.canOpenURL says one format is preferred or if Amber docs specify
    // For simplicity, we assume one format. Adjust if Amber has specific requirements.
    // Some older signer versions might use `type=get_public_key&callback=`
    // amberUri = `nostrsigner:?type=get_public_key&callback=${callbackParam}&id=${requestId}`;


    console.log(`Opening Amber (ID: ${requestId}) for authentication: ${amberUri}`);

    const promise = new Promise((resolve, reject) => {
      pendingSignRequests.set(requestId, { resolve, reject, timeout: setTimeout(() => {
        if (pendingSignRequests.has(requestId)) {
          pendingSignRequests.delete(requestId);
          console.error(`Amber authentication request ${requestId} timed out.`);
          reject(new Error('Amber authentication timed out'));
        }
      }, 60000) }); // 60-second timeout
    });

    await Linking.openURL(amberUri);
    return promise; // Return the promise
  } catch (error) {
    console.error('Error initiating authentication with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      // This specific error might not occur if isAmberInstalled works well
      console.error('Amber app not found or not responding');
      return Promise.reject(new Error('Amber app not found or not responding.'));
    }
    return Promise.reject(error);
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object>} Promise resolving with the signed event object
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return Promise.reject(new Error('Amber signing is only supported on Android'));
  }

  try {
    const isAvailable = await isAmberInstalled();
    if (!isAvailable) {
      return Promise.reject(new Error('Amber app not found or not responding.'));
    }

    if (!event || typeof event.kind !== 'number' || typeof event.content !== 'string') {
      console.error('Invalid event object for signing:', event);
      return Promise.reject(new Error('Invalid event object for signing'));
    }
    if (typeof event.created_at !== 'number') {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    // Pubkey should be present in the event passed to Amber for it to sign correctly
    if (!event.pubkey) {
        console.error('Event must have a pubkey for Amber to sign:', event);
        return Promise.reject(new Error('Event missing pubkey for Amber signing.'));
    }


    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    const requestId = `amberSign_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    // NIP-46 spec for "sign_event" recommends `callback_url` and `id`
    // The `id` in the nostrsigner URI is for NIP-46 context, distinct from our internal requestId.
    // Our internal `requestId` MUST be in the callback URL.
    const callbackParam = encodeURIComponent(`runstr://callback?type=sign_event&requestId=${requestId}`);
    // Amber's original doc/implementation might use `callback` instead of `callback_url`.
    // And `sign` instead of `sign_event`.
    // Original code used: `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`
    // Let's stick to the original `sign` type and `callback` param for Amber if that's what was working for opening it.
    const finalAmberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackParam}`;


    console.log(`Opening Amber (ID: ${requestId}) to sign event: ${finalAmberUri}`);
    
    const promise = new Promise((resolve, reject) => {
      pendingSignRequests.set(requestId, { resolve, reject, timeout: setTimeout(() => {
        if (pendingSignRequests.has(requestId)) {
          pendingSignRequests.delete(requestId);
          console.error(`Amber signing request ${requestId} timed out.`);
          reject(new Error('Amber signing timed out'));
        }
      }, 60000) }); // 60-second timeout
    });

    await Linking.openURL(finalAmberUri);
    return promise; // Return the promise

  } catch (error) {
    console.error('Error initiating signing with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      return Promise.reject(new Error('Amber app not found or not responding.'));
    }
    return Promise.reject(error);
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
        const urlObj = new URL(url);
        const response = urlObj.searchParams.get('response');
        
        if (response) {
          try {
            // Decode and parse the response
            const decodedResponse = decodeURIComponent(response);
            const parsedResponse = JSON.parse(decodedResponse);
            
            console.log('Successfully parsed Amber response');
            
            // Call the callback with the parsed response
            callback(parsedResponse);
          } catch (error) {
            console.error('Error parsing Amber response JSON:', error);
            callback(null);
          }
        } else {
          console.error('No response data in callback URL');
          callback(null);
        }
      } catch (error) {
        console.error('Error processing callback URL:', error);
        callback(null);
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    linkingListener.remove();
  };
};

// This function should be called by your app's deep link handler
const handleAmberSignCallback = (url) => {
  console.log('[AmberAuth] Handling Amber callback URL:', url);
  const parsedUrl = new URL(url); 
  const type = parsedUrl.searchParams.get('type');
  const requestId = parsedUrl.searchParams.get('requestId');
  
  if (!requestId || !pendingSignRequests.has(requestId)) {
    console.warn('[AmberAuth] Received Amber callback for unknown or missing requestId:', requestId, url);
    return;
  }

  const { resolve, reject, timeout } = pendingSignRequests.get(requestId);
  clearTimeout(timeout);

  try {
    const errorParam = parsedUrl.searchParams.get('error');
    if (errorParam) {
      console.error(`[AmberAuth] Amber callback for request ${requestId} reported error:`, decodeURIComponent(errorParam));
      reject(new Error(`Amber signing failed: ${decodeURIComponent(errorParam)}`));
      pendingSignRequests.delete(requestId);
      return;
    }

    if (type === 'sign_event') {
      // For `nostrsigner:sign?event=...` Amber might return the full signed event in a 'signature' parameter (NIP-46 style for general sign_event)
      // or simply 'event' parameter. Or just 'sig'.
      // If your `nostrsigner:sign` was a custom type, Amber's response might be different.
      // Assuming Amber returns the full signed event as a JSON string in the 'event' parameter, as it was the original payload.
      // OR, it might return *only* the 'sig' in a 'signature' parameter.
      // Let's prioritize `signature` containing full JSON, then `event` containing full JSON, then just `sig`.

      let signedEventJSON = parsedUrl.searchParams.get('signature'); // NIP-46 standard for `sign_event` is a JSON string of the signed event.
      let parseError = null;

      if (signedEventJSON) {
        try {
          const signedEvent = JSON.parse(decodeURIComponent(signedEventJSON));
          console.log(`[AmberAuth] Amber successfully signed event (from 'signature' param) for request ${requestId}:`, signedEvent);
          resolve(signedEvent);
        } catch (e) {
          parseError = e;
          console.warn(`[AmberAuth] Failed to parse 'signature' param for ${requestId}: ${signedEventJSON}`, e);
          // Try 'event' param if 'signature' failed or wasn't JSON
          signedEventJSON = null; 
        }
      }
      
      if (!signedEventJSON) { // If 'signature' was not present or failed to parse
          signedEventJSON = parsedUrl.searchParams.get('event');
          if (signedEventJSON) {
            try {
                const signedEvent = JSON.parse(decodeURIComponent(signedEventJSON));
                console.log(`[AmberAuth] Amber successfully signed event (from 'event' param) for request ${requestId}:`, signedEvent);
                resolve(signedEvent);
            } catch (e) {
                parseError = e;
                console.warn(`[AmberAuth] Failed to parse 'event' param for ${requestId}: ${signedEventJSON}`, e);
                signedEventJSON = null;
            }
          }
      }

      if (!signedEventJSON) { // If neither 'signature' nor 'event' param yielded a valid signed event
        // Check for just a 'sig'
        const sig = parsedUrl.searchParams.get('sig'); // Some implementations might only return signature
        if (sig) {
          // This case is harder, as we need the original event to reconstruct.
          // For now, we'll reject if only 'sig' is returned, as our `signEvent` sends the full event.
          console.warn(`[AmberAuth] Amber callback for ${requestId} returned only 'sig': ${sig}. Full signed event expected.`);
          reject(new Error('Amber callback returned only signature, not the full event.'));
        } else if (parseError) {
           reject(new Error(`Error parsing signed event from Amber: ${parseError.message}`));
        }
        else {
          console.error(`[AmberAuth] Amber callback for ${requestId} did not contain expected signed event data ('signature', 'event', or 'sig'). URL: ${url}`);
          reject(new Error('Amber callback did not return the expected signed event data.'));
        }
      }
    } else if (type === 'get_public_key') {
      // NIP-46 for `get_public_key` returns `pubkey`
      const pubkey = parsedUrl.searchParams.get('pubkey');
      if (pubkey) {
        console.log(`[AmberAuth] Amber returned pubkey for request ${requestId}:`, pubkey);
        resolve(pubkey);
      } else {
        console.error(`[AmberAuth] Amber callback for get_public_key ${requestId} did not contain 'pubkey'. URL: ${url}`);
        reject(new Error('Amber callback did not return public key.'));
      }
    } else {
      console.warn('[AmberAuth] Received Amber callback with unknown type:', type, url);
      reject(new Error(`Unhandled Amber callback type: ${type}`));
    }
  } catch (e) {
    console.error(`[AmberAuth] Error processing Amber callback for ${requestId}:`, e, url);
    reject(new Error(`Error processing Amber callback: ${e.message}`));
  } finally {
    pendingSignRequests.delete(requestId);
  }
};

// Ensure all relevant functions are exported, not stubs
export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling,
  handleAmberSignCallback
}; 