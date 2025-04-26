import { nip98 } from 'nostr-tools';
import { bech32 } from 'bech32';
import { getLnurlFromCache, storeLnurlInCache } from '../services/lnurlCacheService';

// todo: move this to env variables
const WAVLAKE_CATALOG_API_BASE_URL = 'https://catalog.wavlake.com/v1';
const WAVLAKE_API_BASE_URL = 'https://wavlake.com/api/v1';

// Constants for playlist types
export const PLAYLIST = 'playlist';
export const TOP_40 = 'top-40';
export const TRENDING_ROCK_PLAYLIST_ID = 'trending-rock';
export const TRENDING_HIPHOP_PLAYLIST_ID = 'trending-hiphop';
export const LIKED = 'liked';

/**
 * Base fetch function with headers and error handling
 */
const fetchWithHeaders = async (endpoint, options = {}) => {
  try {
    const url = `${WAVLAKE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Fetch trending tracks filtered by genre
 */
export const fetchTrendingPlaylistByGenre = async (genre) => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&genre=${genre}&limit=40`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
};

export const fetchTrendingRock = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('rock');

  return { id: TRENDING_ROCK_PLAYLIST_ID, title: 'Rock', tracks: playlist };
};

export const fetchTrendingHipHop = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('hip-hop');

  return {
    id: TRENDING_HIPHOP_PLAYLIST_ID,
    title: 'Hip-Hop',
    tracks: playlist
  };
};

/**
 * Fetch Top 40 tracks
 */
