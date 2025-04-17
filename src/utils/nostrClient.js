import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { decode as decodeNip19 } from 'nostr-tools/nip19';
import { parseNaddr as parseNaddrInternal } from './nostrClient'; // Alias if needed

// Create a simple pool with reasonable timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

// Focus on a smaller set of the most reliable relays
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://relay.0xchat.com'  // NIP-29 group support
];

// Storage for keys
let cachedKeyPair = null;

/**
 * Initialize the Nostr client
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Check if the environment supports WebSockets
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not supported in this environment');
      return false;
    }
    
    // Test connection to relays
    const connectedRelays = [];
    
    for (const relay of relays) {
      try {
        const conn = pool.ensureRelay(relay);
        if (conn) {
          connectedRelays.push(relay);
        }
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${relays.length} relays`);
    
    // Consider initialization successful if we connect to at least one relay
    return connectedRelays.length > 0;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Parse a NIP19 naddr string to extract group components
 * @param {string} naddrString - The naddr string to parse
 * @returns {Object|null} Parsed group data or null if invalid
 */
export const parseNaddr = (naddrString) => {
  try {
    // Decode the naddr string using nostr-tools NIP19 decoder
    const { data } = decodeNip19(naddrString);
    
    if (!data || data.type !== 'naddr') {
      console.error('Invalid naddr format', data);
      return null;
    }
    
    return {
      kind: data.kind,
      pubkey: data.pubkey,
      identifier: data.identifier,
      relays: data.relays || []
    };
  } catch (error) {
    console.error('Error parsing naddr:', error);
    return null;
  }
};

/**
 * Fetch group messages using proven kind 39001 approach
 * @param {string} groupId - The group identifier from naddr
 * @returns {Promise<Array>} Array of group messages
 */
export const fetchGroupMessages = async (groupId, relays = ['wss://groups.0xchat.com']) => {
  try {
    const filter = {
      kinds: [39001],
      '#e': [groupId],
      limit: 50
    };
    
    const events = await pool.list(relays, [filter]);
    
    // Sort by created_at
    return events.sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error('Error fetching group messages:', error);
    throw error;
  }
};

/**
 * Fetch group metadata using kind from naddr
 * @param {Object} groupData - Decoded naddr data
 * @returns {Promise<Object>} Group metadata
 */
export const fetchGroupMetadata = async (groupData, relays = ['wss://groups.0xchat.com']) => {
  try {
    const filter = {
      kinds: [groupData.kind], // Use kind from naddr (39000)
      authors: [groupData.pubkey],
      '#d': [groupData.identifier]
    };
    
    const events = await pool.list(relays, [filter]);
    if (!events || events.length === 0) {
      return null;
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
    } catch (e) {
      metadata = { name: 'Unknown Group', about: 'Could not parse group metadata' };
    }
    
    return {
      id: latestEvent.id,
      pubkey: latestEvent.pubkey,
      created_at: latestEvent.created_at,
      kind: latestEvent.kind,
      tags: latestEvent.tags,
      metadata
    };
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    throw error;
  }
};

/**
 * Send a message to a NIP29 group
 * @param {Object} groupInfo - Group information from parseNaddr
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} The published event or null on failure
 */
export const sendGroupMessage = async (groupInfo, content) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      throw new Error('User not authenticated with Nostr');
    }
    
    // Format the a-tag for NIP29 group messages
    const aTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    const event = {
      kind: 84, // NIP29 group message kind
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['a', aTag]
      ],
      content,
      pubkey: userPubkey
    };
    
    // Sign and publish the event
    return await createAndPublishEvent(event);
  } catch (error) {
    console.error('Error sending group message:', error);
    return null;
  }
};

/**
 * Simple function to fetch events from relays
 * @param {Object} filter - Nostr filter
 * @returns {Promise<Array>} Array of events
 */
