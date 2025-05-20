import { Relay, nip19 } from 'nostr-tools';

// A list of relays to try. In a real app, this might be user-configurable
// or a more robust, dynamically updated list.
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
];

function isValidHexPubkey(pubkey: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(pubkey);
}

/**
 * Fetches the Lightning Address (lud16) or LNURL (lud06) from a user's Nostr profile (Kind 0).
 * @param pubkeyHexOrNpub The user's public key in hex or npub format.
 * @param relaysToTry An optional array of relay URLs.
 * @returns The lud16 or lud06 string if found, otherwise null.
 */
export async function fetchLnAddressFromProfile(
  pubkeyHexOrNpub: string,
  relaysToTry: string[] = DEFAULT_RELAYS
): Promise<string | null> {
  let pubkeyHex = pubkeyHexOrNpub;

  if (!isValidHexPubkey(pubkeyHexOrNpub)) {
    try {
      const decoded = nip19.decode(pubkeyHexOrNpub);
      if (decoded.type === 'npub') {
        pubkeyHex = decoded.data as string;
      } else {
        // console.error('[LN Resolver] Input is not a valid hex pubkey or npub:', pubkeyHexOrNpub);
        return null;
      }
    } catch (e) {
      // console.error('[LN Resolver] Error decoding pubkey/npub:', pubkeyHexOrNpub, e);
      return null;
    }
  }

  if (!isValidHexPubkey(pubkeyHex)) {
    // console.error('[LN Resolver] Decoded pubkey is not valid hex:', pubkeyHex);
    return null;
  }

  let latestKind0Event: any = null;

  // Try fetching from multiple relays and use the latest event found.
  const promises = relaysToTry.map(async (relayUrl) => {
    let relay: Relay | null = null;
    try {
      relay = new Relay(relayUrl);
      await relay.connect();

      return new Promise((resolveEvent, rejectEvent) => {
        let eventReceived = false;
        const sub = relay!.subscribe([
          {
            authors: [pubkeyHex],
            kinds: [0],
            limit: 1,
          },
        ]);

        const timeout = setTimeout(() => {
          sub.close();
          if (relay) relay.close();
          if (!eventReceived) {
            // console.debug(`[LN Resolver] Timeout fetching profile from ${relayUrl}`);
            rejectEvent(new Error(`Timeout fetching profile from ${relayUrl}`));
          }
        }, 3000); // 3-second timeout per relay

        sub.on('event', (event) => {
          eventReceived = true;
          clearTimeout(timeout);
          sub.close();
          if (relay) relay.close();
          resolveEvent(event);
        });
        sub.on('error', (errMsg: string) => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            // console.warn(`[LN Resolver] Subscription error from ${relayUrl}: ${errMsg}`);
            rejectEvent(new Error(`Relay subscription error from ${relayUrl}: ${errMsg}`));
        });
         // EOSE might not always fire if limit:1 is hit first and sub is closed.
         sub.on('eose', () => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            if (!eventReceived) {
                // console.debug(`[LN Resolver] EOSE from ${relayUrl}, no event found.`);
                resolveEvent(null); // Resolve with null if no event found before EOSE
            }
        });
      });
    } catch (error) {
      // console.warn(`[LN Resolver] Could not connect or fetch from ${relayUrl}:`, error);
      if (relay) relay.close();
      return null; // Return null if this relay fails
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      const event = result.value as any;
      if (!latestKind0Event || event.created_at > latestKind0Event.created_at) {
        latestKind0Event = event;
      }
    }
  });

  if (!latestKind0Event) {
    // console.warn(`[LN Resolver] No Kind 0 profile event found for pubkey ${pubkeyHex} after trying all relays.`);
    return null;
  }

  try {
    const profileContent = JSON.parse(latestKind0Event.content);
    if (profileContent.lud16 && typeof profileContent.lud16 === 'string' && profileContent.lud16.trim() !== '') {
      return profileContent.lud16.trim(); // Preferred: Lightning Address
    }
    if (profileContent.lud06 && typeof profileContent.lud06 === 'string' && profileContent.lud06.trim() !== '') {
      return profileContent.lud06.trim(); // Fallback: LNURL-pay
    }
    // console.warn(`[LN Resolver] No lud16 or lud06 found in profile for ${pubkeyHex}`);
    return null;
  } catch (e) {
    // console.error(`[LN Resolver] Error parsing Kind 0 content for ${pubkeyHex}:`, e);
    return null;
  }
} 