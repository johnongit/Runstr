// Blossom Music Integration for RUNSTR
// Implements NIP-96 HTTP File Storage Integration

import { nip19 } from 'nostr-tools';

// Default Blossom servers with their capabilities
const DEFAULT_SERVERS = [
  {
    url: 'https://cdn.satellite.earth',
    name: 'Satellite Earth (Recommended)',
    type: 'blossom'
  },
  {
    url: 'https://blossom.band',
    name: 'Blossom Band',
    type: 'blossom'
  },
  {
    url: 'https://blossom.primal.net',
    name: 'Primal Blossom',
    type: 'blossom'
  },
  {
    url: 'https://nostr.build',
    name: 'Nostr Build',
    type: 'nip96'
  },
  {
    url: 'https://nostrcheck.me',
    name: 'Nostr Check',
    type: 'nip96'
  },
  {
    url: 'https://nostpic.com',
    name: 'Nostpic',
    type: 'nip96'
  },
  {
    url: 'https://files.sovbit.host',
    name: 'Sovbit Files',
    type: 'nip96'
  },
  {
    url: 'https://void.cat',
    name: 'Void Cat',
    type: 'nip96'
  }
];

// Supported audio MIME types
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 
  'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/mp4',
  'audio/x-wav', 'audio/x-flac', 'audio/x-m4a'
];

// Supported audio file extensions
const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.mp4'
];

// Number of items to request per page when using the /nip96/list endpoint
const NIP96_PAGE_LIMIT = 500;

/**
 * Check if a file is an audio file based on MIME type and extension
 */
function isAudioFile(mimeType, filename) {
  console.log('🎵 Checking if file is audio:', { mimeType, filename });
  
  // Check MIME type
  if (mimeType && SUPPORTED_AUDIO_TYPES.some(type => 
    mimeType.toLowerCase().includes(type.toLowerCase())
  )) {
    console.log('✅ Audio detected by MIME type:', mimeType);
    return true;
  }
  
  // Check file extension
  if (filename && SUPPORTED_AUDIO_EXTENSIONS.some(ext => 
    filename.toLowerCase().endsWith(ext.toLowerCase())
  )) {
    console.log('✅ Audio detected by extension:', filename);
    return true;
  }
  
  console.log('❌ Not detected as audio file');
  return false;
}

/**
 * Get NIP-96 server configuration
 */
async function getNip96Config(serverUrl) {
  try {
    console.log('🔧 Getting NIP-96 config for:', serverUrl);
    const configUrl = `${serverUrl}/.well-known/nostr/nip96.json`;
    const response = await fetch(configUrl);
    
    if (!response.ok) {
      console.log('❌ NIP-96 config not found, using default API URL');
      return { api_url: serverUrl };
    }
    
    const config = await response.json();
    console.log('✅ NIP-96 config loaded:', config);
    return config;
  } catch (error) {
    console.log('❌ Error loading NIP-96 config:', error);
    return { api_url: serverUrl };
  }
}

/**
 * Create NIP-98 authorization header for authenticated requests
 */
async function createNip98Auth(url, method = 'GET', payload = null) {
  try {
    // Import NDK dynamically to avoid loading issues
    const { default: NDK, NDKEvent } = await import('@nostr-dev-kit/ndk');
    
    // Get user's private key from localStorage
    const storedKey = localStorage.getItem('nostr-key');
    if (!storedKey) {
      console.log('❌ No private key found for NIP-98 auth');
      return null;
    }

    let privateKey;
    try {
      // Try to decode as nsec
      const decoded = nip19.decode(storedKey);
      if (decoded.type === 'nsec') {
        privateKey = decoded.data;
      } else {
        privateKey = storedKey;
      }
    } catch {
      // Assume it's already a hex private key
      privateKey = storedKey;
    }

    // Create NDK instance
    const ndk = new NDK();
    
    // Create NIP-98 HTTP Auth event (kind 27235)
    const authEvent = new NDKEvent(ndk);
    authEvent.kind = 27235;
    authEvent.content = '';
    authEvent.created_at = Math.floor(Date.now() / 1000);
    
    // Required tags for NIP-98
    authEvent.tags = [
      ['u', url],
      ['method', method.toUpperCase()]
    ];
    
    // Add payload hash if provided
    if (payload) {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      authEvent.tags.push(['payload', hashHex]);
    }

    // Sign the event
    await authEvent.sign(privateKey);
    
    // Create authorization header
    const authHeader = `Nostr ${btoa(JSON.stringify(authEvent.rawEvent()))}`;
    console.log('✅ Created NIP-98 authorization header');
    return authHeader;
    
  } catch (error) {
    console.error('❌ Error creating NIP-98 auth:', error);
    return null;
  }
}

