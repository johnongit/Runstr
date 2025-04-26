/**
 * Feed fetching utility for RUNSTR
 * Provides optimized direct fetching methods specifically for feed posts
 * without modifying existing Nostr functionality
 */
import { ndk } from './nostr';
import { relays } from './nostrClient';

/**
 * Get fastest relays based on performance metrics
 * @param {number} count - Number of fast relays to return
 * @returns {Array} Array of fastest relay URLs
 */
export const getFastestRelays = (count = 3) => {
  try {
    const metricsStr = localStorage.getItem('relayPerformance');
    if (!metricsStr) return relays.slice(0, count);
    
    const metrics = JSON.parse(metricsStr);
    if (Object.keys(metrics).length === 0) return relays.slice(0, count);
    
    // Calculate average response times
    const relayScores = Object.entries(metrics)
      .map(([relay, data]) => {
        const avgTime = data.count > 0 ? data.totalTime / data.count : Infinity;
        // Add recency bonus - prefer recently used relays
        const recencyFactor = Date.now() - (data.lastUpdated || 0) < 24 * 60 * 60 * 1000 ? 0.7 : 1;
        return {
          relay,
          score: avgTime * recencyFactor // Lower score is better
        };
      })
      // Only include relays that are in our active list
      .filter(item => relays.includes(item.relay))
      // Sort by score (fastest first)
      .sort((a, b) => a.score - b.score)
      // Take the requested number
      .slice(0, count)
      // Extract just the URLs
      .map(item => item.relay);
    
    console.log('Using fastest relays:', relayScores);
    return relayScores.length > 0 ? relayScores : relays.slice(0, count);
  } catch (err) {
    console.warn('Error getting fastest relays:', err);
    // Fall back to first few relays from default list
    return relays.slice(0, count);
  }
};

/**
 * Direct fetch implementation with aggressive timeouts
 * @param {number} limit - Maximum number of posts to fetch
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of events
 */
export const directFetchRunningPosts = async (limit = 10, days = 7) => {
  try {
    // Apply a shorter time window (7 days instead of 14-30)
    const sinceTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
    
    // Create filter focusing on runstr hashtag only
    const filter = {
      kinds: [1], // Regular posts
      limit: limit,
      "#t": ["runstr"], // Only the runstr hashtag
      since: sinceTime
    };
    
    // Get fastest relays based on performance metrics
    const fastRelays = getFastestRelays(3);
    console.log(`Direct fetching from fastest relays: ${fastRelays.join(', ')}`);
    
    // Use faster direct fetch with aggressive timeout
    const events = await ndk.fetchEvents(filter, { 
      relays: fastRelays,
      timeout: 5000 // Aggressive 5-second timeout
    });
    
    // Convert to array and sort by created_at (newest first)
    const eventArray = Array.from(events)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
    
    console.log(`Direct fetch found ${eventArray.length} #runstr posts`);
    return eventArray;
  } catch (err) {
    console.error('Direct fetch error:', err);
    return [];
  }
};

/**
 * Fetch from a specific relay with timeout
 * @param {string} relay - Relay URL
 * @param {number} limit - Maximum number of posts
 * @param {number} since - Unix timestamp to fetch from
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} Array of events
 */
export const fetchFromRelay = async (relay, limit = 10, since, timeout = 3000) => {
  try {
    // Create filter focusing on runstr hashtag only
    const filter = {
      kinds: [1], // Regular posts
      limit: limit,
      "#t": ["runstr"], // Only the runstr hashtag
      since
    };
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Relay timeout')), timeout);
    });
    
    // Race between fetch and timeout
    const events = await Promise.race([
      ndk.fetchEvents(filter, { relays: [relay] }),
      timeoutPromise
    ]);
    
    // Convert to array
    const eventArray = Array.from(events);
    console.log(`Fetched ${eventArray.length} posts from ${relay}`);
    return eventArray;
  } catch (err) {
    console.warn(`Error fetching from relay ${relay}:`, err.message);
    return [];
  }
}; 