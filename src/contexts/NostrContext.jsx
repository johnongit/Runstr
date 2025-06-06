import { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
// Import the NDK singleton
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton'; // Consistent import without extension
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
            }
            // If blockUntilReady or user fetch fails, the signer isn't fully usable with the NDK instance.
            ndk.signer = undefined; // Clear the signer on the NDK singleton.
            return null; // Indicate failure to get a usable pubkey AND signer.
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
  signerAvailable: false,
  isInitialized: false,
  relayCount: 0,
  ndkError: null,
  ndk: ndk, // Provide the singleton NDK instance
  connectSigner: () => Promise.resolve({ pubkey: null, error: 'Connect signer not implemented via context directly' }), // Placeholder
});

export const NostrProvider = ({ children }) => {
  const [publicKey, setPublicKeyInternal] = useState(null);
  const [ndkReady, setNdkReady] = useState(false);
  const [signerAvailable, setSignerAvailable] = useState(false);
  const [currentRelayCount, setCurrentRelayCount] = useState(0);
  const [ndkError, setNdkError] = useState(null);
  // Lightning address cached from Nostr metadata (lud16/lud06)
  const [lightningAddress, setLightningAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('runstr_lightning_addr') || null;
    }
    return null;
  });

  // Callback to update relay count and NDK readiness
  const updateNdkStatus = useCallback(() => {
    const connectedRelays = ndk.pool?.stats()?.connected ?? 0;
    setCurrentRelayCount(connectedRelays);
    setNdkReady(connectedRelays > 0);
    if (connectedRelays === 0 && !ndkError) {
      // If we were previously connected and now have 0 relays, set an error or warning
      // This avoids overwriting a more specific initialization error from ndkReadyPromise
      // setNdkError("Disconnected from all relays."); // Potentially too aggressive
    }
  }, [ndkError]); // Add ndkError to prevent stale closure issues

  useEffect(() => {
    console.log('>>> NostrProvider useEffect START (using NDK Singleton) <<<');
    let isMounted = true;

    const initializeNostrSystem = async () => {
      console.log('>>> NostrProvider: Awaiting ndkReadyPromise (initial connection attempt) <<<');
      let initialNdkConnectionSuccess = false;
      try {
        console.log('[NostrProvider] About to await ndkReadyPromise from ndkSingleton.');
        initialNdkConnectionSuccess = await ndkReadyPromise;
        console.log(`[NostrProvider] ndkReadyPromise resolved. Success: ${initialNdkConnectionSuccess}`);
      } catch (err) {
        console.error("NostrProvider: Error awaiting ndkReadyPromise:", err);
        if (isMounted) {
          console.log(`[NostrProvider] Setting ndkError due to ndkReadyPromise rejection: ${err.message || 'Error awaiting NDK singleton readiness.'}`);
          setNdkError(err.message || 'Error awaiting NDK singleton readiness.');
        }
        // updateNdkStatus will set ndkReady based on current pool count (likely 0)
      }

      if (isMounted) {
        console.log('[NostrProvider] Calling updateNdkStatus after ndkReadyPromise.');
        updateNdkStatus(); // Set initial ndkReady/relayCount based on promise outcome & pool state

        if (initialNdkConnectionSuccess) {
          console.log('>>> NostrProvider: Initial NDK connection reported success. Proceeding to attach signer. <<<');
          console.log('[NostrProvider] Setting ndkError to null because initialNdkConnectionSuccess is true.');
          setNdkError(null); // Clear any previous generic NDK errors if initial connect was ok
        } else if (!ndkError) { // Only set error if a more specific one isn't already there
          console.log('[NostrProvider] initialNdkConnectionSuccess is false and ndkError is not set. Setting NDK error.');
          setNdkError('NDK Singleton failed to initialize or connect to relays initially.');
        }
        
        // Attempt to attach signer regardless of initial connection, as signer might be local
        ensureSignerAttached().then(signerResult => {
          if (!isMounted) return;
          const finalPubkey = signerResult?.pubkey || null;
          const signerError = signerResult?.error || null;
          if (finalPubkey) {
            setPublicKeyInternal(finalPubkey);
            if (!initialNdkConnectionSuccess && !signerError) {
              // If NDK wasn't ready but signer IS, clear NDK error if it was generic
              // setNdkError(null); // This might be too optimistic if relays are still down
            } else if (signerError) {
                setNdkError(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
            }
            // Fetch lightning address
            try {
              const user = ndk.getUser({ pubkey: finalPubkey });
              user.fetchProfile().then(() => {
                if (!isMounted) return;
                const profile = user.profile || {};
                const laddr = profile.lud16 || profile.lud06 || null;
                if (laddr) {
                  setLightningAddress(laddr);
                  if (typeof window !== 'undefined') window.localStorage.setItem('runstr_lightning_addr', laddr);
                }
              }).catch(laErr => console.warn('NostrProvider: Error fetching profile for LUD:', laErr));
            } catch (laErr) {
              console.warn('NostrProvider: Error constructing user for LUD fetch:', laErr);
            }
          } else if (signerError) {
            setNdkError(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
          }

          // *** After any signer attachment attempt, update the signerAvailable state ***
          setSignerAvailable(!!ndk.signer);

        }).catch(err => {
            if(isMounted) {
              setNdkError(prevError => prevError ? `${prevError} Signer Attach Exception: ${err.message}` : `Signer Attach Exception: ${err.message}`);
              setSignerAvailable(false); // Ensure signer is marked as unavailable on error
            }
        });
      }
    };

    initializeNostrSystem();

    // Listeners for relay pool changes to dynamically update status
    if (ndk && ndk.pool) {
      ndk.pool.on('relay:connect', updateNdkStatus);
      ndk.pool.on('relay:disconnect', updateNdkStatus);
    }
    
    return () => {
      console.log('NostrProvider: Unmounting...');
      isMounted = false;
      if (ndk && ndk.pool) {
        ndk.pool.off('relay:connect', updateNdkStatus);
        ndk.pool.off('relay:disconnect', updateNdkStatus);
      }
      signerAttachmentPromise = null; // Reset signer promise on unmount
    };

  }, [updateNdkStatus, ndkError]); // Added ndkError

  // Function to allow components to trigger signer connection/re-check
  const connectSigner = useCallback(async () => {
    console.log("NostrContext: connectSigner called by component.");
    signerAttachmentPromise = null; // Reset to allow re-attempt
    const signerResult = await ensureSignerAttached();
    const finalPubkey = signerResult?.pubkey || null;
    const signerError = signerResult?.error || null;
    if (finalPubkey) {
        setPublicKeyInternal(finalPubkey);
        setNdkError(prev => prev && prev.includes("Signer:") ? null : prev); // Clear signer part of error if successful
    } else if (signerError) {
        setNdkError(prevError => prevError ? `${prevError} Signer: ${signerError}` : `Signer: ${signerError}`);
    }
    // After connection attempt, update the signer state
    setSignerAvailable(!!ndk.signer);
    return signerResult;
  }, []);

  const setPublicKey = useCallback((pk) => {
    // This function is primarily for logout or manual key changes, not initial connection.
    setPublicKeyInternal(pk);
    if (!pk && typeof window !== 'undefined') {
        window.localStorage.removeItem('runstr_privkey');
        window.localStorage.removeItem('runstr_lightning_addr');
        ndk.signer = undefined; // Clear signer on explicit logout
        signerAttachmentPromise = null; // Allow re-attachment
        setLightningAddress(null);
        setSignerAvailable(false); // Update signer state on logout
    }
  }, []);

  const value = useMemo(() => ({
    publicKey,
    lightningAddress,
    setPublicKey,
    ndkReady, // Dynamically updated based on relay connections
    signerAvailable, // Pass the new state through the context
    isInitialized: ndkReady, // Maintained for compatibility, reflects current ndkReady
    relayCount: currentRelayCount,
    ndkError,
    ndk, // The singleton NDK instance
    connectSigner,
  }), [publicKey, lightningAddress, setPublicKey, ndkReady, signerAvailable, currentRelayCount, ndkError, connectSigner]);

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
