/**
 * Feed caching utility for RUNSTR
 * Provides isolated localStorage caching for feed data
 * with expiration and version control
 */

// Namespaced cache keys to avoid conflicts with Teams or other features
export const FEED_CACHE_KEY = 'runstr_feed_cache_v1';
export const FEED_CACHE_METADATA_KEY = 'runstr_feed_cache_meta_v1';

/**
 * Store feed data in localStorage with expiration
 * @param {Array} posts - Processed posts to cache
 * @param {number} ttlMinutes - Cache time-to-live in minutes
 * @returns {boolean} Success status
 */
export const storeFeedCache = (posts, ttlMinutes = 60) => {
  try {
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return false;
    }
    
    const now = Date.now();
    // Store posts
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(posts));
    
    // Store metadata with expiration
    localStorage.setItem(FEED_CACHE_METADATA_KEY, JSON.stringify({
      timestamp: now,
      expiry: now + (ttlMinutes * 60 * 1000),
      count: posts.length,
      version: 1
    }));
    
    console.log(`Cached ${posts.length} posts in localStorage (expires in ${ttlMinutes} minutes)`);
    return true;
  } catch (err) {
    console.error('Feed cache storage error:', err);
    // Try to clear cache if storage fails (might be quota exceeded)
    try {
      localStorage.removeItem(FEED_CACHE_KEY);
      localStorage.removeItem(FEED_CACHE_METADATA_KEY);
    } catch (_) {
      // Ignore cleanup errors
    }
    return false;
  }
};

/**
 * Get cached feed data if valid and not expired
 * @param {number} maxAgeMinutes - Maximum age of cache in minutes
 * @returns {Array|null} Cached posts or null if invalid/expired
 */
export const getFeedCache = (maxAgeMinutes = 60) => {
  try {
    const metaStr = localStorage.getItem(FEED_CACHE_METADATA_KEY);
    if (!metaStr) return null;
    
    const meta = JSON.parse(metaStr);
    const now = Date.now();
    
    // Check if cache exists and is within maxAge
    if (meta.expiry && meta.expiry > now) {
      const cachedData = JSON.parse(localStorage.getItem(FEED_CACHE_KEY) || '[]');
      if (cachedData.length > 0) {
        console.log(`Using ${cachedData.length} cached posts from localStorage`);
        return cachedData;
      }
    }
    return null;
  } catch (err) {
    console.error('Feed cache retrieval error:', err);
    return null;
  }
};

/**
 * Check if the cache is fresh (recently updated)
 * @param {number} freshnessMinutes - How recent the cache should be in minutes
 * @returns {boolean} Whether cache is fresh
 */
export const isCacheFresh = (freshnessMinutes = 15) => {
  try {
    const metaStr = localStorage.getItem(FEED_CACHE_METADATA_KEY);
    if (!metaStr) return false;
    
    const meta = JSON.parse(metaStr);
    const now = Date.now();
    const ageInMs = now - meta.timestamp;
    
    return ageInMs < (freshnessMinutes * 60 * 1000);
  } catch (err) {
    console.error('Feed cache freshness check error:', err);
    return false;
  }
};

/**
 * Clear the feed cache
 * @returns {boolean} Success status
 */
export const clearFeedCache = () => {
  try {
    localStorage.removeItem(FEED_CACHE_KEY);
    localStorage.removeItem(FEED_CACHE_METADATA_KEY);
    return true;
  } catch (err) {
    console.error('Feed cache clear error:', err);
    return false;
  }
}; 