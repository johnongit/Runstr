import { nip98 } from 'nostr-tools';

/**
 * Blossom API utility for music integration
 * Handles communication with Blossom servers for music playback
 */

// Supported audio file types for filtering
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 
  'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/mp4'
];

/**
 * Get audio tracks from Nostr relays using NIP-94 File Metadata events
 * @param {string} serverUrl - Base URL of the Blossom server (used for filtering)
 * @param {string} pubkey - User's public key
 * @param {Function} signEvent - Function to sign Nostr events (from Nostr context)
 * @returns {Promise<Array>} - Array of track objects
 */
export async function listTracks(serverUrl, pubkey, signEvent) {
  if (!serverUrl || !pubkey) {
    throw new Error('Missing required parameters: serverUrl or pubkey');
  }
  
  console.log(`[Blossom] Fetching audio tracks from Nostr relays for server: ${serverUrl}`);
  
  try {
    // Import NDK dynamically to avoid issues
    const { default: NDK } = await import('@nostr-dev-kit/ndk');
    
    // Create NDK instance with some popular relays
    const ndk = new NDK({
      explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band',
        'wss://nostr.wine',
        'wss://relay.snort.social'
      ]
    });
    
    await ndk.connect();
    console.log('[Blossom] Connected to Nostr relays');
    
    // Query for audio track events (kind 31337) from the user
    const filter = {
      kinds: [31337], // Audio track events
      authors: [pubkey],
      limit: 100
    };
    
    console.log('[Blossom] Querying for audio track events:', filter);
    const events = await ndk.fetchEvents(filter);
    console.log(`[Blossom] Found ${events.size} audio track events`);
    
    const tracks = [];
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    
    for (const event of events) {
      try {
        const track = parseAudioTrackEvent(event.rawEvent(), baseUrl);
        if (track) {
          tracks.push(track);
        }
      } catch (error) {
        console.warn('[Blossom] Error parsing audio track event:', error);
      }
    }
    
    console.log(`[Blossom] Successfully parsed ${tracks.length} audio tracks`);
    return tracks;
    
  } catch (error) {
    console.error('[Blossom] Error fetching tracks from Nostr:', error);
    throw new Error(`Failed to fetch tracks from Nostr relays: ${error.message}`);
  }
}

/**
 * Parse a NIP-94 audio track event into a track object
 * @param {Object} event - Raw Nostr event
 * @param {string} serverUrl - Base URL to filter by
 * @returns {Object|null} - Track object or null if not valid
 */
function parseAudioTrackEvent(event, serverUrl) {
  if (!event || event.kind !== 31337) {
    return null;
  }
  
  console.log('[Blossom] Parsing audio track event:', event.id);
  
  // Extract metadata from tags
  const tags = event.tags || [];
  let mediaUrl = null;
  let mimeType = null;
  let title = null;
  let artist = null;
  let duration = null;
  
  // Parse tags according to NIP-94 and Bouquet example
  for (const tag of tags) {
    const [tagName, ...values] = tag;
    
    switch (tagName) {
      case 'title':
        title = values[0];
        break;
      case 'creator':
        if (!artist) artist = values[0]; // Use first creator as artist
        break;
      case 'imeta':
        // Parse imeta tag: ["imeta", "url https://example.com/file.mp3", "m audio/mpeg"]
        for (let i = 1; i < values.length; i++) {
          const value = values[i];
          if (value.startsWith('url ')) {
            const url = value.substring(4);
            if (url.includes(serverUrl) || serverUrl.includes('satellite.earth')) {
              mediaUrl = url;
            }
          } else if (value.startsWith('m ')) {
            mimeType = value.substring(2);
          }
        }
        break;
      case 'media':
        // Direct media URL
        const url = values[0];
        if (url && (url.includes(serverUrl) || serverUrl.includes('satellite.earth'))) {
          mediaUrl = url;
        }
        break;
      case 'm':
        // MIME type
        mimeType = values[0];
        break;
      case 'duration':
        duration = parseInt(values[0]);
        break;
    }
  }
  
  // Filter by supported audio types
  if (!mimeType || !SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
    console.log(`[Blossom] Skipping track with unsupported MIME type: ${mimeType}`);
    return null;
  }
  
  // Must have a media URL
  if (!mediaUrl) {
    console.log('[Blossom] Skipping track without media URL');
    return null;
  }
  
  // Create track object compatible with existing audio player
  const track = {
    id: event.id,
    title: title || 'Unknown Title',
    artist: artist || 'Unknown Artist',
    mediaUrl: mediaUrl,
    source: 'blossom',
    duration: duration,
    mimeType: mimeType,
    // Additional metadata
    pubkey: event.pubkey,
    created_at: event.created_at,
    content: event.content || ''
  };
  
  console.log('[Blossom] Successfully parsed track:', track.title, 'by', track.artist);
  return track;
}

/**
 * Test connection to a Blossom server (simplified for NIP-94 approach)
 * @param {string} serverUrl - Base URL of the Blossom server
 * @returns {Promise<boolean>} - True if server appears to be reachable
 */
export async function testConnection(serverUrl) {
  if (!serverUrl) {
    return false;
  }
  
  try {
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    console.log(`[Blossom] Testing connection to: ${baseUrl}`);
    
    // For NIP-94 approach, we just test if the server is reachable
    // The actual audio tracks come from Nostr relays, not the Blossom server directly
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'RUNSTR-Music-Player/1.0'
      }
    });
    
    const isReachable = response.status < 500; // Accept any non-server-error response
    console.log(`[Blossom] Connection test result: ${isReachable ? 'SUCCESS' : 'FAILED'} (${response.status})`);
    
    return isReachable;
    
  } catch (error) {
    console.error('[Blossom] Connection test failed:', error);
    return false;
  }
}

/**
 * Get server info (placeholder for future use)
 * @param {string} serverUrl - Base URL of the server
 * @returns {Promise<Object|null>} - Server info or null
 */
export async function getServerInfo(serverUrl) {
  try {
    const response = await fetch(`${serverUrl}/.well-known/nostr.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('[Blossom] No server info available');
  }
  return null;
}

/**
 * Debug function to test different authentication methods for Satellite CDN
 * @param {string} serverUrl - Base URL of the Blossom server
 * @param {string} pubkey - User's public key
 * @returns {Promise<Object>} - Debug information about different auth attempts
 */
export async function debugSatelliteAuth(serverUrl, pubkey) {
  const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  const results = {};
  
  // Test different endpoints and auth methods
  const testCases = [
    { url: `${baseUrl}/list/${pubkey}`, auth: false, name: 'Standard endpoint, no auth' },
    { url: `${baseUrl}/${pubkey}`, auth: false, name: 'Direct pubkey endpoint, no auth' },
    { url: `${baseUrl}/api/list/${pubkey}`, auth: false, name: 'API endpoint, no auth' },
    { url: `${baseUrl}/files/${pubkey}`, auth: false, name: 'Files endpoint, no auth' },
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`[Debug] Testing: ${testCase.name} - ${testCase.url}`);
      
      const response = await fetch(testCase.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RUNSTR-Music-Player/1.0'
        }
      });
      
      const responseText = await response.text();
      
      results[testCase.name] = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 500), // First 500 chars
        success: response.ok
      };
      
      console.log(`[Debug] ${testCase.name}: ${response.status} ${response.statusText}`);
      
    } catch (error) {
      results[testCase.name] = {
        error: error.message,
        success: false
      };
      console.error(`[Debug] ${testCase.name} failed:`, error.message);
    }
  }
  
  return results;
} 