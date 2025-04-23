/**
 * globalFeedState.js
 * 
 * Enhanced global feed state management with improved caching
 * and organized supplementary data storage
 */

// Main state container
const feedState = {
  // Post data
  allPosts: [],
  lastFetchTime: 0,
  
  // Supplementary data
  profiles: {}, // profileId -> profile data
  likes: {},    // postId -> array of likes
  reposts: {},  // postId -> array of reposts
  comments: {}, // postId -> array of comments
  
  // Connection state
  isInitialized: false,
  activeSubscription: null,
  isLoading: false,
  loadingProgress: 0,
  error: null,

  // Preloading state
  preloadStarted: false,
  preloadComplete: false,
  preloadedPostCount: 0,
  isPreloading: false
};

// Constants
export const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes cache validity

/**
 * Get all cached posts
 * @returns {Array} Array of post objects
 */
export const getCachedPosts = () => {
  return feedState.allPosts || [];
};

/**
 * Check if cache is valid
 * @returns {boolean} Whether the cache is valid and recent
 */
export const isCacheValid = () => {
  const now = Date.now();
  return feedState.allPosts.length > 0 && 
         (now - feedState.lastFetchTime < CACHE_DURATION_MS);
};

/**
 * Set cached posts
 * @param {Array} posts - Array of post objects
 */
export const setCachedPosts = (posts) => {
  if (Array.isArray(posts)) {
    feedState.allPosts = posts;
    feedState.lastFetchTime = Date.now();
  }
};

/**
 * Add posts to the cache, preserving existing posts
 * @param {Array} newPosts - Array of new post objects to add
 * @returns {Array} Updated array of all posts
 */
export const addPostsToCache = (newPosts) => {
  if (!Array.isArray(newPosts) || newPosts.length === 0) return feedState.allPosts;
  
  // Add only posts that aren't already in the cache
  const existingIds = new Set(feedState.allPosts.map(p => p.id));
  const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
  
  if (uniqueNewPosts.length > 0) {
    // Add new posts to the beginning (they're typically newer)
    feedState.allPosts = [...uniqueNewPosts, ...feedState.allPosts];
    feedState.lastFetchTime = Date.now();
  }
  
  return feedState.allPosts;
};

/**
 * Get supplementary data by type and ID
 * @param {string} type - Type of data ('profiles', 'likes', 'reposts', 'comments')
 * @param {string} id - ID to look up
 * @returns {any} The requested data or undefined
 */
export const getSupplementaryData = (type, id) => {
  if (!feedState[type] || !id) return undefined;
  return feedState[type][id];
};

/**
 * Set supplementary data by type and ID
 * @param {string} type - Type of data ('profiles', 'likes', 'reposts', 'comments')
 * @param {string} id - ID to store under
 * @param {any} data - The data to store
 */
export const setSupplementaryData = (type, id, data) => {
  if (!feedState[type] || !id) return;
  feedState[type][id] = data;
};

/**
 * Store supplementary data for multiple items
 * @param {Object} data - Object containing supplementary data
 */
export const storeSupplementaryData = (data) => {
  if (!data) return;
  
  // Store profiles
  if (data.profiles && typeof data.profiles === 'object') {
    Object.entries(data.profiles).forEach(([id, profile]) => {
      feedState.profiles[id] = profile;
    });
  }
  
  // Store likes
  if (Array.isArray(data.likes)) {
    data.likes.forEach(like => {
      try {
        const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          if (!feedState.likes[postId]) {
            feedState.likes[postId] = [];
          }
          
          // Avoid duplicates
          const existingIndex = feedState.likes[postId].findIndex(l => l.id === like.id);
          if (existingIndex === -1) {
            feedState.likes[postId].push(like);
          }
        }
      } catch (err) {
        console.error('Error processing like for cache:', err);
      }
    });
  }
  
  // Store reposts
  if (Array.isArray(data.reposts)) {
    data.reposts.forEach(repost => {
      try {
        const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          if (!feedState.reposts[postId]) {
            feedState.reposts[postId] = [];
          }
          
          // Avoid duplicates
          const existingIndex = feedState.reposts[postId].findIndex(r => r.id === repost.id);
          if (existingIndex === -1) {
            feedState.reposts[postId].push(repost);
          }
        }
      } catch (err) {
        console.error('Error processing repost for cache:', err);
      }
    });
  }
  
  // Store comments
  if (Array.isArray(data.comments)) {
    data.comments.forEach(comment => {
      try {
        const postId = comment.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          if (!feedState.comments[postId]) {
            feedState.comments[postId] = [];
          }
          
          // Avoid duplicates
          const existingIndex = feedState.comments[postId].findIndex(c => c.id === comment.id);
          if (existingIndex === -1) {
            feedState.comments[postId].push(comment);
          }
        }
      } catch (err) {
        console.error('Error processing comment for cache:', err);
      }
    });
  }
};

/**
 * Set the loading state
 * @param {boolean} isLoading - Whether the feed is currently loading
 */
export const setLoading = (isLoading) => {
  feedState.isLoading = isLoading;
};

/**
 * Set the initialization state
 * @param {boolean} isInitialized - Whether Nostr is initialized
 */
export const setInitialized = (isInitialized) => {
  feedState.isInitialized = isInitialized;
};

/**
 * Set loading progress (0-100)
 * @param {number} progress - Loading progress (0-100)
 */
export const setLoadingProgress = (progress) => {
  feedState.loadingProgress = Math.max(0, Math.min(100, progress));
};

/**
 * Set preloading state
 * @param {boolean} isPreloading - Whether preloading is active
 */
export const setPreloading = (isPreloading) => {
  feedState.isPreloading = isPreloading;
  
  if (isPreloading) {
    feedState.preloadStarted = true;
  }
};

/**
 * Mark preloading as complete
 */
export const completePreload = () => {
  feedState.preloadComplete = true;
  feedState.isPreloading = false;
};

/**
 * Update preloaded post count
 * @param {number} count - Number of posts preloaded
 */
export const updatePreloadedCount = (count) => {
  feedState.preloadedPostCount = count;
};

/**
 * Get the current feed state
 * @returns {Object} The current feed state
 */
export const getFeedState = () => {
  return { ...feedState };
};

export default {
  getCachedPosts,
  isCacheValid,
  setCachedPosts,
  addPostsToCache,
  getSupplementaryData,
  setSupplementaryData,
  storeSupplementaryData,
  setLoading,
  setInitialized,
  setLoadingProgress,
  setPreloading,
  completePreload,
  updatePreloadedCount,
  getFeedState,
  CACHE_DURATION_MS
}; 