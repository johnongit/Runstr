import NDK from '@nostr-dev-kit/ndk';
// Assuming your relay configuration is exported from a dedicated file.
// Adjust the path if your relay config is located elsewhere.
import { relays } from '../config/relays';

// Use globalThis to ensure a single instance even with hot module replacement (HMR)
const g = globalThis as any;

if (!g.__RUNSTR_NDK_INSTANCE__) {
  console.log('[NDK Singleton] Creating new NDK instance...');
  g.__RUNSTR_NDK_INSTANCE__ = new NDK({
    explicitRelayUrls: relays,
    // You can add other NDK options here if needed, e.g., signer, cache, etc.
    // debug: true, // Uncomment for more verbose NDK logging
  });

  g.__RUNSTR_NDK_READY_PROMISE__ = (async () => {
    try {
      const connectTimeoutMs = 15000; // Increased timeout for the connect call itself (e.g., 15 seconds)
      console.log(`[NDK Singleton] Connecting to NDK relays (timeout: ${connectTimeoutMs}ms)...`);
      await g.__RUNSTR_NDK_INSTANCE__.connect(connectTimeoutMs);
      
      const connectedCount = g.__RUNSTR_NDK_INSTANCE__.pool?.stats()?.connected || 0;
      console.log(`[NDK Singleton] NDK connect() call completed. Connected relays: ${connectedCount}`);

      if (connectedCount > 0) {
        console.log('[NDK Singleton] NDK is ready (at least 1 relay connected after connect() call).');
        return true; // Resolve promise with true indicating readiness
      } else {
        // If still 0, try awaitConnection as a brief secondary check, though connect() should have handled it.
        console.log('[NDK Singleton] No relays connected after connect(). Trying awaitConnection (short timeout 3s)... ');
        if (typeof g.__RUNSTR_NDK_INSTANCE__.awaitConnection === 'function') {
          try {
            await (g.__RUNSTR_NDK_INSTANCE__ as any).awaitConnection(1, 3000); // Shorter timeout here
            const finalConnectedCount = g.__RUNSTR_NDK_INSTANCE__.pool?.stats()?.connected || 0;
            if (finalConnectedCount > 0) {
              console.log(`[NDK Singleton] NDK is ready after awaitConnection. Connected: ${finalConnectedCount}`);
              return true;
            }
          } catch (awaitConnError) {
            console.warn('[NDK Singleton] awaitConnection also failed or timed out:', awaitConnError);
          }
        }
        throw new Error('No relays connected after connect() and awaitConnection() attempts.');
      }
    } catch (err) {
      console.error('[NDK Singleton] Failed to initialize NDK or connect to relays:', err);
      return false; // Resolve promise with false indicating failure
    }
  })();
} else {
  console.log('[NDK Singleton] Reusing existing NDK instance.');
}

export const ndk: NDK = g.__RUNSTR_NDK_INSTANCE__;
export const ndkReadyPromise: Promise<boolean> = g.__RUNSTR_NDK_READY_PROMISE__;

export const awaitNDKReady = async (timeoutMs: number = 10000): Promise<boolean> => {
  try {
    const ready = await Promise.race([
      ndkReadyPromise,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (!ready) {
      throw new Error('NDK failed to become ready within timeout');
    }
    return true;
  } catch (err) {
    console.error('[NDK Singleton] awaitNDKReady error:', err);
    return false;
  }
}; 