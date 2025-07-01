/**
 * Season Pass Service - Manages RUNSTR Season 1 participants
 * 
 * This service handles the participant list for RUNSTR Season 1.
 * Only users who have purchased a season pass (or been manually added)
 * will appear in feeds and leaderboards.
 * 
 * Storage: Uses localStorage with key 'seasonPassParticipants'
 * Data Format: Array of pubkey strings
 */

const STORAGE_KEY = 'seasonPassParticipants';

export interface SeasonPassService {
  isParticipant(pubkey: string): boolean;
  addParticipant(pubkey: string): void;
  getParticipants(): string[];
  removeParticipant(pubkey: string): void;
  clearAllParticipants(): void;
  getParticipantCount(): number;
}

/**
 * Get the current list of participants from localStorage
 * @returns Array of pubkey strings
 */
const getStoredParticipants = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate that it's an array of strings
    if (!Array.isArray(parsed)) {
      console.warn('Season pass participants data is corrupted, resetting to empty array');
      return [];
    }
    
    // Filter out any non-string values
    return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
  } catch (error) {
    console.error('Error reading season pass participants from localStorage:', error);
    return [];
  }
};

/**
 * Save the participants list to localStorage
 * @param participants Array of pubkey strings
 */
const saveParticipants = (participants: string[]): void => {
  try {
    // Remove duplicates and filter out empty strings
    const cleanParticipants = [...new Set(participants)]
      .filter(pubkey => typeof pubkey === 'string' && pubkey.trim().length > 0);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanParticipants));
  } catch (error) {
    console.error('Error saving season pass participants to localStorage:', error);
    throw new Error('Failed to save participant data');
  }
};

/**
 * Check if a pubkey is in the participants list
 * @param pubkey The public key to check
 * @returns true if the pubkey is a participant, false otherwise
 */
const isParticipant = (pubkey: string): boolean => {
  if (!pubkey || typeof pubkey !== 'string') {
    return false;
  }
  
  const participants = getStoredParticipants();
  return participants.includes(pubkey.trim());
};

/**
 * Add a pubkey to the participants list
 * @param pubkey The public key to add
 */
const addParticipant = (pubkey: string): void => {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('Invalid pubkey: must be a non-empty string');
  }
  
  const trimmedPubkey = pubkey.trim();
  if (trimmedPubkey.length === 0) {
    throw new Error('Invalid pubkey: cannot be empty');
  }
  
  const participants = getStoredParticipants();
  
  // Don't add if already exists
  if (participants.includes(trimmedPubkey)) {
    console.log(`Pubkey ${trimmedPubkey} is already a season pass participant`);
    return;
  }
  
  participants.push(trimmedPubkey);
  saveParticipants(participants);
  
  console.log(`Added new season pass participant: ${trimmedPubkey}`);
};

/**
 * Remove a pubkey from the participants list
 * @param pubkey The public key to remove
 */
const removeParticipant = (pubkey: string): void => {
  if (!pubkey || typeof pubkey !== 'string') {
    console.warn('Invalid pubkey provided to removeParticipant');
    return;
  }
  
  const trimmedPubkey = pubkey.trim();
  const participants = getStoredParticipants();
  const filteredParticipants = participants.filter(p => p !== trimmedPubkey);
  
  if (participants.length === filteredParticipants.length) {
    console.log(`Pubkey ${trimmedPubkey} was not in the participants list`);
    return;
  }
  
  saveParticipants(filteredParticipants);
  console.log(`Removed season pass participant: ${trimmedPubkey}`);
};

/**
 * Get the full list of participants
 * @returns Array of pubkey strings
 */
const getParticipants = (): string[] => {
  return getStoredParticipants();
};

/**
 * Clear all participants (admin/testing function)
 */
const clearAllParticipants = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Cleared all season pass participants');
  } catch (error) {
    console.error('Error clearing season pass participants:', error);
    throw new Error('Failed to clear participant data');
  }
};

/**
 * Get the current number of participants
 * @returns Number of participants
 */
const getParticipantCount = (): number => {
  return getStoredParticipants().length;
};

// Export the service object
const seasonPassService: SeasonPassService = {
  isParticipant,
  addParticipant,
  getParticipants,
  removeParticipant,
  clearAllParticipants,
  getParticipantCount
};

export default seasonPassService;

// Also export individual functions for easier testing
export {
  isParticipant,
  addParticipant,
  getParticipants,
  removeParticipant,
  clearAllParticipants,
  getParticipantCount,
  STORAGE_KEY
}; 