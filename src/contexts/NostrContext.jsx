import { createContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
// Import the NDK singleton
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton'; // Corrected import without alias
import { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'; // Keep NDKSigner types

// Function to attach the appropriate signer TO THE SINGLETON NDK
const attachSigner = async () => {
  try {
    // Check if window object exists (for browser environment)
    if (typeof window !== 'undefined') {
      // --- Priority 1: Check for stored private key ---
      const storedPrivKey = window.localStorage.getItem('runstr_privkey');
      if (storedPrivKey) {
        console.log('NostrContext: Found private key in localStorage. Using NDKPrivateKeySigner.');
        try {
          // Use the singleton ndk instance
          ndk.signer = new NDKPrivateKeySigner(storedPrivKey);
          const user = await ndk.signer.user();
          console.log('NostrContext: Private key signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;
        } catch (pkError) {
            console.error('NostrContext: Error initializing NDKPrivateKeySigner:', pkError);
            window.localStorage.removeItem('runstr_privkey');
            ndk.signer = undefined;
        }
      }

      // --- Priority 2: Check for NIP-07 (window.nostr) ---
      if (window.nostr) {
        console.log('NostrContext: No private key found. Using NIP-07 signer (window.nostr).');
        const nip07signer = new NDKNip07Signer();
        // Use the singleton ndk instance
        ndk.signer = nip07signer;

        try {
          console.log('NostrContext: Waiting for NIP-07 signer to be ready (may require user interaction)...');
          await ndk.signer.blockUntilReady();
          console.log('NostrContext: NIP-07 signer is ready.');

          console.log('NostrContext: Attempting to get user from NIP-07 signer...');
          const user = await nip07signer.user();
          console.log('NostrContext: NIP-07 Signer attached to singleton NDK, user pubkey:', user.pubkey);
          return user.pubkey;

        } catch (nip07Error) {
            console.error('NostrContext: Error during NIP-07 signer interaction (blockUntilReady/user):', nip07Error);
            if (nip07Error.message && (nip07Error.message.toLowerCase().includes('rejected') || nip07Error.message.toLowerCase().includes('cancelled'))) {
                console.warn('NostrContext: NIP-07 operation rejected by user.');
            } else {
                console.error('NostrContext: Potentially an issue with the NIP-07 extension or its communication.', nip07Error);
            }
            ndk.signer = undefined;
        }
      }
    }

    console.log('NostrContext: No browser signer available (localStorage key or NIP-07). Signer will be undefined for singleton NDK.');
    ndk.signer = undefined;
    return null;

  } catch (error) {
    console.error('NostrContext: Error attaching signer to singleton NDK (could be user rejection or extension issue):', error);
    ndk.signer = undefined;
    return null;
  }
};

// SIMPLIFIED Function to initialize NDK connection and signer attachment
// This function is now primarily responsible for signer attachment
// NDK connection readiness is handled by the singleton's ndkReadyPromise
let signerAttachmentPromise = null;

export const ensureSignerAttached = async () => {
  if (!signerAttachmentPromise) {
    signerAttachmentPromise = (async () => {
      console.log('NostrContext: ensureSignerAttached() called.');
      try {
        // NDK connection readiness is awaited separately by the provider
        console.log('NostrContext: Attaching signer to singleton NDK...');
        const pubkey = await attachSigner(); // attachSigner now operates on the singleton ndk
        console.log(`NostrContext: attachSigner finished. Pubkey: ${pubkey}`);
        
        // Return only pubkey and potential error related to signer attachment
        return { pubkey, error: null };

      } catch (error) {
        console.error('NostrContext: Signer attachment error inside ensureSignerAttached():', error);
        return { pubkey: null, error: error.message || 'Unknown signer attachment error' };
      } finally {
        console.log('NostrContext: ensureSignerAttached() promise execution finished.');
      }
    })();
  }
  return signerAttachmentPromise;
};


// Create context with a default value structure
export const NostrContext = createContext({
  publicKey: null,
  lightningAddress: null,
  setPublicKey: () => console.warn('NostrContext not yet initialized'),
  ndkReady: false,
  isInitialized: false,
  relayCount: 0,
  ndkError: null,
  ndk: ndk, // Provide the singleton NDK instance
});

export const NostrProvider = ({ children }) => {
  const [publicKey, setPublicKey] = useState(null);
  const [ndkReady, setNdkReady] = useState(false);
  const [currentRelayCount, setCurrentRelayCount] = useState(0);
  const [ndkError, setNdkError] = useState(null);
  // Lightning address cached from Nostr metadata (lud16/lud06)
  const [lightningAddress, setLightningAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('runstr_lightning_addr') || null;
    }
    return null;
  });

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START (using NDK Singleton) <<<');
    let isMounted = true;

    const initializeNostrSystem = async () => {
      console.log('>>> NostrProvider: Awaiting ndkReadyPromise <<<');
      let globalNdkIsReady = false;
      try {
        globalNdkIsReady = await ndkReadyPromise; // Await the singleton's promise
      } catch (err) {
        // This catch is unlikely if the promise always resolves, but good for safety
        console.error("NostrProvider: Error awaiting ndkReadyPromise:", err);
        if (isMounted) {
            setNdkReady(false);
            setPublicKey(null);
            setNdkError(err.message || 'Error awaiting NDK singleton readiness.');
            setCurrentRelayCount(0); // Or try to get from ndk.pool.stats() if ndk is defined
        }
        return;
      }
      
      if (!isMounted) {
        console.log('>>> NostrProvider: Unmounted after NDK readiness check. Aborting signer attachment.');
        return;
      }

      if (globalNdkIsReady) {
        console.log('>>> NostrProvider: NDK Singleton is ready. Proceeding to attach signer. <<<');
        if (isMounted) setNdkReady(true); // NDK (connections) are ready

        let signerResult = null;
        try {
          signerResult = await ensureSignerAttached(); // Attach signer
          console.log('>>> NostrProvider: ensureSignerAttached finished. Result:', JSON.stringify(signerResult));

          if (!isMounted) {
            console.log('>>> NostrProvider: Unmounted before processing signer result. Aborting.');
            return;
          }

          const finalPubkey = signerResult?.pubkey || null;
          const signerError = signerResult?.error || null;
          
          // Attempt to get relay count even if signer fails, NDK might be connected.
          const currentConnectedCount = ndk.pool?.stats()?.connected ?? 0;


          if (finalPubkey) {
            console.log(`NostrProvider: Signer attached. Setting state: pubkey=${finalPubkey}. Relay count: ${currentConnectedCount}`);
            if (isMounted) {
                setPublicKey(finalPubkey);
                setNdkError(null); // Clear previous NDK errors if signer is ok
                // Fetch lightning address from kind 0 metadata
                try {
                  const user = ndk.getUser({ pubkey: finalPubkey });
                  await user.fetchProfile();
                  const profile = user.profile || {};
                  const laddr = profile.lud16 || profile.lud06 || null;
                  if (laddr && isMounted) {
                    setLightningAddress(laddr);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('runstr_lightning_addr', laddr);
                    }
                  }
                } catch (laErr) {
                  console.warn('NostrProvider: Unable to load lightning address from profile:', laErr);
                }
            }
          } else {
            console.error(`NostrProvider: Failed to attach signer or no signer available. Error: ${signerError}. Relay count: ${currentConnectedCount}`);
            if (isMounted) {
                setPublicKey(null);
                // Preserve NDK readiness (true), but set a signer-specific error if one occurred
                setNdkError(signerError || 'No signer attached.');
            }
          }
          if (isMounted) setCurrentRelayCount(currentConnectedCount);

        } catch (err) {
          console.error("NostrProvider: CRITICAL Error during ensureSignerAttached call:", err);
          if (isMounted) {
            setPublicKey(null);
            // NDK itself is ready, but signer attachment had a critical failure
            setNdkError(err.message || 'Critical error during signer attachment.');
            setCurrentRelayCount(ndk.pool?.stats()?.connected ?? 0);
          }
        }
      } else {
        console.error('>>> NostrProvider: NDK Singleton failed to become ready. <<<');
        if (isMounted) {
          setNdkReady(false);
          setPublicKey(null);
          setNdkError('NDK Singleton failed to initialize or connect to relays.');
          setCurrentRelayCount(0);
        }
      }
    };

    initializeNostrSystem();

    // Listener for relay pool count changes from the singleton NDK
    const updateRelayCount = () => {
        const count = ndk.pool?.stats()?.connected ?? 0;
        if (isMounted) {
            // console.log('NostrProvider: Relay count updated from singleton NDK pool:', count); // Can be noisy
            setCurrentRelayCount(count);
        }
    };
    // Ensure ndk.pool exists before attaching listeners
    if (ndk && ndk.pool) {
        ndk.pool.on('relay:connect', updateRelayCount);
        ndk.pool.on('relay:disconnect', updateRelayCount);
    }
    
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted = false;
      if (ndk && ndk.pool) {
          ndk.pool.off('relay:connect', updateRelayCount);
          ndk.pool.off('relay:disconnect', updateRelayCount);
      }
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

  // Periodically re-attempt signer attachment if no pubkey yet
  useEffect(() => {
    if (publicKey) return; // already have pubkey
    let intervalId = setInterval(async () => {
      if (publicKey) { clearInterval(intervalId); return; }
      if (ndk.signer) {
        try {
          const user = await ndk.signer.user();
          if (user?.pubkey) {
            setPublicKey(user.pubkey);
            clearInterval(intervalId);
          }
        } catch(_err) { void _err; }
      } else if (window?.nostr) {
        // Try attaching again
        try {
          const result = await ensureSignerAttached();
          if (result?.pubkey) {
            setPublicKey(result.pubkey);
            clearInterval(intervalId);
          }
        } catch(_err) { void _err; }
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [publicKey]);

  const value = useMemo(() => ({
    publicKey,
    lightningAddress,
    setPublicKey, 
    ndkReady,
    isInitialized: ndkReady,
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