// SECOND_EDIT
// Enhanced NIP-96 fetch supporting /nip96/list, pagination, and auth fallback
async function getFilesFromNip96Server(serverUrl, pubkey = null) {
  try {
    console.log('📋 Getting files from NIP-96 server:', serverUrl);

    // ---- Bouquet-style /nip96/list endpoint (unauth first, auth fallback) ----
    const candidateBases = [];
    if (pubkey) {
      candidateBases.push(`${serverUrl}/nip96/list/${pubkey}?limit=${NIP96_PAGE_LIMIT}`);
    }
    candidateBases.push(`${serverUrl}/nip96/list?limit=${NIP96_PAGE_LIMIT}`);

    // Helper to extract files from different response shapes
    const extractFiles = (data) => {
      if (Array.isArray(data)) return data;
      if (data.files && Array.isArray(data.files)) return data.files;
      if (data.data && Array.isArray(data.data)) return data.data;
      return [];
    };

    for (const base of candidateBases) {
      try {
        let cursor = null;
        let useAuth = false;
        const collected = [];

        while (true) {
          const pageUrl = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
          const headers = { 'Accept': 'application/json' };
          if (useAuth) {
            const authHeader = await createNip98Auth(pageUrl, 'GET');
            if (authHeader) headers['Authorization'] = authHeader;
          }

          let resp = await fetch(pageUrl, { method: 'GET', headers });

          // Retry with auth if first attempt unauthenticated and server demands it
          if (resp.status === 401 && !useAuth) {
            useAuth = true;
            console.log('🔑 NIP-96 endpoint requires auth – retrying');
            continue; // loop will retry same URL with auth
          }

          if (!resp.ok) {
            console.log('❌ NIP-96 fetch failed:', resp.status, pageUrl);
            break;
          }

          const data = await resp.json();
          const files = extractFiles(data);
          for (const f of files) {
            const t = convertNip96FileToTrack(f, serverUrl);
            if (t) collected.push(t);
          }

          cursor = data.cursor || data.next_cursor || null;
          if (!cursor) break;
        }

        if (collected.length) {
          console.log(`✅ Found ${collected.length} tracks via ${base}`);
          return collected;
        }

      } catch (err) {
        console.log('⚠️ Candidate endpoint failed:', base, err.message);
        continue;
      }
    }

    // ---- Fallback to legacy ?page=0&count style (existing logic) ----
    console.log('ℹ️ Falling back to legacy NIP-96 listing');
    // (Existing logic below remains unchanged)
    try {
      console.log('📋 Getting files from NIP-96 server:', serverUrl);
      
      // Get server configuration
      const config = await getNip96Config(serverUrl);
      const apiUrl = config.api_url || serverUrl;
      
      // Create listing endpoint URL
      const listingUrl = `${apiUrl}?page=0&count=${NIP96_PAGE_LIMIT}`;
      console.log('📋 Legacy listing URL:', listingUrl);

      // Try without auth
      let headers = { 'Accept': 'application/json' };
      let resp = await fetch(listingUrl, { method: 'GET', headers });

      // Retry with auth if required
      if (resp.status === 401) {
        const authHeader = await createNip98Auth(listingUrl, 'GET');
        if (authHeader) {
          headers = { ...headers, 'Authorization': authHeader };
          console.log('🔑 Legacy endpoint requires auth – retrying');
          resp = await fetch(listingUrl, { method: 'GET', headers });
        }
      }

      if (!resp.ok) {
        console.log('❌ Legacy NIP-96 listing failed:', resp.status);
        return [];
      }

      const legacyData = await resp.json();
      const legacyFiles = Array.isArray(legacyData) ? legacyData : (legacyData.files || legacyData.data || []);
      const legacyTracks = legacyFiles.map(f => convertNip96FileToTrack(f, serverUrl)).filter(Boolean);
      if (legacyTracks.length) {
        console.log(`✅ Found ${legacyTracks.length} tracks via legacy endpoint`);
      }
      return legacyTracks;
    } catch (error) {
      console.error('❌ Error getting files from NIP-96 server:', error);
      return [];
    }
  } catch (error) {
    console.error('❌ Error getting files from NIP-96 server:', error);
    return [];
  }
}