export const fetchEvents = async (filter) => {
  try {
    console.log('Fetching events with filter:', filter);
    
    // Ensure we have a limit to prevent excessive data usage
    if (!filter.limit) {
      filter.limit = 50;
    }
    
    // Simple fetch with timeout
    const events = await pool.list(relays, [filter], { timeout: 10000 });
    console.log(`Fetched ${events.length} events`);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

/**
 * Subscribe to events from relays
 * @param {Object} filter - Nostr filter
 * @returns {Object} Subscription object
 */
export const subscribe = (filter) => {
  try {
    const sub = pool.sub(relays, [filter]);
    return sub;
  } catch (error) {
    console.error('Error subscribing to events:', error);
    return null;
  }
};

/**
 * Generate a new key pair
 * @returns {Object} Key pair { privateKey, publicKey }
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  return {
    privateKey: sk,
    publicKey: pk
  };
};

/**
 * Get the current signing key, generating one if needed
 * @returns {Promise<Uint8Array>} Private key
 */
export const getSigningKey = async () => {
  if (cachedKeyPair && cachedKeyPair.privateKey) {
    return cachedKeyPair.privateKey;
  }
  
  const npub = localStorage.getItem('currentNpub');
  return npub ? generateSecretKey() : null;
};

/**
 * Get the current user's public key
 * @returns {Promise<string>} Public key or null if not available
 */
export const getUserPublicKey = async () => {
  try {
    // First, check if we have cached key
    if (cachedKeyPair && cachedKeyPair.publicKey) {
      return cachedKeyPair.publicKey;
    }
    
    // Try to get from localStorage
    const npub = localStorage.getItem('currentNpub');
    if (npub) {
      const keyPair = {
        privateKey: generateSecretKey(), // Generate a new one for demo
        publicKey: npub
      };
      cachedKeyPair = keyPair;
      return npub;
    }
    
    // Try to get from window.nostr (extension) if available
    if (typeof window !== 'undefined' && window.nostr) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        if (pubkey) {
          localStorage.setItem('currentNpub', pubkey);
          cachedKeyPair = {
            publicKey: pubkey
          };
          return pubkey;
        }
      } catch (err) {
        console.error('Error getting public key from extension:', err);
      }
    }
    
    console.warn('No Nostr public key found');
    return null;
  } catch (error) {
    console.error('Error in getUserPublicKey:', error);
    return null;
  }
};

/**
 * Create and publish an event to the nostr network
 * @param {Object} eventTemplate Template for the event or a pre-signed event
 * @param {Uint8Array} privateKey Private key to sign with (optional)
 * @returns {Promise<Object>} The published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    let signedEvent;
    
    // Check if we're being passed a pre-signed event (when used as a fallback)
    if (eventTemplate.sig && eventTemplate.pubkey && eventTemplate.created_at) {
      // This is already a signed event, no need to sign it again
      signedEvent = eventTemplate;
      
      // Verify the signature to be safe
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Pre-signed event signature verification failed');
      }
    } else {
      // We need to sign the event ourselves
      
      // Get signing key if not provided
      const sk = privateKey || await getSigningKey();
      if (!sk) {
        throw new Error('No signing key available');
      }
      
      // Get user's public key
      const pk = await getUserPublicKey();
      if (!pk) {
        throw new Error('No public key available');
      }
      
      // Create the event
      const event = {
        ...eventTemplate,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTemplate.tags || []
      };
      
      // Sign the event
      signedEvent = finalizeEvent(event, sk);
      
      // Verify the signature
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Event signature verification failed');
      }
    }
    
    // Publish the event to all relays
    pool.publish(relays, signedEvent);
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating and publishing event:', error);
    throw error;
  }
};

/**
 * Fetch the user's list of followed/joined groups from NIP-51 list event.
 * @param {string} pubkey - The user's public key.
 * @param {string[]} relayList - Relays to query.
 * @returns {Promise<Object[]>} - An array of group objects with metadata.
 */