export const fetchTop40 = async () => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&limit=40`
    );
    const tracks = Array.isArray(data) ? data : [];
    return { id: TOP_40, title: 'Top 40', tracks };
  } catch (error) {
    console.error('Error fetching top40:', error);
    throw error;
  }
};

/**
 * Get track metadata by ID
 */
export const getTrackById = async (trackId) => {
  try {
    const data = await fetchWithHeaders(`/content/track/${trackId}`);
    return data;
  } catch (error) {
    console.error('Error fetching track:', error);
    throw error;
  }
};

/**
 * Get LNURL for a track to enable zapping the artist
 */
export const getLnurlForTrack = async (trackId) => {
  if (!trackId) throw new Error('Track ID is required');
  
  // Check cache first
  const cachedLnurl = getLnurlFromCache(trackId);
  if (cachedLnurl) {
    console.log('[WavlakeZap] Using cached LNURL for track:', trackId);
    return cachedLnurl;
  }
  
  try {
    // Using appId 'runstr2025' as requested
    const appId = 'runstr2025';
    const data = await fetchWithHeaders(`/lnurl?contentId=${trackId}&appId=${appId}`);
    
    if (!data || !data.lnurl) {
      throw new Error('Invalid LNURL response from server');
    }
    
    // Store in cache before returning
    storeLnurlInCache(trackId, data.lnurl);
    
    return data.lnurl;
  } catch (error) {
    console.error('Error getting LNURL for track:', error);
    throw error;
  }
};

/**
 * Process a Wavlake LNURL payment using NWC wallet
 * This is separate from Nostr zaps to avoid using window.nostr in mobile
 * @param {string} lnurl - The LNURL string from Wavlake API
 * @param {object} wallet - The NWC wallet instance
 * @param {number} amount - Optional amount in sats, if not specified will use the default from LNURL
 * @returns {Promise<object>} - Payment result
 */
export const processWavlakeLnurlPayment = async (lnurl, wallet, amount = null) => {
  if (!lnurl) throw new Error('LNURL is required');
  if (!wallet) throw new Error('Wallet is required');
  
  try {
    // Use NWC wallet with manual LNURL flow by default
    // This is more reliable for mobile apps than trying direct LNURL first
    console.log('[WavlakeZap] Using manual LNURL-pay flow with NWC wallet');
    
    // 1. Make HTTP request to the LNURL
    // The LNURL is a bech32-encoded URL that we need to decode
    let lnurlDecoded;
    try {
      lnurlDecoded = lnurl.toLowerCase().startsWith('lnurl')
        ? bech32ToUrl(lnurl)
        : lnurl;
      
      console.log('[WavlakeZap] Decoded LNURL:', lnurlDecoded);
    } catch (decodeError) {
      console.error('[WavlakeZap] Failed to decode LNURL:', decodeError);
      throw new Error('Invalid LNURL format');
    }
    
    // 2. Fetch the LNURL-pay parameters
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000); // Reduced timeout to 5 seconds
    
    try {
      const response = await fetch(lnurlDecoded, { 
        signal: abortController.signal 
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`LNURL request failed: ${response.status}`);
      }
      
      const lnurlPayData = await response.json();
      console.log('[WavlakeZap] LNURL-pay data:', lnurlPayData);
      
      // Verify this is a valid LNURL-pay response
      if (lnurlPayData.tag !== 'payRequest') {
        throw new Error('Invalid LNURL-pay response: Not a payment request');
      }
      
      // 3. Determine the payment amount
      const payAmount = amount || lnurlPayData.minSendable / 1000; // Convert from millisats if no amount specified
      const millisats = Math.round(payAmount * 1000);
      
      // Validate amount is within allowed range
      if (millisats < lnurlPayData.minSendable) {
        throw new Error(`Amount too small. Minimum is ${lnurlPayData.minSendable / 1000} sats`);
      }
      if (lnurlPayData.maxSendable && millisats > lnurlPayData.maxSendable) {
        throw new Error(`Amount too large. Maximum is ${lnurlPayData.maxSendable / 1000} sats`);
      }
      
      // 4. Call the callback URL with amount to get the invoice
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', millisats.toString());
      
      // Add comment if allowed
      if (lnurlPayData.commentAllowed) {
        callbackUrl.searchParams.append('comment', 'Zap from RUNSTR ⚡️');
      }
      
      // Get invoice
      const invoiceAbortController = new AbortController();
      const invoiceTimeoutId = setTimeout(() => invoiceAbortController.abort(), 5000); // Reduced timeout to 5 seconds
      
      try {
        const invoiceResponse = await fetch(callbackUrl.toString(), {
          signal: invoiceAbortController.signal
        });
        clearTimeout(invoiceTimeoutId);
        
        if (!invoiceResponse.ok) {
          throw new Error(`Invoice request failed: ${invoiceResponse.status}`);
        }
        
        const invoiceData = await invoiceResponse.json();
        console.log('[WavlakeZap] Invoice data:', invoiceData);
        
        if (!invoiceData.pr) {
          throw new Error('No payment request in response');
        }
        
        // 5. Pay the invoice using the wallet
        console.log('[WavlakeZap] Paying invoice:', invoiceData.pr.substring(0, 30) + '...');
        const paymentResult = await wallet.makePayment(invoiceData.pr);
        console.log('[WavlakeZap] Payment result:', paymentResult);
        
        return paymentResult;
      } catch (invoiceError) {
        clearTimeout(invoiceTimeoutId);
        console.error('[WavlakeZap] Invoice request error:', invoiceError);
        throw invoiceError;
      }
    } catch (lnurlFetchError) {
      clearTimeout(timeoutId);
      console.error('[WavlakeZap] LNURL fetch error:', lnurlFetchError);
      
      // Only attempt direct LNURL payment as a fallback if manual flow fails
      // and the wallet supports direct LNURL payments
      if (wallet.makePayment && typeof wallet.makePayment === 'function') {
        try {
          console.log('[WavlakeZap] Manual flow failed, attempting direct LNURL payment as fallback');
          const result = await wallet.makePayment(lnurl);
          return result;
        } catch (directError) {
          console.error('[WavlakeZap] Direct LNURL payment also failed:', directError);
          // Continue to throw the original error
        }
      }
      
      throw lnurlFetchError;
    }
  } catch (error) {
    console.error('[WavlakeZap] Process payment error:', error);
    throw error;
  }
};

/**
 * Helper function to decode a bech32 encoded LNURL to a regular URL
 * @param {string} lnurl - The LNURL string to decode
 * @returns {string} - The decoded URL
 */
export const bech32ToUrl = (lnurl) => {
  try {
    // If LNURL already starts with http, it's already decoded
    if (lnurl.toLowerCase().startsWith('http')) {
      return lnurl;
    }
    
    // Remove 'lightning:' prefix if it exists
    const formattedLnurl = lnurl.startsWith('lightning:') 
      ? lnurl.slice(10) 
      : lnurl;
    
    // Decode the LNURL using bech32 library
    const decoded = bech32.decode(formattedLnurl, 1023);
    const words = decoded.words;
    
    // Convert the decoded words to bytes
    const bytes = bech32.fromWords(words);
    
    // Convert bytes to a string (URL)
    const url = new TextDecoder().decode(new Uint8Array(bytes));
    
    console.log('[WavlakeZap] Decoded LNURL:', url);
    return url;
  } catch (error) {
    console.error('[WavlakeZap] bech32ToUrl error:', error);
    throw new Error('Failed to decode LNURL: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Get stream URL for a track
 */
export const getTrackStreamUrl = (trackId) => {
  if (!trackId) return null;
  return `/api/v1/stream/track/${trackId}`;
};

/**
 * Search for content
 */
export const searchContent = async (term) => {
  try {
    const data = await fetchWithHeaders(
      `/content/search?term=${encodeURIComponent(term)}`
    );
    return data;
  } catch (error) {
    console.error('Error searching content:', error);
    throw error;
  }
};

export const fetchLibraryPlaylists = async (pubkey) => {
  return fetch(`${WAVLAKE_CATALOG_API_BASE_URL}/playlists/user/${pubkey}`)
    .then((res) => res.json())
    .then((res) => res.data);
};

/**
 * Get liked playlist using NIP-98 auth and NIP-88 format
 */
export const fetchLikedPlaylist = async () => {
  const url = `${WAVLAKE_CATALOG_API_BASE_URL}/library/tracks`;

  try {
    // Ensure Nostr is connected before trying to fetch liked tracks
    if (!window.nostr) {
      throw new Error('Nostr extension not found. Please log in first to access your liked tracks.');
    }

    // Get the signature for authentication
    const authToken = await nip98.getToken(
      url,
      'get',
      (event) => window.nostr.signEvent(event),
      true
    ).catch(err => {
      console.error('Error getting Nostr signature:', err);
      throw new Error('Failed to authenticate with Nostr: ' + (err.message || 'Unknown error'));
    });

    // Fetch the liked tracks
    const res = await fetch(url, {
      headers: {
        Authorization: authToken
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch liked tracks: ${res.status} ${res.statusText}`);
    }

    const jsonResponse = await res.json();
    if (!jsonResponse.data || !jsonResponse.data.tracks) {
      throw new Error('Invalid response format from server');
    }

    const tracks = jsonResponse.data.tracks;

    // Ensure each track has required fields
    const validatedTracks = tracks.map(track => {
      // Add default mediaUrl if missing
      if (!track.mediaUrl && track.id) {
        track.mediaUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
      }
      return track;
    });

    return {
      id: LIKED,
      title: 'Liked',
      tracks: validatedTracks,
      isPrivate: true
    };
  } catch (error) {
    console.error('Error fetching liked playlist:', error);
    throw error;
  }
};