/**
 * Convert NIP-96 file object to track format
 */
function convertNip96FileToTrack(file, serverUrl) {
  try {
    console.log('🎵 Converting NIP-96 file to track:', file);
    
    if (!file.tags || !Array.isArray(file.tags)) {
      console.log('❌ Invalid file format - no tags array');
      return null;
    }
    
    // Parse tags into a map for easier access
    const tagMap = {};
    file.tags.forEach(tag => {
      if (Array.isArray(tag) && tag.length >= 2) {
        tagMap[tag[0]] = tag[1];
      }
    });
    
    console.log('🏷️ Parsed tags:', tagMap);
    
    // Get essential fields
    const url = tagMap.url;
    const mimeType = tagMap.m;
    const originalHash = tagMap.ox;
    const size = tagMap.size;
    
    if (!url) {
      console.log('❌ No URL found in file tags');
      return null;
    }
    
    // Extract filename from URL
    const filename = url.split('/').pop() || 'unknown';
    
    // Check if this is an audio file
    if (!isAudioFile(mimeType, filename)) {
      console.log('❌ File is not an audio file');
      return null;
    }
    
    // Create track object compatible with AudioPlayerProvider
    const track = {
      id: originalHash || url,
      title: tagMap.title || tagMap.alt || file.content || filename.replace(/\.[^/.]+$/, ''),
      artist: tagMap.creator || tagMap.artist || 'Unknown Artist',
      url: url, // Keep for compatibility
      mediaUrl: url, // Required by AudioPlayerProvider
      source: 'blossom', // Required by AudioPlayerProvider to identify as Blossom track
      duration: null, // Will be determined when audio loads
      size: size ? parseInt(size) : null,
      mimeType: mimeType,
      server: serverUrl,
      hash: originalHash,
      uploadedAt: file.created_at ? new Date(file.created_at * 1000) : null
    };
    
    console.log('✅ Created track:', track);
    return track;
    
  } catch (error) {
    console.error('❌ Error converting NIP-96 file to track:', error);
    return null;
  }
}

/**
 * Get files from traditional Blossom server (fallback method)
 */
