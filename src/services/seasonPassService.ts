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

import * as nip19 from 'nostr-tools/nip19';

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
 * Helper function to convert npub to hex format
 */
const convertNpubToHex = (npub: string): string => {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      return decoded.data;
    }
    throw new Error('Invalid npub format');
  } catch (err) {
    console.error('Error converting npub to hex:', err);
    throw err;
  }
};

/**
 * Default Season Pass participants
 * These are the founding participants who purchased season passes
 */
const DEFAULT_PARTICIPANTS: SeasonPassParticipant[] = [
  {
    // npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum
    pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
    paymentDate: '2025-07-01T00:00:00.000Z'
  },
  {
    // npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q9y7jlj
    pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
    paymentDate: '2025-07-01T00:00:00.000Z'
  }
];

/**
 * Get stored participants from localStorage with backward compatibility
 * Handles both old format (string[]) and new format (SeasonPassParticipant[])
 * Ensures default participants are always included
 */
const getStoredParticipants = (): SeasonPassParticipant[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let participants: SeasonPassParticipant[] = [];
    
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Handle backward compatibility: if stored data is string array, convert to new format
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          // Old format: convert string[] to SeasonPassParticipant[]
          participants = parsed.map((pubkey: string) => ({
            pubkey,
            paymentDate: new Date().toISOString() // Default to current date for existing participants
          }));
        } else {
          // Already in new format
          participants = parsed as SeasonPassParticipant[];
        }
      }
    }
    
    // Ensure default participants are always included
    let needsUpdate = false;
    DEFAULT_PARTICIPANTS.forEach(defaultParticipant => {
      const exists = participants.some(p => p.pubkey === defaultParticipant.pubkey);
      if (!exists) {
        participants.push(defaultParticipant);
        needsUpdate = true;
      }
    });
    
    // Save if we added default participants
    if (needsUpdate) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
    }
    
    return participants;
  } catch (err) {
    console.error('Error loading participants from storage:', err);
    // Return default participants if localStorage fails
    return [...DEFAULT_PARTICIPANTS];
  }
};

/**
 * Save participants to localStorage
 * @param participants Array of participants to save
 */
const saveParticipants = (participants: SeasonPassParticipant[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
  } catch (err) {
    console.error('Error saving participants to storage:', err);
  }
};

/**
 * Check if a pubkey is a Season Pass participant
 * @param pubkey The public key to check (hex format)
 * @returns True if the pubkey is a participant
 */
const isParticipant = (pubkey: string): boolean => {
  if (!pubkey || typeof pubkey !== 'string') {
    return false;
  }
  
  const participants = getStoredParticipants();
  return participants.some(participant => participant.pubkey === pubkey.trim());
};

/**
 * Add a participant to the Season Pass list
 * @param pubkey The public key to add (hex format)
 * @param paymentDate Optional payment date (ISO 8601 string). Defaults to current time.
 */
const addParticipant = (pubkey: string, paymentDate?: string): void => {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('Invalid pubkey provided');
  }
  
  const trimmedPubkey = pubkey.trim();
  const participants = getStoredParticipants();
  
  // Check if already exists
  if (participants.some(p => p.pubkey === trimmedPubkey)) {
    console.warn('Participant already exists:', trimmedPubkey);
    return;
  }
  
  // Add new participant
  const newParticipant: SeasonPassParticipant = {
    pubkey: trimmedPubkey,
    paymentDate: paymentDate || new Date().toISOString()
  };
  
  participants.push(newParticipant);
  saveParticipants(participants);
};

/**
 * Get all participants (pubkeys only for backward compatibility)
 * @returns Array of participant pubkeys
 */
const getParticipants = (): string[] => {
  const participants = getStoredParticipants();
  return participants.map(p => p.pubkey);
};

/**
 * Get all participants with their payment dates
 * @returns Array of participant objects with pubkey and paymentDate
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
 * Remove a participant from the Season Pass list
 * @param pubkey The public key to remove
 */
const removeParticipant = (pubkey: string): void => {
  if (!pubkey || typeof pubkey !== 'string') {
    return;
  }
  
  const participants = getStoredParticipants();
  const filtered = participants.filter(p => p.pubkey !== pubkey.trim());
  
  if (filtered.length !== participants.length) {
    saveParticipants(filtered);
  }
};

/**
 * Clear all participants except default ones
 */
const clearAllParticipants = (): void => {
  saveParticipants([...DEFAULT_PARTICIPANTS]);
};

/**
 * Get the total number of participants
 * @returns Number of participants
 */
const getParticipantCount = (): number => {
  return getStoredParticipants().length;
};

// Export the service
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