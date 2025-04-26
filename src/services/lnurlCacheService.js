/**
 * LNURL Cache Service
 * 
 * Provides caching for LNURLs to avoid repeated API calls
 * for the same track IDs, improving performance for
 * repeated zaps to the same tracks.
 */

const LNURL_CACHE = {};
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Get a cached LNURL for a track if available
 * @param {string} trackId - The track ID to lookup
 * @returns {string|null} - The cached LNURL or null if not in cache
 */
export const getLnurlFromCache = (trackId) => {
  const cachedData = LNURL_CACHE[trackId];
  
  // Return null if no cache or cache expired
  if (!cachedData || Date.now() > cachedData.expiry) {
    return null;
  }
  
  return cachedData.lnurl;
};

/**
 * Store a LNURL in the cache
 * @param {string} trackId - The track ID to cache
 * @param {string} lnurl - The LNURL to cache
 */
export const storeLnurlInCache = (trackId, lnurl) => {
  LNURL_CACHE[trackId] = {
    lnurl,
    expiry: Date.now() + CACHE_EXPIRY
  };
};

/**
 * Clear the LNURL cache
 * @param {string} [trackId] - Optional specific track ID to clear, or clear all if not provided
 */
export const clearLnurlCache = (trackId = null) => {
  if (trackId) {
    delete LNURL_CACHE[trackId];
  } else {
    Object.keys(LNURL_CACHE).forEach(key => delete LNURL_CACHE[key]);
  }
}; 