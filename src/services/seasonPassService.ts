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
 * Get stored participants from localStorage with backward compatibility
 * Handles both old format (string[]) and new format (SeasonPassParticipant[])
 */
const getStoredParticipants = (): SeasonPassParticipant[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    
    // Handle backward compatibility: if stored data is string array, convert to new format
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'string') {
        // Old format: convert string[] to SeasonPassParticipant[]
        const converted = parsed.map((pubkey: string) => ({
          pubkey,
          paymentDate: new Date().toISOString() // Default to current date for existing participants
        }));
        
        // Save in new format
        localStorage.setItem(STORAGE_KEY, JSON.stringify(converted));
        return converted;
      }
      
      // Already in new format
      return parsed as SeasonPassParticipant[];
    }
    
    return [];
  } catch (err) {
    console.error('Error loading participants from storage:', err);
    return [];
  }
};

/**
 * Save participants to localStorage
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
 * Clear all participants (admin function)
 */
const clearAllParticipants = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Get the total number of participants
 * @returns Number of Season Pass participants
 */
const getParticipantCount = (): number => {
  const participants = getStoredParticipants();
  return participants.length;
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