export const fetchPlaylistById = async (playlistId) => {
  try {
    const response = await fetch(
      `${WAVLAKE_API_BASE_URL}/content/playlist/${playlistId}`
    );
    
    if (!response.ok) {
      const error = new Error(`Failed to fetch playlist: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    
    const data = await response.json();
    
    // Ensure the playlist has the expected structure
    if (!data.tracks || !Array.isArray(data.tracks)) {
      throw new Error('Invalid playlist data format');
    }
    
    // Add missing mediaUrls if needed
    const tracksWithUrls = data.tracks.map(track => {
      if (!track.mediaUrl && track.id) {
        track.mediaUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
      }
      return track;
    });
    
    return { 
      id: playlistId, 
      ...data, 
      tracks: tracksWithUrls 
    };
  } catch (error) {
    console.error(`Error fetching playlist ${playlistId}:`, error);
    throw error;
  }
};

export const fetchPlaylist = async (playlistId) => {
  console.log(`Fetching playlist: ${playlistId}`);
  
  try {
    switch (playlistId) {
      case TOP_40:
        return fetchTop40();
      case TRENDING_ROCK_PLAYLIST_ID:
        return fetchTrendingRock();
      case TRENDING_HIPHOP_PLAYLIST_ID:
        return fetchTrendingHipHop();
      case LIKED:
        return fetchLikedPlaylist();
      default:
        return fetchPlaylistById(playlistId);
    }
  } catch (error) {
    console.error(`Error in fetchPlaylist for ${playlistId}:`, error);
    throw error;
  }
};
