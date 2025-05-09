/**
 * Feed post processing utility for RUNSTR
 * Provides lightweight processing methods for faster initial display
 * without sacrificing existing rich functionality
 */

/**
 * Lightweight post processor for initial fast display
 * Creates minimal post objects with placeholders for supplementary data
 * @param {Array} posts - Raw post events from Nostr
 * @returns {Array} Minimally processed posts ready for display
 */
export const lightweightProcessPosts = (posts) => {
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return [];
  }
  
  // Extract just the essential data for display
  return posts.map(post => ({
    id: post.id || `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    content: post.content || '',
    created_at: post.created_at || Math.floor(Date.now() / 1000),
    pubkey: post.pubkey || '',
    author: {
      pubkey: post.pubkey || '',
      profile: { 
        name: 'Loading...', // Placeholder for profile data
        picture: undefined
      }
    },
    // Basic placeholders for UI that will be filled in later
    comments: [],
    showComments: false,
    commentsLoaded: false,
    likes: 0,
    reposts: 0,
    zaps: 0,
    zapAmount: 0,
    images: extractImagesFromContent(post.content || ''),
    _needsEnrichment: true // Flag for background enhancement
  })).sort((a, b) => b.created_at - a.created_at);
};

/**
 * Extract image URLs from post content
 * @param {string} content - Post content
 * @returns {Array} Array of image URLs
 */
const extractImagesFromContent = (content) => {
  if (!content) return [];
  
  // Simple regex to find image URLs in content
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  return content.match(urlRegex) || [];
};

/**
 * Merge basic posts with fully processed ones
 * Replaces basic data with enriched data while preserving post order
 * @param {Array} basicPosts - Posts with basic processing
 * @param {Array} fullyProcessedPosts - Posts with complete supplementary data
 * @returns {Array} Merged posts array
 */
export const mergeProcessedPosts = (basicPosts, fullyProcessedPosts) => {
  if (!fullyProcessedPosts || !Array.isArray(fullyProcessedPosts) || fullyProcessedPosts.length === 0) {
    return basicPosts;
  }
  
  if (!basicPosts || !Array.isArray(basicPosts) || basicPosts.length === 0) {
    return fullyProcessedPosts;
  }
  
  // Create map for quick lookup by ID
  const processedMap = new Map(
    fullyProcessedPosts.map(post => [post.id, post])
  );
  
  // Replace basic posts with processed ones where available
  return basicPosts.map(post => 
    processedMap.has(post.id) ? processedMap.get(post.id) : post
  );
};

/**
 * Update individual post with enriched data
 * @param {Object} basicPost - Basic post object
 * @param {Object} enrichedData - Enriched data for the post
 * @returns {Object} Updated post
 */
export const enrichPost = (basicPost, enrichedData) => {
  if (!basicPost || !enrichedData) return basicPost;
  
  // Return merged data, keeping the original post's ID and content
  return {
    ...basicPost,
    ...enrichedData,
    id: basicPost.id, // Ensure ID is preserved
    content: basicPost.content, // Ensure content is preserved
    _needsEnrichment: false
  };
}; 