async function getFilesFromBlossomServer(serverUrl, pubkey = null) {
  try {
    console.log('📋 Getting files from Blossom server (fallback):', serverUrl);
    
    // Try different possible endpoints
    let endpoints = [];
    
    if (pubkey) {
      console.log('🔑 Using pubkey for user-specific endpoints:', pubkey.substring(0, 8) + '...');
      // User-specific endpoints (most likely to work for Blossom servers)
      endpoints = [
        `${serverUrl}/list/${pubkey}`,
        `${serverUrl}/${pubkey}`,
        `${serverUrl}/api/list/${pubkey}`,
        `${serverUrl}/files/${pubkey}`
      ];
    } else {
      console.log('⚠️ No pubkey provided, trying generic endpoints');
      // Generic endpoints (fallback)
      endpoints = [
        `${serverUrl}/list`,
        `${serverUrl}/files`,
        `${serverUrl}/api/list`,
        `${serverUrl}/api/files`
      ];
    }
    
    for (const endpoint of endpoints) {
      try {
        console.log('🔍 Trying endpoint:', endpoint);
        
        // Try without auth first
        let headers = { 'Accept': 'application/json' };
        let response = await fetch(endpoint, { method: 'GET', headers });
        // If unauthorized, retry with auth
        if (response.status === 401) {
          const authHeader = await createNip98Auth(endpoint, 'GET');
          if (authHeader) {
            headers = { ...headers, 'Authorization': authHeader };
            console.log('🔑 Retrying Blossom endpoint with auth');
            response = await fetch(endpoint, { method: 'GET', headers });
          }
        }
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Blossom response data:', data);
          
          // Try to parse the response
          let files = [];
          if (Array.isArray(data)) {
            files = data;
          } else if (data.files && Array.isArray(data.files)) {
            files = data.files;
          } else if (data.data && Array.isArray(data.data)) {
            files = data.data;
          }
          
          if (files.length > 0) {
            console.log(`✅ Found ${files.length} files from Blossom server`);
            
            // Convert to tracks
            const tracks = [];
            for (const file of files) {
              const track = convertBlossomFileToTrack(file, serverUrl);
              if (track) {
                tracks.push(track);
              }
            }
            
            return tracks;
          }
        }
        
      } catch (endpointError) {
        console.log('❌ Endpoint failed:', endpoint, endpointError.message);
        continue;
      }
    }
    
    console.log('❌ No working endpoints found for Blossom server');
    return [];
    
  } catch (error) {
    console.error('❌ Error getting files from Blossom server:', error);
    return [];
  }
}

/**
 * Convert Blossom file object to track format
 */
function convertBlossomFileToTrack(file, serverUrl) {
  try {
    console.log('🎵 Converting Blossom file to track:', file);
    
    // Handle different possible field names
    const filename = file.name || file.filename || file.title || file.id || 'unknown';
    const mimeType = file.type || file.mimeType || file.mime || file.contentType;
    const size = file.size || file.length || file.bytes;
    const hash = file.sha256 || file.hash || file.id;
    const url = file.url || `${serverUrl}/${hash}`;
    
    // Check if this is an audio file
    if (!isAudioFile(mimeType, filename)) {
      console.log('❌ File is not an audio file');
      return null;
    }
    
    // Create track object compatible with AudioPlayerProvider
    const track = {
      id: hash || url,
      title: filename.replace(/\.[^/.]+$/, ''), // Remove extension
      artist: file.artist || file.creator || 'Unknown Artist',
      url: url, // Keep for compatibility
      mediaUrl: url, // Required by AudioPlayerProvider
      source: 'blossom', // Required by AudioPlayerProvider to identify as Blossom track
      duration: null, // Will be determined when audio loads
      size: size ? parseInt(size) : null,
      mimeType: mimeType,
      server: serverUrl,
      hash: hash,
      uploadedAt: file.created_at ? new Date(file.created_at * 1000) : null
    };
    
    console.log('✅ Created track:', track);
    return track;
    
  } catch (error) {
    console.error('❌ Error converting Blossom file to track:', error);
    return null;
  }
}

/**
 * Get tracks from Nostr relays using NIP-94 File Metadata events
 */
