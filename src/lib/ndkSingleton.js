// Lightweight JS fallback so Node diagnostics can run without TS loader.
import NDK from '@nostr-dev-kit/ndk';
import { relays } from '../config/relays.js';

const ndk = new NDK({ explicitRelayUrls: relays });

const ndkReadyPromise = (async () => {
  try {
    await ndk.connect();
    return true;
  } catch (err) {
    console.warn('[ndkSingleton.js] connect failed', err);
    return false;
  }
})();

export { ndk, ndkReadyPromise };

export const awaitNDKReady = async (timeoutMs = 10000) => {
  return Promise.race([
    ndkReadyPromise,
    new Promise((res) => setTimeout(() => res(false), timeoutMs)),
  ]);
}; 