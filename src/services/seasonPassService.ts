/**
 * Season Pass Service - Manages RUNSTR Season 1 participants
 * 
 * This service handles the participant list for RUNSTR Season 1.
 * Only users who have purchased a season pass (or been manually added)
 * will appear in feeds and leaderboards.
 * 
 * Storage: Uses localStorage with key 'seasonPassParticipants'
 * Data Format: Array of {pubkey: string, paymentDate: string} objects
 */

const STORAGE_KEY = 'seasonPassParticipants';

export interface SeasonPassParticipant {
  pubkey: string;
  paymentDate: string; // ISO 8601 date string
}

export interface SeasonPassService {
  isParticipant(pubkey: string): boolean;
  addParticipant(pubkey: string, paymentDate?: string): void;
  getParticipants(): string[];
  getParticipantsWithDates(): SeasonPassParticipant[];
  getParticipantPaymentDate(pubkey: string): string | null;
  removeParticipant(pubkey: string): void;
  clearAllParticipants(): void;
  getParticipantCount(): number;
}

/**
 * Mock participants for testing Phase 2
 */
const MOCK_PARTICIPANTS: SeasonPassParticipant[] = [
  {
    pubkey: 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum',
    paymentDate: '2025-07-01T00:00:00Z'
  },
  {
    pubkey: 'npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q9y7jlj',
    paymentDate: '2025-07-01T00:00:00Z'
  }
];

/**
 * Initialize mock participants if no participants exist
 * This is for testing Phase 2 - can be removed later
 */
const initializeMockParticipants = (): void => {
  try {
    const existingParticipants = getStoredParticipants();
    
    // Only add mock participants if storage is empty
    if (existingParticipants.length === 0) {
      console.log('[SeasonPassService] Initializing mock participants for testing');
      
      // Add mock participants using the existing mechanism
      MOCK_PARTICIPANTS.forEach(participant => {
        addParticipant(participant.pubkey, participant.paymentDate);
      });
      
      console.log(`[SeasonPassService] Added ${MOCK_PARTICIPANTS.length} mock participants`);
    } else {
      console.log(`[SeasonPassService] Found ${existingParticipants.length} existing participants, skipping mock initialization`);
    }
  } catch (error) {
    console.error('[SeasonPassService] Error initializing mock participants:', error);
  }
};

/**
 * Get the current list of participants from localStorage with backward compatibility
 * @returns Array of SeasonPassParticipant objects
 */
const getStoredParticipants = (): SeasonPassParticipant[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn('Season pass participants data is corrupted, resetting to empty array');
      return [];
    }
    
    // Handle backward compatibility - convert old string format to new object format
    const participants: SeasonPassParticipant[] = [];
    
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim().length > 0) {
        // Old format: just pubkey string, use default date
        participants.push({
          pubkey: item.trim(),
          paymentDate: '2025-07-01T00:00:00Z' // Default date for existing participants
        });
      } else if (typeof item === 'object' && item !== null && 
                 typeof item.pubkey === 'string' && 
                 typeof item.paymentDate === 'string') {
        // New format: object with pubkey and paymentDate
        participants.push({
          pubkey: item.pubkey.trim(),
          paymentDate: item.paymentDate
        });
      }
    }
    
    return participants;
  } catch (error) {
    console.error('Error reading season pass participants from localStorage:', error);
    return [];
  }
};

/**
 * Save the participants list to localStorage
 * @param participants Array of SeasonPassParticipant objects
 */
const saveParticipants = (participants: SeasonPassParticipant[]): void => {
  try {
    // Remove duplicates by pubkey and filter out invalid entries
    const cleanParticipants = participants
      .filter(p => p.pubkey && typeof p.pubkey === 'string' && p.pubkey.trim().length > 0)
      .filter(p => p.paymentDate && typeof p.paymentDate === 'string')
      .reduce((acc, current) => {
        const existing = acc.find(p => p.pubkey === current.pubkey);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, [] as SeasonPassParticipant[]);
    
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
  return participants.some(p => p.pubkey === pubkey.trim());
};

/**
 * Add a pubkey to the participants list
 * @param pubkey The public key to add
 * @param paymentDate Optional payment date (ISO 8601 string), defaults to current date
 */
const addParticipant = (pubkey: string, paymentDate?: string): void => {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('Invalid pubkey: must be a non-empty string');
  }
  
  const trimmedPubkey = pubkey.trim();
  if (trimmedPubkey.length === 0) {
    throw new Error('Invalid pubkey: cannot be empty');
  }
  
  const participants = getStoredParticipants();
  
  // Don't add if already exists
  if (participants.some(p => p.pubkey === trimmedPubkey)) {
    console.log(`Pubkey ${trimmedPubkey} is already a season pass participant`);
    return;
  }
  
  const newParticipant: SeasonPassParticipant = {
    pubkey: trimmedPubkey,
    paymentDate: paymentDate || new Date().toISOString()
  };
  
  participants.push(newParticipant);
  saveParticipants(participants);
  
  console.log(`Added new season pass participant: ${trimmedPubkey} (payment date: ${newParticipant.paymentDate})`);
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
  const filteredParticipants = participants.filter(p => p.pubkey !== trimmedPubkey);
  
  if (participants.length === filteredParticipants.length) {
    console.log(`Pubkey ${trimmedPubkey} was not in the participants list`);
    return;
  }
  
  saveParticipants(filteredParticipants);
  console.log(`Removed season pass participant: ${trimmedPubkey}`);
};

/**
 * Get the full list of participants (pubkeys only for backward compatibility)
 * @returns Array of pubkey strings
 */
const getParticipants = (): string[] => {
  return getStoredParticipants().map(p => p.pubkey);
};

/**
 * Get the full list of participants with payment dates
 * @returns Array of SeasonPassParticipant objects
 */
const getParticipantsWithDates = (): SeasonPassParticipant[] => {
  return getStoredParticipants();
};

/**
 * Get the payment date for a specific participant
 * @param pubkey The public key to look up
 * @returns Payment date string or null if not found
 */
const getParticipantPaymentDate = (pubkey: string): string | null => {
  if (!pubkey || typeof pubkey !== 'string') {
    return null;
  }
  
  const participants = getStoredParticipants();
  const participant = participants.find(p => p.pubkey === pubkey.trim());
  
  return participant ? participant.paymentDate : null;
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
  getParticipantsWithDates,
  getParticipantPaymentDate,
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
  getParticipantsWithDates,
  getParticipantPaymentDate,
  removeParticipant,
  clearAllParticipants,
  getParticipantCount,
  STORAGE_KEY
}; 

// Initialize mock participants when the service is loaded (Phase 2 testing)
// This can be removed in later phases
initializeMockParticipants(); 