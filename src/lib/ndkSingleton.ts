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
      console.log('[NDK Singleton] Connecting to NDK relays...');
      await g.__RUNSTR_NDK_INSTANCE__.connect(); // Default timeout is 2 seconds per relay
      console.log('[NDK Singleton] NDK connected. Awaiting at least 1 relay connection (timeout 8s)...');
      // Wait for at least one relay to connect, with an 8-second timeout
      if (typeof g.__RUNSTR_NDK_INSTANCE__.awaitConnection === 'function') {
        await (g.__RUNSTR_NDK_INSTANCE__ as any).awaitConnection(1, 8000);
      } else {
        // Fallback polling: check pool stats every 500ms up to timeout
        const start = Date.now();
        while (Date.now() - start < 8000) {
          if (g.__RUNSTR_NDK_INSTANCE__.pool?.stats()?.connected > 0) break;
          await new Promise(res => setTimeout(res, 500));
        }
        if (g.__RUNSTR_NDK_INSTANCE__.pool?.stats()?.connected === 0) {
          throw new Error('No relays connected within timeout');
        }
      }
      console.log('[NDK Singleton] NDK is ready (at least 1 relay connected).');
      return true; // Resolve promise with true indicating readiness
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