export const fetchUserGroupList = async (pubkey, relayList = relays) => {
  try {
    console.log(`Fetching group list for pubkey: ${pubkey}`);
    const filter = {
      authors: [pubkey],
      kinds: [30001], // Standard kind for NIP-51 lists
      '#d': ['groups'] // Assuming 'groups' is the convention used
      // Consider adding 'communities' or 'bookmarks' if 'groups' yields no results
    };
    
    const listEvents = await pool.list(relayList, [filter]);
    if (!listEvents || listEvents.length === 0) {
      console.log('No group list event (kind 30001, #d=groups) found.');
      // Optionally, try fetching kind 10001 or other conventions
      return [];
    }

    // Sort by created_at to get the latest list event
    const latestListEvent = listEvents.sort((a, b) => b.created_at - a.created_at)[0];
    console.log('Found list event:', latestListEvent);

    const groupIdentifiers = [];
    latestListEvent.tags.forEach(tag => {
      // Look for 'a' tags representing groups (kind:pubkey:identifier)
      if (tag[0] === 'a' && tag[1]) {
         const parts = tag[1].split(':');
         // Basic validation: check for kind, pubkey, identifier
         if (parts.length === 3 && !isNaN(parseInt(parts[0])) && parts[1]?.length === 64 && parts[2]) {
            groupIdentifiers.push({ 
              kind: parseInt(parts[0]), 
              pubkey: parts[1], 
              identifier: parts[2],
              relay: tag[2] // Optional relay hint
            });
         }
      } 
      // TODO: Potentially add support for naddr strings stored in tags if needed
    });

    console.log('Found group identifiers:', groupIdentifiers);

    if (groupIdentifiers.length === 0) {
        return [];
    }

    // Fetch metadata for each group identifier found in the list
    const groupPromises = groupIdentifiers.map(async (group) => {
      try {
        const metadata = await fetchGroupMetadata(
          group.kind,
          group.pubkey,
          group.identifier,
          group.relay ? [...relayList, group.relay] : relayList // Include relay hint if available
        );
        if (metadata) {
          // Construct naddr for navigation (if possible)
          // Note: nostr-tools encode doesn't directly support naddr from parts easily
          // We might need to store the original naddr or reconstruct it carefully
          // For now, pass the parts needed for TeamDetail
          return { 
              ...metadata, 
              // Pass identifier parts instead of trying to reconstruct naddr here
              identifierData: group 
          };
        }
        return null;
      } catch (metaError) {
         console.error(`Error fetching metadata for group ${group.identifier}:`, metaError);
         return null;
      }
    });

    const groupsWithMetadata = (await Promise.all(groupPromises)).filter(g => g !== null);
    console.log('Groups with metadata:', groupsWithMetadata);
    return groupsWithMetadata;

  } catch (error) {
    console.error('Error fetching user group list:', error);
    return [];
  }
};

// Update the group message posting function to use kind 39001
export const postGroupMessage = async (groupId, content, privateKey) => {
  try {
    const event = {
      kind: 39001,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', groupId]
      ],
      content
    };
    
    // ... existing code ...
  } catch (error) {
    console.error('Error posting group message:', error);
    throw error;
  }
};

/**
 * Join a group by adding it to the user's NIP-51 groups list
 * @param {Object} groupData - Group data including naddr components
 * @returns {Promise<boolean>} Success status
 */
export const joinGroup = async (groupData) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      throw new Error('User not authenticated with Nostr');
    }

    // Fetch the user's current groups list
    const filter = {
      kinds: [30001],
      authors: [userPubkey],
      '#d': ['groups']
    };
    
    const events = await pool.list(relays, [filter]);
    const currentEvent = events.length > 0 
      ? events.sort((a, b) => b.created_at - a.created_at)[0]
      : null;

    // Parse the naddr to get group components
    const groupInfo = parseNaddr(groupData.naddr);
    if (!groupInfo) {
      throw new Error('Invalid group data');
    }

    // Create the a-tag for the group
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    // Prepare tags for the new event
    let tags = [
      ['d', 'groups']  // NIP-51 list identifier
    ];

    // Add existing group tags if any
    if (currentEvent) {
      const existingTags = currentEvent.tags.filter(t => 
        t[0] === 'a' && t[1] !== groupTag
      );
      tags = [...tags, ...existingTags];
    }

    // Add the new group tag
    tags.push(['a', groupTag, groupData.relay]);

    // Create and publish the new list event
    const event = {
      kind: 30001,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ''  // NIP-51 lists typically have empty content
    };

    const publishedEvent = await createAndPublishEvent(event);
    return !!publishedEvent;

  } catch (error) {
    console.error('Error joining group:', error);
    return false;
  }
};

/**
 * Check if user has joined a specific group
 * @param {string} naddr - Group naddr
 * @returns {Promise<boolean>} Whether user has joined the group
 */
export const hasJoinedGroup = async (naddr) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) return false;

    const groupInfo = parseNaddr(naddr);
    if (!groupInfo) return false;

    const filter = {
      kinds: [30001],
      authors: [userPubkey],
      '#d': ['groups']
    };

    const events = await pool.list(relays, [filter]);
    if (!events || events.length === 0) return false;

    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;

    return latestEvent.tags.some(tag => 
      tag[0] === 'a' && tag[1] === groupTag
    );

  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
}; 