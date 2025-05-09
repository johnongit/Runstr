import { REWARDS } from '../config/rewardsConfig';
import rewardsPayoutService, { TransactionType } from './rewardsPayoutService';
import transactionService, { TRANSACTION_TYPES } from './transactionService';
import { createAndPublishEvent } from '../utils/nostr.js'; // Import actual Nostr utility

// Placeholder for Nostr Service - REMOVED
// const nostrService = { ... };
// --- End Placeholder ---

const EVENT_ID = 'EVENT_100K'; // Use key from REWARDS config
const EVENT_STORAGE_KEY = `eventProgress_${EVENT_ID}`;

// Define the structure for event progress data
export interface EventProgressData {
  userPubkey: string;
  registered: boolean;
  registrationDate: string | null;
  registrationTxId: string | null;
  totalKm: number;
  finished: boolean;
  finishDate: string | null;
  payoutTxId: string | null;
}

/**
 * Get event progress data from localStorage.
 * @returns {EventProgressData | null} The current event progress or null if not registered.
 */
const getEventProgress = (): EventProgressData | null => {
  try {
    const storedData = localStorage.getItem(EVENT_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : null;
  } catch (err) {
    console.error(`Error loading event progress for ${EVENT_ID}:`, err);
    return null;
  }
};

/**
 * Save event progress data to localStorage.
 * @param {EventProgressData} data - The event progress data to save.
 * @returns {boolean} Success status.
 */
const saveEventProgress = (data: EventProgressData): boolean => {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`Error saving event progress for ${EVENT_ID}:`, err);
    return false;
  }
};