async function getTracksFromNostr(pubkey) {
  try {
    console.log('🔍 Searching for audio tracks via Nostr relays...');
    
    // Import NDK dynamically
    const { default: NDK } = await import('@nostr-dev-kit/ndk');
    
    // Create NDK instance with popular relays
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
    console.log('✅ Connected to Nostr relays');
    
    // Search for NIP-94 File Metadata events (kind 1063) and kind 31337
    const filter = {
      kinds: [1063, 31337],
      limit: 100
    };
    
    console.log('🔍 Querying for file metadata events...');
    const events = await ndk.fetchEvents(filter);
    console.log(`📋 Found ${events.size} file metadata events`);
    
    const tracks = [];
    
    for (const event of events) {
      try {
        console.log('📄 Processing event:', event.id);
        
        // Parse tags
        const tagMap = {};
        event.tags.forEach(tag => {
          if (Array.isArray(tag) && tag.length >= 2) {
            tagMap[tag[0]] = tag[1];
          }
        });
        
        console.log('🏷️ Event tags:', tagMap);
        
        // Look for audio-related tags
        const url = tagMap.url;
        const mimeType = tagMap.m;
        const title = tagMap.title || tagMap.subject || event.content;
        const creator = tagMap.creator || tagMap.artist;
        
        if (!url) {
          console.log('❌ No URL in event');
          continue;
        }
        
        // Check if this is an audio file
        if (!isAudioFile(mimeType, url)) {
          console.log('❌ Event is not for an audio file');
          continue;
        }
        
        const track = {
          id: event.id,
          title: title || 'Unknown Title',
          artist: creator || 'Unknown Artist',
          url: url, // Keep for compatibility
          mediaUrl: url, // Required by AudioPlayerProvider
          source: 'blossom', // Required by AudioPlayerProvider to identify as Blossom track
          duration: null,
          size: tagMap.size ? parseInt(tagMap.size) : null,
          mimeType: mimeType,
          server: 'nostr',
          hash: tagMap.x || tagMap.ox,
          uploadedAt: new Date(event.created_at * 1000),
          nostrEvent: event.id,
          pubkey: pubkey
        };
        
        tracks.push(track);
        console.log('✅ Added track from Nostr:', track.title);
        
      } catch (eventError) {
        console.error('❌ Error processing event:', eventError);
        continue;
      }
    }
    
    console.log(`✅ Found ${tracks.length} audio tracks from Nostr`);
    return tracks;
    
  } catch (error) {
    console.error('❌ Error getting tracks from Nostr:', error);
    return [];
  }
}

/**
 * Main function to get all available tracks from all sources
 */
export async function getAllTracks(servers = DEFAULT_SERVERS, pubkey) {
  console.log('🎵 Starting comprehensive track search...');
  console.log('🔍 Searching servers:', servers);
  
  const allTracks = [];
  
  try {
    // First, try to get tracks from Nostr relays
    console.log('📡 Phase 1: Searching Nostr relays for NIP-94 events...');
    const nostrTracks = await getTracksFromNostr(pubkey);
    allTracks.push(...nostrTracks);
    console.log(`✅ Phase 1 complete: ${nostrTracks.length} tracks from Nostr`);
    
    // Then, query each server directly
    console.log('🌐 Phase 2: Querying servers directly...');
    
    for (const server of servers) {
      try {
        console.log(`🔍 Querying server: ${server.name} (${server.url})`);
        
        let serverTracks = [];
        
        if (server.type === 'nip96') {
          // Use NIP-96 listing endpoint
          serverTracks = await getFilesFromNip96Server(server.url, pubkey);
        } else {
          // Use traditional Blossom approach
          serverTracks = await getFilesFromBlossomServer(server.url, pubkey);
        }
        
        console.log(`✅ Server ${server.name}: ${serverTracks.length} tracks`);
        allTracks.push(...serverTracks);
        
      } catch (serverError) {
        console.error(`❌ Error querying server ${server.name}:`, serverError);
        continue;
      }
    }
    
    console.log(`🎵 Search complete: ${allTracks.length} total tracks found`);
    
    // Remove duplicates based on hash or URL
    const uniqueTracks = [];
    const seen = new Set();
    
    for (const track of allTracks) {
      const key = track.hash || track.url;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(track);
      }
    }
    
    console.log(`✅ Final result: ${uniqueTracks.length} unique tracks`);
    return uniqueTracks;
    
  } catch (error) {
    console.error('❌ Error in getAllTracks:', error);
    return allTracks; // Return whatever we managed to get
  }
}

