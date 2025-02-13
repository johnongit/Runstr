import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.bg'
];

// Export loggedInUser as a let variable
export let loggedInUser = null;

// Initialize NDK instance
export const ndk = isBrowser ? new NDK({
  explicitRelayUrls: RELAYS,
  enableOutboxModel: true
}) : null;

// Initialize NDK connection with retry mechanism
export const initializeNostr = async () => {
  if (!ndk) return false;
  
  console.log('Initializing NDK connection...');
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to connect (attempt ${retryCount + 1}/${maxRetries})...`);
      await ndk.connect();
      
      // Wait a bit to ensure connections are established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we have any connected relays
      if (ndk.pool?.relays?.size > 0) {
        console.log(`Successfully connected to ${ndk.pool.relays.size} relays`);
        return true;
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        const backoffTime = 1000 * Math.pow(2, retryCount);
        console.log(`No relays connected. Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } catch (err) {
      console.error('Error during connection attempt:', err);
      retryCount++;
      if (retryCount < maxRetries) {
        const backoffTime = 1000 * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }
  
  console.error('Failed to connect after multiple attempts');
  return false;
};

// Initialize connection when the module loads
if (ndk) {
  initializeNostr().catch(err => {
    console.error('Failed to initialize NDK:', err);
  });
}


export const publishToNostr = async (event) => {
  if (!isBrowser) {
    console.error('Not in browser environment');
    return null;
  }
  
  if (!event) {
    console.error('No event provided');
    return null;
  }
  
  if (!ndk) {
    console.error('NDK not initialized');
    return null;
  }
  
  try {
    if (!window.nostr) {
      console.error('Nostr provider not found. Please ensure you are logged in.');
      throw new Error('Nostr provider not found');
    }

    // Check current connection state
    if (!ndk.pool?.relays?.size) {
      console.log('No active connections found, attempting to reconnect...');
      const isConnected = await initializeNostr();
      if (!isConnected) {
        throw new Error('Could not establish relay connections. Please check your internet connection and try again.');
      }
    } else {
      console.log(`Using existing connections to ${ndk.pool.relays.size} relays`);
    }

    console.log('Publishing event:', event);
    const signedEvent = await window.nostr.signEvent(event);
    console.log('Event signed:', signedEvent);

    // Create NDK event
    const ndkEvent = new NDKEvent(ndk, signedEvent);
    
    // Publish with timeout
    const published = await Promise.race([
      ndkEvent.publish(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Publication timeout')), 15000))
    ]);
    
    console.log('Publication successful:', published);
    return published;
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
    throw error;
  }
};