const event100kService = {
  EVENT_ID,
  config: REWARDS.EVENT_100K,

  /**
   * Check if the user is currently registered for the event.
   * @returns {boolean}
   */
  isRegistered: (): boolean => {
    const progress = getEventProgress();
    return !!progress?.registered;
  },

  /**
   * Get the user's current progress for the event.
   * @returns {EventProgressData | null}
   */
  getProgress: (): EventProgressData | null => {
    return getEventProgress();
  },

  /**
   * Register the user for the event.
   * Handles payment of the registration fee.
   * @param {string} userPubkey - The public key of the user registering.
   * @returns {Promise<{success: boolean, error?: string, txid?: string}>}
   */
  register: async (userPubkey: string): Promise<{success: boolean, error?: string, txid?: string}> => {
    if (event100kService.isRegistered()) {
      return { success: false, error: 'Already registered for the event.' };
    }

    const now = new Date();
    const eventStart = new Date(REWARDS.EVENT_100K.startUtc);
    const eventEnd = new Date(REWARDS.EVENT_100K.endUtc);

    if (now < eventStart || now > eventEnd) {
        return { success: false, error: `Event registration is only open between ${eventStart.toLocaleDateString()} and ${eventEnd.toLocaleDateString()}.` };
    }

    // Process the registration fee payment
    // NOTE: Assumes the fee is paid *by* the user *to* RUNSTR.
    // The `sendEventTransaction` needs the *payer's* pubkey and a negative amount,
    // or adjust `transactionService.processReward` to handle the recipient correctly.
    // For now, assuming `sendEventTransaction` handles the fee payment correctly.
    // A dedicated RUNSTR pubkey should be configured for receiving fees.
    const feeResult = await rewardsPayoutService.sendEventTransaction(
      userPubkey, // User paying the fee
      REWARDS.EVENT_100K.regFee, // Fee amount (positive, service might flip sign or use type)
      EVENT_ID,
      TRANSACTION_TYPES.EVENT_REGISTRATION_FEE as TransactionType,
      `Registration fee for ${EVENT_ID}`
    );

    if (!feeResult.success) {
      return { success: false, error: feeResult.error || 'Failed to process registration fee.' };
    }

    // Save initial progress
    const initialProgress: EventProgressData = {
      userPubkey: userPubkey,
      registered: true,
      registrationDate: now.toISOString(),
      registrationTxId: feeResult.txid || null,
      totalKm: 0,
      finished: false,
      finishDate: null,
      payoutTxId: null,
    };
    saveEventProgress(initialProgress);

    // Trigger Nostr actions
    const registrationEvent = {
      kind: 31000, // Custom kind for Runstr Event Registration
      content: `Registered for the RUNSTR 100km May-June Challenge!`,
      tags: [
        ['e', EVENT_ID, REWARDS.EVENT_100K.nostrRelay || ''], // Event ID, optionally with a recommended relay for the event
        ['name', '100km May-June Challenge Registration'],
        ['description', 'User registered for the RUNSTR 100km challenge.'],
        ['status', 'registered'],
        ['client', 'runstr']
      ],
    };
    createAndPublishEvent(registrationEvent, userPubkey)
      .then(result => console.log('[Event100k] Nostr registration event published:', result))
      .catch(err => console.error('[Event100k] Error publishing Nostr registration event:', err));

    return { success: true, txid: feeResult.txid };
  },

  /**
   * Add distance to the user's event progress.
   * Should be called after a valid run is saved.
   * @param {number} distanceKm - The distance of the run in kilometers.
   * @returns {EventProgressData | null} Updated progress or null if not registered/event inactive.
   */
  addDistance: (distanceKm: number): EventProgressData | null => {
    const progress = getEventProgress();
    if (!progress || !progress.registered || progress.finished) {
      return progress;
    }

    const now = new Date();
    const eventStart = new Date(REWARDS.EVENT_100K.startUtc);
    const eventEnd = new Date(REWARDS.EVENT_100K.endUtc);

    if (now < eventStart || now > eventEnd) {
        console.log('Run recorded outside of event dates, not counting towards event progress.');
        return progress;
    }
    
    const registrationDate = progress.registrationDate ? new Date(progress.registrationDate) : null;
    if (!registrationDate || now < registrationDate) {
        console.log('Run recorded before registration date, not counting towards event progress.');
        return progress;
    }

    const updatedProgress: EventProgressData = {
      ...progress,
      totalKm: progress.totalKm + distanceKm,
    };

    if (!updatedProgress.finished && updatedProgress.totalKm >= REWARDS.EVENT_100K.distanceKm) {
      updatedProgress.finished = true;
      updatedProgress.finishDate = now.toISOString();
      
      const finishEvent = {
        kind: 31001, // Custom kind for Runstr Event Finish
        content: `Finished the RUNSTR 100km May-June Challenge with ${updatedProgress.totalKm.toFixed(2)}km!`,
        tags: [
          ['e', EVENT_ID, REWARDS.EVENT_100K.nostrRelay || ''], // Event ID
          ['name', '100km May-June Challenge Finish'],
          ['description', `User finished the RUNSTR 100km challenge with ${updatedProgress.totalKm.toFixed(2)}km.`],
          ['status', 'finished'],
          ['total_km', updatedProgress.totalKm.toFixed(2)],
          ['client', 'runstr']
        ],
      };
      createAndPublishEvent(finishEvent, updatedProgress.userPubkey)
        .then(result => console.log('[Event100k] Nostr finish event published:', result))
        .catch(err => console.error('[Event100k] Error publishing Nostr finish event:', err));
    }

    saveEventProgress(updatedProgress);
    return updatedProgress;
  },

  /**
   * Checks all finished participants after the event end date and triggers payouts.
   * Intended to be called by a trusted scheduler/backend process.
   * @returns {Promise<{success: boolean, payouts: Array<object>}>}
   */
  processEventPayouts: async (): Promise<{success: boolean, payouts: Array<object>}> => {
    const now = new Date();
    const eventEnd = new Date(REWARDS.EVENT_100K.endUtc);

    // Only run payouts after the event has officially ended
    if (now <= eventEnd) {
      console.log(`Event ${EVENT_ID} has not ended yet. Payouts will be processed after ${eventEnd.toISOString()}.`);
      return { success: true, payouts: [] }; // Not an error, just not time yet
    }

    // In a real application, this would fetch all participants' progress from a backend.
    // For localStorage demo, we assume we only have the current user's data.
    const progress = getEventProgress();
    const payoutResults: any[] = [];
    let overallSuccess = true;

    if (progress && progress.finished && !progress.payoutTxId) {
      console.log(`Processing payout for user ${progress.userPubkey} for event ${EVENT_ID}`);
      const payoutResult = await rewardsPayoutService.sendEventTransaction(
        progress.userPubkey,
        REWARDS.EVENT_100K.finishReward,
        EVENT_ID,
        TRANSACTION_TYPES.EVENT_PAYOUT as TransactionType,
        `Payout for completing ${EVENT_ID}`
      );

      if (payoutResult.success) {
        progress.payoutTxId = payoutResult.txid || 'unknown';
        saveEventProgress(progress); // Save the payout TxID
        payoutResults.push({ pubkey: progress.userPubkey, status: 'success', txid: payoutResult.txid });
      } else {
        overallSuccess = false;
        payoutResults.push({ pubkey: progress.userPubkey, status: 'failed', error: payoutResult.error });
        console.error(`Failed payout for ${progress.userPubkey}: ${payoutResult.error}`);
      }
    } else if (progress && progress.finished && progress.payoutTxId) {
        console.log(`User ${progress.userPubkey} already paid out for event ${EVENT_ID}.`);
         payoutResults.push({ pubkey: progress.userPubkey, status: 'already_paid', txid: progress.payoutTxId });
    } else if (progress && !progress.finished) {
        console.log(`User ${progress.userPubkey} did not finish event ${EVENT_ID}.`);
         payoutResults.push({ pubkey: progress.userPubkey, status: 'not_finished' });
    }

    // In a real app, loop through all fetched participants.

    return { success: overallSuccess, payouts: payoutResults };
  },
};

export default event100kService; 