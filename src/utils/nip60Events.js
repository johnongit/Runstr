import { NDKEvent } from '@nostr-dev-kit/ndk';

export const NIP60_KINDS = {
  WALLET_METADATA: 17375,
  MINT_LIST: 10019,
  TOKEN_EVENT: 7376, // For actual token transfers
};

export const SUPPORTED_MINTS = [
  {
    name: "CoinOS",
    url: "https://mint.coinos.io",
    description: "CoinOS community mint"
  },
  {
    name: "Minibits", 
    url: "https://mint.minibits.cash/Bitcoin",
    description: "Minibits mobile wallet mint"
  },
  {
    name: "0xchat",
    url: "https://mint.0xchat.com", 
    description: "0xchat messaging app mint"
  }
];

/**
 * Query for existing NIP-60 wallet events
 */
export const findWalletEvents = async (ndk, userPubkey) => {
  if (!ndk || !userPubkey) return null;

  try {
    console.log('[NIP60Events] Querying for existing wallet events...');
    
    // Query for wallet metadata and mint lists in parallel
    const [walletEvents, mintEvents] = await Promise.all([
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.WALLET_METADATA],
        authors: [userPubkey],
        limit: 5
      }),
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.MINT_LIST],
        authors: [userPubkey], 
        limit: 5
      })
    ]);

    console.log(`[NIP60Events] Found ${walletEvents.size} wallet events, ${mintEvents.size} mint events`);

    // Get most recent events
    const latestWallet = Array.from(walletEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const latestMints = Array.from(mintEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];

    return {
      hasWallet: walletEvents.size > 0,
      walletEvent: latestWallet,
      mintEvent: latestMints,
      walletData: latestWallet ? parseWalletEvent(latestWallet) : null,
      mintData: latestMints ? parseMintEvent(latestMints) : null
    };
  } catch (error) {
    console.error('[NIP60Events] Error finding wallet events:', error);
    return null;
  }
};

/**
 * Create new NIP-60 wallet events
 */
export const createWalletEvents = async (ndk, selectedMintUrl) => {
  if (!ndk || !ndk.signer) {
    throw new Error('NDK signer not available');
  }

  try {
    console.log('[NIP60Events] Creating new wallet events...');
    
    // Create wallet metadata event (kind:17375)
    const walletEvent = new NDKEvent(ndk);
    walletEvent.kind = NIP60_KINDS.WALLET_METADATA;
    walletEvent.content = JSON.stringify({
      name: "RUNSTR Ecash Wallet",
      description: "NIP-60 wallet for RUNSTR app",
      mints: [selectedMintUrl],
      version: "1.0.0",
      created_at: Math.floor(Date.now() / 1000)
    });
    walletEvent.tags = [
      ['name', 'RUNSTR Ecash Wallet'],
      ['mint', selectedMintUrl],
      ['client', 'RUNSTR']
    ];

    // Create mint list event (kind:10019) 
    const mintEvent = new NDKEvent(ndk);
    mintEvent.kind = NIP60_KINDS.MINT_LIST;
    mintEvent.content = JSON.stringify({
      mints: [{ url: selectedMintUrl, units: ['sat'] }]
    });
    mintEvent.tags = [
      ['mint', selectedMintUrl]
    ];

    // Publish both events
    console.log('[NIP60Events] Publishing wallet events...');
    await Promise.all([
      walletEvent.publish(),
      mintEvent.publish()
    ]);

    console.log('[NIP60Events] Wallet events published successfully');
    return { walletEvent, mintEvent };

  } catch (error) {
    console.error('[NIP60Events] Error creating wallet events:', error);
    throw error;
  }
};

/**
 * Query for token events (balance calculation)
 */
export const queryTokenEvents = async (ndk, userPubkey, limit = 100) => {
  if (!ndk || !userPubkey) return [];

  try {
    console.log('[NIP60Events] Querying for token events...');
    
    const tokenEvents = await ndk.fetchEvents({
      kinds: [NIP60_KINDS.TOKEN_EVENT],
      authors: [userPubkey],
      limit
    });

    console.log(`[NIP60Events] Found ${tokenEvents.size} token events`);

    return Array.from(tokenEvents).map(event => ({
      id: event.id,
      created_at: event.created_at,
      content: parseTokenEvent(event),
      rawEvent: event
    }));
  } catch (error) {
    console.error('[NIP60Events] Error querying token events:', error);
    return [];
  }
};

