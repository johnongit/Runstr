const WebSocket = require('ws');
const NDK = require('@nostr-dev-kit/ndk'); // Use require for NDK itself

// --- Configuration: Replace with actual test data ---
const TEST_AUTHOR_PUBKEYS = [
  'e88792729195af1750854041319687058158252510f739565aff1288f1040351', // Replace with actual pubkey 1
  '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'  // Replace with actual pubkey 3 - Example from nostr.band
];
const TEST_GROUP_RELAY_HINTS = [
  'wss://groups.0xchat.com',
];
// --- End Configuration ---

// --- Replicated/Adapted from src/utils/nostr.js ---
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://eden.nostr.land',
  'wss://e.nos.lol',
  'wss://relay.snort.social',
  'wss://relay.0xchat.com',
];
// --- End Replicated/Adapted ---

// Make WebSocket available globally
global.WebSocket = WebSocket;

// --- Replicated/Adapted NDK Initialization Logic (Simplified) ---
// Explicitly define relays for this test script
const explicitRelaysForTest = Array.from(new Set([...TEST_GROUP_RELAY_HINTS, ...DEFAULT_RELAYS]));

const NDKConstructor = NDK.default || NDK.NDK || NDK;

const ndkInstance = new NDKConstructor({
  explicitRelayUrls: explicitRelaysForTest,
  // debug: true, // Uncomment for verbose NDK logs
});

let ndkConnectionPromise = null;
const initializeTestNdk = async () => {
  if (!ndkConnectionPromise) {
    ndkConnectionPromise = (async () => {
      console.log('[TestScript] Initializing NDK instance...');
      try {
        await ndkInstance.connect(5000); // Connect with a timeout (e.g., 5 seconds)
        console.log(`[TestScript] NDK connected to ${ndkInstance.pool.connectedRelays().length} relays.`);
        // In this self-contained script, we consider NDK "ready" after connect resolves.
        // No complex signer logic needed for just fetching public Kind 0 events.
        return { ready: true, pubkey: null }; // No signer pubkey needed for this test
      } catch (error) {
        console.error('[TestScript] NDK connection error:', error);
        return { ready: false, pubkey: null, error: error.message || 'Unknown NDK init error' };
      }
    })();
  }
  return ndkConnectionPromise;
};
// --- End Replicated/Adapted NDK Initialization ---

const parseProfileContent = (contentString) => {
  if (typeof contentString !== 'string') return null;
  try {
    const profileData = JSON.parse(contentString);
    if (typeof profileData !== 'object' || profileData === null) return null;
    return {
      name: profileData.name || profileData.display_name || profileData.displayName,
      picture: profileData.picture,
      about: profileData.about,
      lud16: profileData.lud16,
      nip05: profileData.nip05,
    };
  } catch (error) {
    return null;
  }
};

(async () => {
  console.log('--- Test Script: Chat Profile Fetch (Self-Contained NDK) ---');
  let ndkInitResult;
  let isNdkReadyForTest = false;

  try {
    console.log('1. Initializing NDK for test script...');
    ndkInitResult = await initializeTestNdk();
    console.log('   Test NDK init result:', ndkInitResult);
    isNdkReadyForTest = ndkInitResult?.ready || false;

    if (!isNdkReadyForTest) {
      console.error('>>> NDK did not become ready for test. Aborting.');
      if (ndkInitResult?.error) {
        console.error('>>> NDK Initialization Error:', ndkInitResult.error);
      }
      process.exit(1);
    }
    console.log('   NDK is ready for fetching profiles.');

  } catch (err) {
    console.error('>>> Critical error during NDK initialization for test:', err);
    process.exit(1);
  }

  const filter = {
    kinds: [0],
    authors: TEST_AUTHOR_PUBKEYS,
    limit: TEST_AUTHOR_PUBKEYS.length,
  };
  console.log('\n2. Fetching profiles with filter:', JSON.stringify(filter));
  console.log('   Using relays:', explicitRelaysForTest);

  try {
    // Use the self-contained ndkInstance directly
    const profileEvents = await ndkInstance.fetchEvents(
      filter,
      { // NDKFetchOptions
        closeOnEose: true,
        groupable: false,
        poolWaitMode: 'all',
        timeout: 20000 // Increased timeout to 20 seconds
      }
      // RelaySet is implicitly handled by ndkInstance.explicitRelayUrls in this simplified setup
    );

    console.log(`\n3. Results: Fetched ${profileEvents.size} profile events.`);

    if (profileEvents.size > 0) {
      let foundCount = 0;
      profileEvents.forEach(event => {
        const profile = parseProfileContent(event.content);
        if (profile) {
          foundCount++;
          console.log(`   - Pubkey: ${event.pubkey}`);
          console.log(`     Name: ${profile.name || 'N/A'}`);
          console.log(`     Picture: ${profile.picture || 'N/A'}`);
          console.log(`     NIP-05: ${profile.nip05 || 'N/A'}`);
          console.log('     ---');
        } else {
          console.log(`   - Pubkey: ${event.pubkey} - Failed to parse profile content or content was empty.`);
        }
      });
      console.log(`   Successfully parsed ${foundCount} profiles out of ${profileEvents.size} events.`);
    } else {
      console.log('   No profile events found for the given authors on the specified relays.');
    }

    const notFoundPubkeys = TEST_AUTHOR_PUBKEYS.filter(pk => ![...profileEvents].some(ev => ev.pubkey === pk));
    if (notFoundPubkeys.length > 0) {
      console.log('\n   Pubkeys for which no profile event was returned:');
      notFoundPubkeys.forEach(pk => console.log(`     - ${pk}`));
    }

  } catch (error) {
    console.error('\n>>> Error fetching profile events from NDK:', error);
  }

  console.log('\n--- Script Finished ---');
  try {
    // Attempt to gracefully disconnect from relays
    if (ndkInstance && ndkInstance.pool && ndkInstance.pool.relays) {
      console.log('Disconnecting from relays...');
      Array.from(ndkInstance.pool.relays.values()).forEach(relay => {
        if (relay.status === 1) { // NDKRelayStatus.CONNECTED
          relay.disconnect();
        }
      });
    }
  } catch (e) {
    console.warn('Error during NDK relay disconnect:', e.message);
  }
  process.exit(0);
})(); 