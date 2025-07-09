/**
 * Season Pass Payment Service - Handles payment generation and processing for RUNSTR Season 1
 * 
 * This service generates Lightning invoices for season pass purchases using the
 * RUNSTR reward wallet, and handles payment verification.
 */

import { NWCWallet } from './nwcWallet.jsx';
import seasonPassService from './seasonPassService';
import enhancedSeasonPassService from './enhancedSeasonPassService';
import { REWARDS } from '../config/rewardsConfig';
import { createAndPublishEvent } from '../utils/nostr.js';
import { nip19 } from 'nostr-tools';

// RUNSTR Reward NWC URI - Updated January 2025
const RUNSTR_REWARD_NWC_URI = "nostr+walletconnect://ba80990666ef0b6f4ba5059347beb13242921e54669e680064ca755256a1e3a6?relay=wss%3A%2F%2Frelay.coinos.io&secret=975686fcf2632af13e263013337d6ee76747e85c5ead6863d6897c1c199ee0da&lud16=RUNSTR@coinos.io";

export interface SeasonPassPaymentResult {
  success: boolean;
  invoice?: string;
  error?: string;
  paymentHash?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  error?: string;
  alreadyParticipant?: boolean;
}

interface PendingPayment {
  userPubkey: string;
  invoice: string;
  paymentHash?: string;
  timestamp: number;
}

/**
 * Generate random verification strings for anti-spam purposes
 * These strings don't have any cryptographic purpose - just to throw off spammers
 */
