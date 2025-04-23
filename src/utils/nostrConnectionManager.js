/**
 * nostrConnectionManager.js
 * 
 * Centralized manager for Nostr connections to prioritize and coordinate operations
 * between different features (Auth, Teams, Feed, etc.)
 */

// Track operations by priority
const activeOperations = {
  auth: 0,      // Priority 0 (highest) - Authentication operations
  teams: 0,     // Priority 1 - Teams chat functionality 
  feed: 0,      // Priority 2 - Feed operations
  background: 0 // Priority 3 (lowest) - Background operations
};

// Connection status
let isConnected = false;

/**
 * Start a Nostr operation with the specified priority
 * @param {string} type - Type of operation ('auth', 'teams', 'feed', 'background')
 * @returns {boolean} Whether the operation should proceed
 */
export const startOperation = (type) => {
  if (!type || !activeOperations.hasOwnProperty(type)) {
    console.warn(`Invalid operation type: ${type}`);
    return false;
  }
  
  activeOperations[type]++;
  console.log(`Started ${type} operation. Active: ${JSON.stringify(activeOperations)}`);
  
  // Determine if this operation should proceed based on priority
  // Auth operations always proceed
  if (type === 'auth') return true;
  
  // Teams operations proceed if no auth operations are active
  if (type === 'teams') return activeOperations.auth === 0;
  
  // Feed operations proceed if no auth or teams operations are active
  if (type === 'feed') return activeOperations.auth === 0 && activeOperations.teams === 0;
  
  // Background operations have lowest priority
  if (type === 'background') {
    return activeOperations.auth === 0 && 
           activeOperations.teams === 0 && 
           activeOperations.feed === 0;
  }
  
  return false;
};

/**
 * End a Nostr operation of the specified type
 * @param {string} type - Type of operation ('auth', 'teams', 'feed', 'background')
 */
export const endOperation = (type) => {
  if (!type || !activeOperations.hasOwnProperty(type)) {
    console.warn(`Invalid operation type: ${type}`);
    return;
  }
  
  if (activeOperations[type] > 0) {
    activeOperations[type]--;
  }
  
  console.log(`Ended ${type} operation. Active: ${JSON.stringify(activeOperations)}`);
};

/**
 * Check if operations of a certain type are currently active
 * @param {string} type - Type of operation ('auth', 'teams', 'feed', 'background')
 * @returns {boolean} Whether operations of the specified type are active
 */
export const isOperationActive = (type) => {
  if (!type || !activeOperations.hasOwnProperty(type)) {
    console.warn(`Invalid operation type: ${type}`);
    return false;
  }
  
  return activeOperations[type] > 0;
};

/**
 * Check if a type of operation should yield based on priority
 * @param {string} type - Type of operation ('auth', 'teams', 'feed', 'background')
 * @returns {boolean} Whether the operation should yield
 */
export const shouldYield = (type) => {
  if (!type || !activeOperations.hasOwnProperty(type)) {
    console.warn(`Invalid operation type: ${type}`);
    return true; // Unknown operations should yield
  }
  
  // Auth operations never yield
  if (type === 'auth') return false;
  
  // Teams operations yield to auth
  if (type === 'teams') return activeOperations.auth > 0;
  
  // Feed operations yield to auth and teams
  if (type === 'feed') return activeOperations.auth > 0 || activeOperations.teams > 0;
  
  // Background operations yield to everything else
  if (type === 'background') {
    return activeOperations.auth > 0 || 
           activeOperations.teams > 0 || 
           activeOperations.feed > 0;
  }
  
  return true;
};

/**
 * Set the connection status
 * @param {boolean} status - Whether Nostr is connected
 */
export const setConnectionStatus = (status) => {
  isConnected = status;
};

/**
 * Get the current connection status
 * @returns {boolean} Whether Nostr is connected
 */
export const getConnectionStatus = () => {
  return isConnected;
};

export default {
  startOperation,
  endOperation,
  isOperationActive,
  shouldYield,
  setConnectionStatus,
  getConnectionStatus
}; 