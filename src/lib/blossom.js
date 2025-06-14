import { nip98 } from 'nostr-tools';

/**
 * Blossom API utility for music integration
 * Handles communication with Blossom servers for music playback
 */

// Audio file MIME types that we support
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',     // .mp3
  'audio/wav',      // .wav
  'audio/flac',     // .flac
  'audio/mp4',      // .m4a
  'audio/aac',      // .aac
  'audio/ogg',      // .ogg
  'video/mp4',      // .mp4 (for audio content)
];

// Audio file extensions as fallback
const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.mp4'
];

/**
 * Check if a blob is an audio file based on type or filename
 * @param {Object} blob - Blob descriptor from Blossom server
 * @returns {boolean} - True if the blob appears to be an audio file
 */
function isAudioFile(blob) {
  // Check MIME type first (most reliable)
  if (blob.type && SUPPORTED_AUDIO_TYPES.includes(blob.type.toLowerCase())) {
    return true;
  }
  
  // Fallback to file extension if available
  if (blob.url || blob.name) {
    const filename = blob.url || blob.name || '';
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return SUPPORTED_AUDIO_EXTENSIONS.includes(extension);
  }
  
  return false;
}

/**
 * Extract a human-readable title from blob metadata
 * @param {Object} blob - Blob descriptor from Blossom server
 * @returns {string} - Human-readable title for the track
 */
function extractTrackTitle(blob) {
  // Try to get title from metadata (NIP-94 tags)
  if (blob.metadata && blob.metadata.title) {
    return blob.metadata.title;
  }
  
  // Try to get title from tags
  if (blob.tags) {
    const titleTag = blob.tags.find(tag => tag[0] === 'title');
    if (titleTag && titleTag[1]) {
      return titleTag[1];
    }
  }
  
  // Fallback to filename without extension
  if (blob.url || blob.name) {
    const filename = blob.url || blob.name || '';
    const nameWithoutExtension = filename.substring(filename.lastIndexOf('/') + 1);
    const finalName = nameWithoutExtension.substring(0, nameWithoutExtension.lastIndexOf('.'));
    return finalName || 'Unknown Track';
  }
  
  // Last resort
  return `Track ${blob.sha256?.substring(0, 8) || 'Unknown'}`;
}

/**
 * Extract artist information from blob metadata
 * @param {Object} blob - Blob descriptor from Blossom server
 * @returns {string} - Artist name or 'Unknown Artist'
 */
function extractArtistName(blob) {
  // Try to get artist from metadata
  if (blob.metadata && blob.metadata.artist) {
    return blob.metadata.artist;
  }
  
  // Try to get artist from tags
  if (blob.tags) {
    const artistTag = blob.tags.find(tag => tag[0] === 'artist');
    if (artistTag && artistTag[1]) {
      return artistTag[1];
    }
  }
  
  return 'Unknown Artist';
}

/**
 * Convert a Blossom blob descriptor to our track format
 * @param {Object} blob - Blob descriptor from Blossom server
 * @param {string} serverUrl - Base URL of the Blossom server
 * @returns {Object} - Track object compatible with our audio player
 */
function blobToTrack(blob, serverUrl) {
  const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  
  return {
    id: blob.sha256,
    title: extractTrackTitle(blob),
    artist: extractArtistName(blob),
    mediaUrl: `${baseUrl}/${blob.sha256}`,
    source: 'blossom',
    // Include original blob data for debugging/future use
    _blobData: blob
  };
}

/**
 * List audio tracks from a Blossom server
 * @param {string} serverUrl - Base URL of the Blossom server
 * @param {string} pubkey - User's public key
 * @param {Function} signEvent - Function to sign Nostr events (from Nostr context)
 * @returns {Promise<Array>} - Array of track objects
 */
export async function listTracks(serverUrl, pubkey, signEvent) {
  if (!serverUrl || !pubkey || !signEvent) {
    throw new Error('Missing required parameters: serverUrl, pubkey, or signEvent');
  }
  
  // Ensure serverUrl is properly formatted
  const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  const listUrl = `${baseUrl}/list/${pubkey}`;
  
  try {
    console.log(`[Blossom] Fetching track list from: ${listUrl}`);
    
    // Create NIP-98 authorization token
    const authToken = await nip98.getToken(
      listUrl,
      'get',
      signEvent,
      true
    );
    
    if (!authToken) {
      throw new Error('Failed to create authorization token');
    }
    
    // Make the request to the Blossom server
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': authToken,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    
    const blobs = await response.json();
    console.log(`[Blossom] Received ${blobs.length} blobs from server`);
    
    // Filter for audio files only
    const audioBlobs = blobs.filter(isAudioFile);
    console.log(`[Blossom] Found ${audioBlobs.length} audio files`);
    
    // Convert to our track format
    const tracks = audioBlobs.map(blob => blobToTrack(blob, baseUrl));
    
    return tracks;
    
  } catch (error) {
    console.error('[Blossom] Error fetching tracks:', error);
    throw new Error(`Failed to fetch tracks from Blossom server: ${error.message}`);
  }
}

/**
 * Test connection to a Blossom server
 * @param {string} serverUrl - Base URL of the Blossom server
 * @returns {Promise<boolean>} - True if server is reachable and appears to be a Blossom server
 */
export async function testConnection(serverUrl) {
  if (!serverUrl) {
    return false;
  }
  
  try {
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    
    console.log(`[Blossom] Testing connection to: ${baseUrl}`);
    
    // First, try to get server info to see if it's actually a Blossom server
    const serverInfo = await getServerInfo(baseUrl);
    if (serverInfo) {
      console.log(`[Blossom] Server info:`, serverInfo);
      // If we got JSON response from info endpoints, it's likely a proper Blossom server
      return true;
    }
    
    // Fallback: Try a basic HEAD request to see if server is reachable
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      timeout: 5000 // 5 second timeout
    });
    
    console.log(`[Blossom] Basic connectivity test - Status: ${response.status}`);
    
    // If we get any response (even 404), the server is reachable
    // But warn that we couldn't verify it's a Blossom server
    if (response.status < 500) {
      console.warn(`[Blossom] Server is reachable but couldn't verify it's a Blossom server`);
      return true; // Still return true for basic connectivity
    }
    
    return false;
    
  } catch (error) {
    console.error('[Blossom] Connection test failed:', error);
    return false;
  }
}

/**
 * Get server info/capabilities (if supported)
 * @param {string} serverUrl - Base URL of the Blossom server
 * @returns {Promise<Object|null>} - Server info object or null if not supported
 */
export async function getServerInfo(serverUrl) {
  if (!serverUrl) {
    return null;
  }
  
  try {
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    
    // Try common info endpoints
    const infoEndpoints = ['/', '/info', '/.well-known/blossom'];
    
    for (const endpoint of infoEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          timeout: 3000
        });
        
        if (response.ok) {
          const info = await response.json();
          return info;
        }
      } catch (e) {
        // Continue to next endpoint
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[Blossom] Error getting server info:', error);
    return null;
  }
} 