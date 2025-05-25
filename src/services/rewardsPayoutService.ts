/**
 * Rewards Payout Service
 * Handles Bitcoin reward payouts via Bitvora API integration and internal transaction logging.
 */

import transactionService, { TRANSACTION_TYPES } from './transactionService';
import { REWARDS } from '../config/rewardsConfig';
import nwcService from './nwcService';
import { sendRewardZap } from './rewardService'; // NEW: zap-based payout

// Define TransactionType based on TRANSACTION_TYPES from transactionService.js
// This assumes TRANSACTION_TYPES is an object like { STREAK_REWARD: 'streak_reward', ... }
const transactionTypesValues = Object.values(TRANSACTION_TYPES);
export type TransactionType = typeof transactionTypesValues[number];

// Constants
const DEMO_MODE = false; // Set to false to use real Bitvora API

// Simulated API call for testing (only used in demo mode)
const simulateApiCall = async (result: any) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return result;
};

interface PayoutResult {
  success: boolean;
  txid?: string;
  amount?: number;
  pubkey?: string;
  timestamp?: string;
  error?: string;
  result?: any;
}

// Add helper to attempt paying via the USER's own NWC connection
/**
 * Try paying the runner by requesting an invoice from their own NWC wallet
 * and then paying it with the app funding wallet (nwcService.payInvoiceWithNwc).
 */
const payoutViaUserNwc = async (userNwcUri: string | null, sats: number, memo: string) => {
  if (!userNwcUri) return { success: false, error: 'User NWC URI missing' } as PayoutResult;
  const invRes = await nwcService.makeInvoiceWithNwc(userNwcUri, sats, memo);
  if (!invRes.success || !invRes.invoice) return { success: false, error: invRes.error || 'Failed to get invoice' } as PayoutResult;
  // Pay the invoice with the funding wallet (configured in nwcService)
  const payRes = await nwcService.payInvoiceWithNwc(invRes.invoice, memo);
  return payRes;
};

