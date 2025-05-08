import { createContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
// import { relays as defaultRelays } from '../config/relays.js'; // Use relays from config - Temporarily disabled for debugging

// Add these lines for the awaitable promise
let ndkReadyResolver;
export const ndkReadyPromise = new Promise(resolve => {
    ndkReadyResolver = resolve;
});

// Ensure the primary group relay is included
// Step 1: Simplify explicitRelayUrls for debugging
const explicitRelays = [
  'wss://relay.damus.io', // Known reliable public relay
  'wss://groups.0xchat.com', 
  // ...defaultRelays // Temporarily comment out other defaults to isolate
];

// Create a single NDK instance
export const ndk = new NDK({
  explicitRelayUrls: explicitRelays,
  // Add other NDK options if needed, e.g., debug:
  // debug: import.meta.env.DEV,
});

// Function to attach the appropriate signer
const attachSigner = async () => {
  try {
    // Check if window object exists (for browser environment)
    if (typeof window !== 'undefined') {
      // --- Priority 1: Check for stored private key --- 
      const storedPrivKey = window.localStorage.getItem('runstr_privkey');
      if (storedPrivKey) {
        console.log('NostrContext: Found private key in localStorage. Using NDKPrivateKeySigner.');
        try {
          ndk.signer = new NDKPrivateKeySigner(storedPrivKey);
          const user = await ndk.signer.user(); // This implicitly waits for the signer to be ready
          console.log('NostrContext: Private key signer attached, user pubkey:', user.pubkey);
          return user.pubkey;
        } catch (pkError) {
            console.error('NostrContext: Error initializing NDKPrivateKeySigner:', pkError);
            // Clear potentially invalid key and fall through to NIP-07
            window.localStorage.removeItem('runstr_privkey'); 
            ndk.signer = undefined;
        }
      }
      
      // --- Priority 2: Check for NIP-07 (window.nostr) --- 
      if (window.nostr) {
        console.log('NostrContext: No private key found. Using NIP-07 signer (window.nostr).');
        const nip07signer = new NDKNip07Signer();
        ndk.signer = nip07signer;
        
        try {
          // NDKNip07Signer might need a user interaction confirmation
          // blockUntilReady handles this.
          console.log('NostrContext: Waiting for NIP-07 signer to be ready (may require user interaction)...');
          await ndk.signer.blockUntilReady(); 
          console.log('NostrContext: NIP-07 signer is ready.');
          
          console.log('NostrContext: Attempting to get user from NIP-07 signer...');
          const user = await nip07signer.user(); // Fetch user AFTER ensuring readiness
          console.log('NostrContext: NIP-07 Signer attached, user pubkey:', user.pubkey);
          return user.pubkey;
          
        } catch (nip07Error) {
            // Catch errors specifically from blockUntilReady() or nip07signer.user()
            console.error('NostrContext: Error during NIP-07 signer interaction (blockUntilReady/user):', nip07Error);
            // Check if the error message indicates user rejection
            if (nip07Error.message && (nip07Error.message.toLowerCase().includes('rejected') || nip07Error.message.toLowerCase().includes('cancelled'))) {
                console.warn('NostrContext: NIP-07 operation rejected by user.');
            } else {
                // Log potentially more details if available, like from the extension
                console.error('NostrContext: Potentially an issue with the NIP-07 extension or its communication.', nip07Error);
            }
            ndk.signer = undefined; // Clear potentially problematic signer
            // Fall through to the final return null
        }
      } 
    }
    
    // --- Fallback: No signer available --- 
    console.log('NostrContext: No browser signer available (localStorage key or NIP-07). Signer will be undefined.');
    ndk.signer = undefined; // Ensure no stale signer
    return null;

  } catch (error) {
    // This catch handles errors during the signer attachment process (e.g., user rejection in NIP-07, invalid key)
    console.error('NostrContext: Error attaching signer (could be user rejection or extension issue):', error);
    ndk.signer = undefined; // Clear signer on error
    return null; // Indicate failure to get pubkey
  }
};

// Function to initialize NDK connection
let ndkConnectionPromise = null;

export const initNdk = async () => {
  if (!ndkConnectionPromise) {
    ndkConnectionPromise = (async () => {
      console.log('NostrContext: initNdk() called (SIMPLIFIED DEBUG VERSION).');
      // Listener variables for cleanup - REMOVED
      // let connectDebugListener, disconnectDebugListener, errorDebugListener, noticeDebugListener;
      try {
        console.log('NostrContext: Bypassing ndk.connect() and awaitConnection() for debugging.');
        // REMOVED ndk.connect() and awaitConnection() logic
        
        console.log('NostrContext: Attaching signer...');
        const pubkey = await attachSigner();
        console.log(`NostrContext: attachSigner finished. Pubkey: ${pubkey}`); // Log after attachSigner returns
        
        // REMOVED relay connection checks
        
        // Determine readiness based ONLY on successful signer attachment in this debug version
        const isReady = true; // Assume ready after signer attempt
        console.log(`NostrContext: NDK initialization sequence COMPLETE (Simplified). Determined ready=${isReady}. Pubkey=${pubkey}`);
        return { ready: isReady, pubkey };

      } catch (error) {
        console.error('NostrContext: NDK connection/signer error inside initNdk (Simplified):', error);
        return { ready: false, pubkey: null, error: error.message || 'Unknown NDK init error' };
      } finally {
        // REMOVED listener cleanup
        console.log('NostrContext: initNdk() promise execution finished (Simplified - finally block).');
      }
    })();
  }
  return ndkConnectionPromise;
};

// Create context with a default value structure
export const NostrContext = createContext({
  publicKey: null,
  setPublicKey: () => console.warn('NostrContext not yet initialized'),
  ndkReady: false, // New: true when NDK init sequence is complete
  relayCount: 0, // New: number of currently connected relays
  ndkError: null,
  ndk: ndk,
});

export const NostrProvider = ({ children }) => {
  const [publicKey, setPublicKey] = useState(null);
  const [ndkReady, setNdkReady] = useState(false); // Renamed from isInitialized
  const [currentRelayCount, setCurrentRelayCount] = useState(0);
  const [ndkError, setNdkError] = useState(null);

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START <<<'); 
    let isMounted = true; // Flag to prevent state updates if unmounted

    const initializeAndSetState = async () => {
      console.log('>>> NostrProvider: Calling initNdk directly <<<');
      let result = null;
      try {
        result = await initNdk(); // Call initNdk directly
        console.log('>>> NostrProvider: initNdk direct call finished. Result:', JSON.stringify(result));

        if (!isMounted) {
          console.log('>>> NostrProvider: Unmounted before state update. Aborting.');
          return; 
        }

        const finalPubkey = result?.pubkey || null;
        const finalIsReady = result?.ready || false;
        const finalError = result?.error || (finalIsReady ? null : 'NDK initialization failed.'); 
        const currentConnectedCount = ndk.pool.stats().connected;

        // Resolve the promise 
        if (ndkReadyResolver) {
            console.log(`[NostrContext] Resolving ndkReadyPromise as ${finalIsReady}.`);
            ndkReadyResolver(finalIsReady);
            ndkReadyResolver = null; 
        }

        // Set state
        if (finalIsReady) {
          console.log(`NostrProvider: Setting state: ndkReady=true, pubkey=${finalPubkey}. Current relay count: ${currentConnectedCount}`);
          setNdkReady(true);
          setPublicKey(finalPubkey);
          setNdkError(null); 
          setCurrentRelayCount(currentConnectedCount); 
        } else {
          console.error(`NostrProvider: Setting state: ndkReady=false, error=${finalError}. Current relay count: ${currentConnectedCount}`);
          setNdkReady(false);
          setPublicKey(null);
          setNdkError(finalError);
          setCurrentRelayCount(currentConnectedCount);
        }

      } catch (err) {
        console.error("NostrProvider: CRITICAL Error during direct initNdk call:", err); 
         if (!isMounted) return; 

        // Resolve promise as false on critical error
        if (ndkReadyResolver) {
            console.log('[NostrContext] Resolving ndkReadyPromise as FALSE (critical error).');
            ndkReadyResolver(false);
            ndkReadyResolver = null; 
        }
        
        setNdkReady(false);
        setPublicKey(null);
        setNdkError(err.message || 'Critical error during Nostr setup execution.');
        setCurrentRelayCount(0);
      }
    };

    initializeAndSetState();

    // Listener for relay pool count changes
    const updateRelayCount = () => {
        const count = ndk.pool.stats().connected;
        // console.log('NostrProvider: Relay count updated:', count); // Can be noisy
        setCurrentRelayCount(count);
    };
    ndk.pool.on('relay:connect', updateRelayCount);
    ndk.pool.on('relay:disconnect', updateRelayCount);
    
    // Cleanup function
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted = false; // Set flag on unmount
      ndk.pool.off('relay:connect', updateRelayCount);
      ndk.pool.off('relay:disconnect', updateRelayCount);
    };

  }, []); // Empty dependency array ensures this runs only once on mount

  // Re-check signer if publicKey changes externally (less common)
  useEffect(() => {
    if (ndkReady && ndk.signer && publicKey) {
      ndk.signer.user().then(user => {
        if (user.pubkey !== publicKey) {
          console.warn('NostrContext: Signer pubkey mismatch detected, updating context...');
          setPublicKey(user.pubkey);
        }
      }).catch(err => {
          console.error("NostrContext: Error getting user from signer", err);
      });
    }
  }, [publicKey, ndkReady]);

  const value = useMemo(() => ({
    publicKey,
    setPublicKey, 
    ndkReady,
    relayCount: currentRelayCount,
    ndkError,
    ndk,
  }), [publicKey, ndkReady, currentRelayCount, ndkError]);

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