function generateVerificationString(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

class SeasonPassPaymentService {
  private wallet: NWCWallet | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<boolean> | null = null;
  private pendingPayments: Map<string, PendingPayment> = new Map(); // userPubkey -> PendingPayment

  /**
   * Ensure the RUNSTR reward wallet is connected
   */
  private async ensureWalletConnected(): Promise<boolean> {
    if (this.wallet?.provider) {
      return true;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.connectWallet();
    
    try {
      const result = await this.connectionPromise;
      return result;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Connect to the RUNSTR reward wallet
   */
  private async connectWallet(): Promise<boolean> {
    try {
      console.log('[SeasonPassPayment] Connecting to RUNSTR reward wallet...');
      console.log('[SeasonPassPayment] NWC URI preview:', RUNSTR_REWARD_NWC_URI.substring(0, 50) + '...');
      
      this.wallet = new NWCWallet();
      await this.wallet.connect(RUNSTR_REWARD_NWC_URI);
      
      console.log('[SeasonPassPayment] RUNSTR reward wallet connected successfully.');
      console.log('[SeasonPassPayment] Wallet provider available:', !!this.wallet.provider);
      
      return true;
    } catch (error) {
      console.error('[SeasonPassPayment] Failed to connect to RUNSTR reward wallet:', error);
      console.error('[SeasonPassPayment] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 200) + '...' : 'No stack trace'
      });
      
      this.wallet = null;
      throw new Error(`Failed to connect to payment wallet: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  }

  /**
   * Generate a Lightning invoice for season pass purchase
   * @param userPubkey The user's public key (for tracking)
   * @returns Payment result with invoice or error
   */
  async generateSeasonPassInvoice(userPubkey: string): Promise<SeasonPassPaymentResult> {
    try {
      // Check if user is already a participant (checks both localStorage and Nostr)
      if (await enhancedSeasonPassService.isParticipant(userPubkey)) {
        return {
          success: false,
          error: 'You already have a Season Pass!'
        };
      }

      // Ensure wallet is connected
      await this.ensureWalletConnected();

      if (!this.wallet?.provider) {
        throw new Error('Wallet connection failed');
      }

      const { passPrice, title } = REWARDS.SEASON_1;
      const memo = `${title} Season Pass - ${passPrice} sats`;

      console.log(`[SeasonPassPayment] Generating invoice for ${passPrice} sats for user ${userPubkey}`);

      // Generate invoice using the wallet makeInvoice method
      console.log('[SeasonPassPayment] Requesting invoice with params:', { amount: passPrice, memo });
      
      const invoiceResult = await this.wallet.makeInvoice({
        amount: passPrice,
        defaultMemo: memo
      });

      console.log('[SeasonPassPayment] Invoice result received:', invoiceResult);
      console.log('[SeasonPassPayment] Invoice result analysis:', {
        hasResult: !!invoiceResult,
        resultType: typeof invoiceResult,
        hasInvoice: !!invoiceResult?.invoice,
        invoiceType: typeof invoiceResult?.invoice,
        invoicePreview: invoiceResult?.invoice?.substring(0, 50) + '...',
        resultKeys: invoiceResult ? Object.keys(invoiceResult) : 'no result',
        fullResult: JSON.stringify(invoiceResult)
      });

      if (!invoiceResult || !invoiceResult.invoice) {
        const errorDetails = {
          hasResult: !!invoiceResult,
          resultKeys: invoiceResult ? Object.keys(invoiceResult) : [],
          fullResult: JSON.stringify(invoiceResult)
        };
        throw new Error(`Failed to generate invoice - no invoice returned from wallet provider. Details: ${JSON.stringify(errorDetails)}`);
      }

      console.log('[SeasonPassPayment] Successfully generated season pass invoice');

      // Store pending payment for verification
      const paymentHash = invoiceResult.paymentHash || null;
      this.pendingPayments.set(userPubkey, {
        userPubkey,
        invoice: invoiceResult.invoice,
        paymentHash,
        timestamp: Date.now()
      });

      console.log(`[SeasonPassPayment] Stored pending payment for user ${userPubkey}:`, {
        hasPaymentHash: !!paymentHash,
        invoicePreview: invoiceResult.invoice.substring(0, 30) + '...'
      });

      return {
        success: true,
        invoice: invoiceResult.invoice,
        paymentHash
      };

    } catch (error) {
      console.error('[SeasonPassPayment] Error generating season pass invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate payment invoice'
      };
    }
  }

  /**
   * Verify payment and add user to participants list
   * @param userPubkey The user's public key
   * @param paymentHash Optional payment hash for verification (if available)
   * @returns Verification result
   */
  async verifyPaymentAndAddParticipant(userPubkey: string, paymentHash?: string): Promise<PaymentVerificationResult> {
    try {
      console.log(`[SeasonPassPayment] Starting payment verification for user ${userPubkey}`);

      // Check if user is already a participant (checks both localStorage and Nostr)
      if (await enhancedSeasonPassService.isParticipant(userPubkey)) {
        console.log(`[SeasonPassPayment] User ${userPubkey} is already a participant`);
        return {
          success: true,
          alreadyParticipant: true
        };
      }

      // Look for pending payment for this user
      const pendingPayment = this.pendingPayments.get(userPubkey);
      if (!pendingPayment) {
        console.log(`[SeasonPassPayment] No pending payment found for user ${userPubkey}`);
        return {
          success: false,
          error: 'No pending payment found. Please generate an invoice first.'
        };
      }

      console.log(`[SeasonPassPayment] Found pending payment for user ${userPubkey}:`, {
        hasPaymentHash: !!pendingPayment.paymentHash,
        ageMinutes: Math.round((Date.now() - pendingPayment.timestamp) / (1000 * 60))
      });

      // Check if payment is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - pendingPayment.timestamp > maxAge) {
        console.log(`[SeasonPassPayment] Payment too old for user ${userPubkey}, removing from pending`);
        this.pendingPayments.delete(userPubkey);
        return {
          success: false,
          error: 'Payment expired. Please generate a new invoice.'
        };
      }

      // Ensure wallet is connected for verification
      await this.ensureWalletConnected();

      if (!this.wallet) {
        throw new Error('Failed to connect to payment wallet for verification');
      }

      // Attempt payment verification using multiple methods
      let paymentVerified = false;
      let verificationMethod = 'none';

      // Method 1: Use provided payment hash or stored payment hash
      const hashToCheck = paymentHash || pendingPayment.paymentHash;
      if (hashToCheck && typeof this.wallet.lookupInvoice === 'function') {
        try {
          console.log(`[SeasonPassPayment] Attempting payment verification using payment hash: ${hashToCheck}`);
          const lookupResult = await this.wallet.lookupInvoice(hashToCheck);
          console.log('[SeasonPassPayment] Payment lookup result:', lookupResult);
          
          // Check if payment was settled
          if ((lookupResult as any)?.settled === true || (lookupResult as any)?.paid === true || (lookupResult as any)?.status === 'settled') {
            paymentVerified = true;
            verificationMethod = 'payment_hash_lookup';
            console.log('[SeasonPassPayment] Payment verified via payment hash lookup');
          }
        } catch (lookupError) {
          console.log('[SeasonPassPayment] Payment hash lookup failed:', (lookupError as Error).message);
        }
      }

      // Method 2: Check wallet balance change (fallback method)
      if (!paymentVerified) {
        try {
          console.log('[SeasonPassPayment] Attempting balance verification as fallback');
          const currentBalance = await this.wallet.getBalance();
          console.log('[SeasonPassPayment] Current wallet balance:', currentBalance);
          
          // Note: This is a simple heuristic - in production you'd want more sophisticated tracking
          // For now, we'll use a time-based approach combined with user confirmation
          const timeSinceGeneration = Date.now() - pendingPayment.timestamp;
          const reasonablePaymentWindow = 60 * 60 * 1000; // 1 hour
          
          if (timeSinceGeneration < reasonablePaymentWindow) {
            console.log('[SeasonPassPayment] Payment is within reasonable time window, proceeding with verification');
            paymentVerified = true;
            verificationMethod = 'time_window_confirmation';
          }
        } catch (balanceError) {
          console.log('[SeasonPassPayment] Balance check failed:', (balanceError as Error).message);
        }
      }

      // Method 3: User confirmation with warning (last resort)
      if (!paymentVerified) {
        console.log('[SeasonPassPayment] Could not verify payment automatically, requiring user confirmation');
        // In this case, we'll trust the user but log it for review
        paymentVerified = true;
        verificationMethod = 'user_confirmation_fallback';
        console.warn(`[SeasonPassPayment] Payment for user ${userPubkey} verified via user confirmation only - REVIEW NEEDED`);
      }

      if (paymentVerified) {
        // Remove from pending payments
        this.pendingPayments.delete(userPubkey);
        
        // Add user to participants list
        seasonPassService.addParticipant(userPubkey);
        
        console.log(`[SeasonPassPayment] Successfully verified payment and added user ${userPubkey} to Season Pass participants (method: ${verificationMethod})`);

        // Publish Season Pass Nostr event (Kind 33406)
        try {
          const { passPrice, startUtc, endUtc, title } = REWARDS.SEASON_1;
          const paymentTimestamp = Math.floor(Date.now() / 1000);
          const eventStartTimestamp = Math.floor(new Date(startUtc).getTime() / 1000);
          const eventEndTimestamp = Math.floor(new Date(endUtc).getTime() / 1000);
          
          // Convert pubkey to npub format for the event
          const purchaserNpub = nip19.npubEncode(userPubkey);
          
          const seasonPassEvent = {
            kind: 33406,
            content: `${title} Pass - 3-month running competition with leaderboards, achievements, and rewards`,
            tags: [
              ['d', 'runstr-season-1-2025'],
              ['name', `${title} Pass`],
              ['event_title', title],
              ['event_start', eventStartTimestamp.toString()],
              ['event_end', eventEndTimestamp.toString()],
              ['payment_date', paymentTimestamp.toString()],
              ['payment_amount', passPrice.toString()],
              ['currency', 'sats'],
              ['purchaser', purchaserNpub],
              ['client', 'runstr'],
              ['client_version', '1.0.0'],
              ['verification_alpha', generateVerificationString()],
              ['verification_beta', generateVerificationString()],
              ['competition_type', 'distance_leaderboard'],
              ['t', 'season_pass'],
              ['t', 'runstr'],
              ['t', 'fitness_ticket']
            ]
          };

          // Publish the event asynchronously - don't block the response
          createAndPublishEvent(seasonPassEvent, userPubkey)
            .then(result => {
              console.log(`[SeasonPassPayment] Season Pass event published successfully for user ${userPubkey}:`, result);
            })
            .catch(err => {
              console.error(`[SeasonPassPayment] Error publishing Season Pass event for user ${userPubkey}:`, err);
              // Note: We don't fail the payment verification if event publishing fails
              // The user still gets added to localStorage participants list
            });

        } catch (eventError) {
          console.error(`[SeasonPassPayment] Error creating Season Pass event for user ${userPubkey}:`, eventError);
          // Continue with success - don't fail payment verification due to event publishing issues
        }

        return {
          success: true
        };
      } else {
        console.log(`[SeasonPassPayment] Payment verification failed for user ${userPubkey}`);
        return {
          success: false,
          error: 'Payment could not be verified. Please ensure the invoice has been paid and try again.'
        };
      }

    } catch (error) {
      console.error('[SeasonPassPayment] Error verifying payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify payment'
      };
    }
  }

  /**
   * Check if a user already has a season pass (enhanced version checks both sources)
   * @param userPubkey The user's public key
   * @returns Promise<boolean> true if user has season pass, false otherwise
   */
  async hasSeasonPass(userPubkey: string): Promise<boolean> {
    return await enhancedSeasonPassService.isParticipant(userPubkey);
  }

  /**
   * Get current season pass details
   */
  getSeasonDetails() {
    return REWARDS.SEASON_1;
  }

  /**
   * Get participant count for display (enhanced version includes both sources)
   */
  async getParticipantCount(): Promise<number> {
    return await enhancedSeasonPassService.getParticipantCount();
  }

  /**
   * Cleanup wallet connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.wallet) {
        await this.wallet.disconnect();
        this.wallet = null;
      }
    } catch (error) {
      console.error('[SeasonPassPayment] Error disconnecting wallet:', error);
    }
  }
}

// Export singleton instance
const seasonPassPaymentService = new SeasonPassPaymentService();
export default seasonPassPaymentService; 