const rewardsPayoutService = {
  /**
   * Send a streak reward.
   * @param pubkey User's public key.
   * @param amount Amount in satoshis.
   * @param streakDay The day number of the streak.
   * @param userNwcUri Optional user's NWC URI.
   * @returns Transaction result.
   */
  sendStreakReward: async (
    pubkey: string,
    amount: number,
    streakDay: number,
    userNwcUri?: string | null
  ): Promise<PayoutResult> => {
    const memo = `${streakDay}-day streak reward`;

    /*
     * --------------------------------------------
     * 1. Attempt payout via RUNSTR reward wallet zap
     * --------------------------------------------
     * If the destination `pubkey` looks like a Nostr hex pubkey (64 hex chars),
     * we can attempt a direct NIP-57 zap using the Runstr reward wallet
     * defined in rewardService.js. This aligns with the new lightweight
     * reward mechanism requested by the user.
     */
    const isHexPubkey = /^[0-9a-fA-F]{64}$/.test(pubkey);
    if (isHexPubkey) {
      try {
        const zapRes = await sendRewardZap(pubkey, amount, `RUNSTR: ${memo}`, 'streak_completion');
        if (zapRes.success) {
          return {
            success: true,
            // paymentResponse structure varies by wallet – fall back to undefined if not present
            txid: (zapRes.paymentResponse?.payment_hash ?? zapRes.paymentResponse?.preimage) ?? undefined,
            amount,
            pubkey,
            timestamp: new Date().toISOString(),
          };
        } else {
          console.warn('[rewardsPayoutService] Zap payout failed, falling back:', zapRes.error);
        }
      } catch (zapErr: any) {
        console.error('[rewardsPayoutService] Error during zap payout, falling back:', zapErr.message);
      }
    }

    // 2. Try paying via user's own NWC wallet first
    if (userNwcUri) {
      try {
        const nwcRes = await payoutViaUserNwc(userNwcUri, amount, memo);
        if (nwcRes.success) {
          return {
            success: true,
            txid: nwcRes.result?.preimage || nwcRes.txid,
            amount,
            pubkey,
            timestamp: new Date().toISOString(),
          };
        } else {
          console.warn('[rewardsPayoutService] user-NWC payout failed, falling back:', nwcRes.error);
        }
      } catch (err: any) {
        console.error('[rewardsPayoutService] Error in user-NWC payout, falling back:', err.message);
      }
    }

    // 2. Fallback to existing LNURL/Lightning Address payout path (transactionService)
    const reason = memo;
    return await transactionService.processReward(
      pubkey,
      amount,
      TRANSACTION_TYPES.STREAK_REWARD as TransactionType,
      reason,
      { source: 'streak_rewards', streakDay, via: 'LNURL' }
    );
  },

  /**
   * Process an event-related transaction (registration fee or payout).
   * @param pubkey User's public key.
   * @param amount Amount in satoshis (positive for payout, could be negative for fee if handled by caller that way).
   * @param eventId Identifier for the event.
   * @param transactionType Type of event transaction (e.g., EVENT_REGISTRATION, EVENT_PAYOUT).
   * @param reason Description of the transaction.
   * @returns Transaction result.
   */
  sendEventTransaction: async (
    pubkey: string,
    amount: number,
    eventId: string,
    transactionType: TransactionType, // Expecting specific event-related types from TRANSACTION_TYPES
    reason: string
  ): Promise<PayoutResult> => {
    // DEMO_MODE simulation for event payout
    if (DEMO_MODE && amount > 0 && transactionType !== TRANSACTION_TYPES.EVENT_REGISTRATION_FEE) {
      return simulateApiCall({
        success: true,
        txid: `sim_event_payout_${Date.now().toString(16)}`,
        amount,
        pubkey,
        timestamp: new Date().toISOString(),
      });
    }
    // DEMO_MODE simulation for event registration fee
    if (DEMO_MODE && transactionType === TRANSACTION_TYPES.EVENT_REGISTRATION_FEE) {
        return simulateApiCall({
            success: true,
            txid: `sim_event_fee_${Date.now().toString(16)}`,
            amount: Math.abs(amount),
            pubkey, // Fee paid by user to RUNSTR (or a specific event pubkey)
            timestamp: new Date().toISOString(),
        });
    }

    return await transactionService.processReward(
      pubkey,
      amount,
      transactionType,
      reason,
      { source: 'event_rewards', eventId, type: transactionType } // Added type for clarity
    );
  },

  /**
   * Send a leaderboard reward.
   * @param pubkey User's public key.
   * @param amount Amount in satoshis.
   * @param rank The rank of the user.
   * @param payoutDateISO The ISO date of the payout.
   * @returns Transaction result.
   */
  sendLeaderboardReward: async (
    pubkey: string,
    amount: number,
    rank: number,
    payoutDateISO: string
  ): Promise<PayoutResult> => {
    console.warn('[rewardsPayoutService] Leaderboard rewards feature is disabled – ignoring call.');
    return {
      success: false,
      error: 'Leaderboard rewards not implemented',
    };
  },

  // TODO: The methods below like recordClaim, getClaims, createLightningAddress, 
  // getUserTransactions, syncTransactions were part of the old service.
  // They need to be re-evaluated: 
  // - recordClaim/getClaims might move to specific reward utils (e.g. streakUtils) if purely for local tracking.
  // - createLightningAddress is a bitvoraService concern, not a rewards payout concern.
  // - getUserTransactions relies on transactionService directly.
  // - syncTransactions also relies on transactionService.
  // For now, they are commented out to focus on the core payout logic.

  /*
  recordClaim: (claimData) => {
    try {
      const claims = rewardsPayoutService.getClaims(); //rewardsPayoutService here might be an issue
      claims.unshift({
        ...claimData,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('bitcoinRewardClaims', JSON.stringify(claims));
      return true;
    } catch (error) {
      console.error('Error recording claim:', error);
      return false;
    }
  },

  getClaims: () => {
    try {
      const claims = localStorage.getItem('bitcoinRewardClaims');
      return claims ? JSON.parse(claims) : [];
    } catch (error) {
      console.error('Error getting claims:', error);
      return [];
    }
  },
  */
};

export default rewardsPayoutService; 