/**
 * Calculate balance from token events
 */
export const calculateBalance = (tokenEvents) => {
  const balance = tokenEvents.reduce((total, event) => {
    try {
      const amount = event.content?.amount || 0;
      const type = event.content?.type || 'receive';
      
      // Add for receives, subtract for sends
      return type === 'send' ? total - amount : total + amount;
    } catch (error) {
      console.warn('[NIP60Events] Invalid token event:', error);
      return total;
    }
  }, 0);

  console.log(`[NIP60Events] Calculated balance: ${balance} sats from ${tokenEvents.length} events`);
  return balance;
};

/**
 * Create a token transfer event
 */
export const createTokenEvent = async (ndk, recipientPubkey, amount, mintUrl, tokenString, memo = '') => {
  if (!ndk || !ndk.signer) {
    throw new Error('NDK signer not available');
  }

  try {
    console.log(`[NIP60Events] Creating token event for ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

    const tokenEvent = new NDKEvent(ndk);
    tokenEvent.kind = NIP60_KINDS.TOKEN_EVENT;
    tokenEvent.content = JSON.stringify({
      mint: mintUrl,
      amount: amount,
      token: tokenString,
      type: "send",
      memo: memo || '',
      timestamp: Math.floor(Date.now() / 1000)
    });
    tokenEvent.tags = [
      ['p', recipientPubkey], // Recipient
      ['mint', mintUrl],
      ['amount', amount.toString()],
      ['type', 'send']
    ];

    await tokenEvent.publish();
    console.log('[NIP60Events] Token event published successfully');

    return tokenEvent;
  } catch (error) {
    console.error('[NIP60Events] Error creating token event:', error);
    throw error;
  }
};

/**
 * Send token via encrypted DM
 */
export const sendTokenViaDM = async (ndk, recipientPubkey, tokenString, memo = '') => {
  if (!ndk || !ndk.signer) {
    throw new Error('NDK signer not available');
  }

  try {
    console.log(`[NIP60Events] Sending token via DM to ${recipientPubkey.substring(0, 8)}...`);

    // Create DM content with token and memo
    const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token: ${tokenString}`;
    
    // Create encrypted DM event (kind 4)
    const dmEvent = new NDKEvent(ndk);
    dmEvent.kind = 4;
    dmEvent.content = dmContent;
    dmEvent.tags = [['p', recipientPubkey]];
    dmEvent.created_at = Math.floor(Date.now() / 1000);

    // Encrypt the content for the recipient
    await dmEvent.encrypt(recipientPubkey);
    
    // Publish the encrypted DM
    await dmEvent.publish();
    
    console.log('[NIP60Events] Token sent via DM successfully');
    return dmEvent;
    
  } catch (error) {
    console.error('[NIP60Events] Failed to send DM:', error);
    throw new Error('Failed to send token via DM: ' + error.message);
  }
};

/**
 * Get mint info from supported mints list
 */
export const getMintInfo = (mintUrl) => {
  return SUPPORTED_MINTS.find(m => m.url === mintUrl) || {
    name: 'Custom Mint',
    url: mintUrl,
    description: 'User-specified mint'
  };
};

/**
 * Helper functions for parsing events
 */
const parseWalletEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse wallet event:', error);
    return null;
  }
};

const parseMintEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse mint event:', error);
    return null;
  }
};

const parseTokenEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse token event:', error);
    return { amount: 0, type: 'unknown' };
  }
};

/**
 * Extract cashu tokens from text content (DMs, etc.)
 */
export const extractCashuToken = (content) => {
  // Look for cashu token patterns in the message
  const tokenMatch = content.match(/cashu[A-Za-z0-9+/=]+/);
  return tokenMatch ? tokenMatch[0] : null;
};

/**
 * Validate mint URL format
 */
export const isValidMintUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch (error) {
    return false;
  }
}; 