/**
 * Get tracks from a specific server
 */
export async function getTracksFromServer(serverUrl, pubkey) {
  console.log('🎵 Getting tracks from specific server:', serverUrl);
  
  // Find server configuration
  const server = DEFAULT_SERVERS.find(s => s.url === serverUrl) || {
    url: serverUrl,
    name: 'Custom Server',
    type: 'blossom' // Default to blossom, will try NIP-96 if that fails
  };
  
  try {
    let tracks = [];
    
    if (server.type === 'nip96') {
      tracks = await getFilesFromNip96Server(server.url, pubkey);
    } else {
      tracks = await getFilesFromBlossomServer(server.url, pubkey);
    }
    
    // If no tracks found and we assumed blossom, try NIP-96
    if (tracks.length === 0 && server.type === 'blossom') {
      console.log('🔄 No tracks found with Blossom approach, trying NIP-96...');
      tracks = await getFilesFromNip96Server(server.url, pubkey);
    }
    
    console.log(`✅ Found ${tracks.length} tracks from ${serverUrl}`);
    return tracks;
    
  } catch (error) {
    console.error('❌ Error getting tracks from server:', error);
    return [];
  }
}

/**
 * Test connection to a Blossom or NIP-96 server
 */
export async function testConnection(serverUrl) {
  try {
    console.log('🔧 Testing connection to:', serverUrl);
    
    // Find server configuration
    const server = DEFAULT_SERVERS.find(s => s.url === serverUrl) || {
      url: serverUrl,
      name: 'Custom Server',
      type: 'blossom' // Default to blossom, will try NIP-96 if that fails
    };
    
    // Try basic connectivity first
    try {
      const response = await fetch(serverUrl, {
        method: 'HEAD',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Basic connectivity test passed');
        return true;
      }
    } catch (basicError) {
      console.log('⚠️ Basic connectivity test failed, trying specific endpoints');
    }
    
    // Try server-specific endpoints
    if (server.type === 'nip96') {
      // Test NIP-96 configuration endpoint
      try {
        const configUrl = `${serverUrl}/.well-known/nostr/nip96.json`;
        const configResponse = await fetch(configUrl);
        
        if (configResponse.ok) {
          console.log('✅ NIP-96 configuration endpoint accessible');
          return true;
        }
      } catch (configError) {
        console.log('❌ NIP-96 config endpoint failed');
      }
      
      // Try NIP-96 API endpoint
      try {
        const config = await getNip96Config(serverUrl);
        const apiUrl = config.api_url || serverUrl;
        const testResponse = await fetch(`${apiUrl}?page=0&count=1`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // Even if it returns 401 (unauthorized), it means the endpoint exists
        if (testResponse.status === 401 || testResponse.ok) {
          console.log('✅ NIP-96 API endpoint accessible');
          return true;
        }
      } catch (apiError) {
        console.log('❌ NIP-96 API endpoint failed');
      }
    } else {
      // Test Blossom endpoints
      const endpoints = [
        `${serverUrl}/list`,
        `${serverUrl}/files`,
        `${serverUrl}/api/list`,
        `${serverUrl}/api/files`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Even if it returns 401 (unauthorized), it means the endpoint exists
          if (response.status === 401 || response.ok) {
            console.log(`✅ Blossom endpoint accessible: ${endpoint}`);
            return true;
          }
        } catch (endpointError) {
          console.log(`❌ Endpoint failed: ${endpoint}`);
          continue;
        }
      }
    }
    
    console.log('❌ All connection tests failed');
    return false;
    
  } catch (error) {
    console.error('❌ Error testing connection:', error);
    return false;
  }
}

export { DEFAULT_SERVERS };