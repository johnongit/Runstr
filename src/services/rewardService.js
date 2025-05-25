import { NWCWallet } from './nwcWallet'; // Assuming path, adjust if necessary
import { getProfile } from '../utils/nostr'; // Assuming a utility to fetch profiles
import {nip57} from 'nostr-tools';

// IMPORTANT: Replace with your actual Runstr Reward NWC URI
const RUNSTR_REWARD_NWC_URI = "nostr+walletconnect://ba80990666ef0b6f4ba5059347beb13242921e54669e680064ca755256a1e3a6?relay=wss%3A%2F%2Frelay.coinos.io&secret=3eae13051dbc253974c03221699075010de242c76ae2aa7a9672eca0f2cb3114&lud16=TheWildHustle@coinos.io";

const runstrRewardWallet = new NWCWallet();
let isConnecting = false;
let connectionPromise = null;

async function ensureRewardWalletConnected() {
  if (runstrRewardWallet.provider && await runstrRewardWallet.provider.isEnabled()) {
    return true;
  }
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      console.log('[RewardService] Connecting to Runstr reward wallet...');
      await runstrRewardWallet.connect(RUNSTR_REWARD_NWC_URI);
      console.log('[RewardService] Runstr reward wallet connected.');
      return true;
    } catch (error) {
      console.error('[RewardService] Failed to connect to Runstr reward wallet:', error);
      // Reset for next attempt
      isConnecting = false;
      connectionPromise = null;
      runstrRewardWallet.provider = null; // Ensure provider is cleared on failure
      throw new Error('Failed to connect to Runstr reward wallet. Check URI and relay.');
    } finally {
      isConnecting = false;
      // Keep connectionPromise resolved/rejected status for subsequent calls in this attempt chain.
    }
  })();
  return connectionPromise;
}

async function getLud16FromProfile(pubkey) {
  try {
    const profile = await getProfile(pubkey); // This function needs to exist
    if (profile && profile.lud16) {
      return profile.lud16;
    }
    // Fallback to lud06 if lud16 not present
    if (profile && profile.lud06) {
        return profile.lud06;
    }
    console.warn(`[RewardService] No lud16 or lud06 found for pubkey: ${pubkey}`);
    return null;
  } catch (error) {
    console.error(`[RewardService] Error fetching profile for ${pubkey}:`, error);
    return null;
  }
}

/**
 * Sends a NIP-57 lightning zap from the configured Runstr reward NWC wallet.
 *
 * @param {string} recipientPubkey The user receiving the zap.
 * @param {number} amountSats Amount in satoshis.
 * @param {string} message Zap request comment.
 * @param {string} zapType Custom tag for tracking e.g. streak_reward, nip101_reward.
 * @returns {Promise<PayoutResult>}
 */
export async function sendRewardZap(recipientPubkey, amountSats, message, zapType = 'general_reward') {
  console.log(`[RewardService] Attempting to send ${amountSats} sats reward for ${zapType} to ${recipientPubkey}`);

  try {
    await ensureRewardWalletConnected();
  } catch (error) {
    return { success: false, message: 'Reward wallet connection failed.', error: error.message };
  }

  const lud16 = await getLud16FromProfile(recipientPubkey);
  if (!lud16) {
    return { success: false, message: 'Recipient does not have a Lightning Address (lud16/lud06) in their profile.', error: 'No lud16/lud06' };
  }

  try {
    const lnurlDetails = await nip57.fetchProfile(lud16);
    if (!lnurlDetails || !lnurlDetails.callback || !lnurlDetails.allowsNostr || lnurlDetails.minSendable > (amountSats * 1000)) {
      let errorMsg = 'Failed to fetch LNURL details or zap not possible.';
      if (lnurlDetails && lnurlDetails.minSendable > (amountSats*1000)) {
        errorMsg = `Amount too low. Minimum sendable: ${lnurlDetails.minSendable/1000} sats.`;
      } else if (!lnurlDetails.allowsNostr) {
        errorMsg = 'Recipient LNURL provider does not support Nostr zaps.';
      }
      console.error(`[RewardService] LNURL details error for ${lud16}:`, errorMsg, lnurlDetails);
      return { success: false, message: errorMsg, error: 'LNURL issue' };
    }
    
    // Construct a simple, unsigned zap request event object
    // The pubkey of this event is not critical if the LNURL server doesn't strictly validate signatures on 'nostr' param
    // For simplicity, we'll omit pubkey and id, and not sign it.
    const unsignedZapRequest = {
      kind: 9734,
      content: message,
      tags: [
        ['p', recipientPubkey],
        ['amount', (amountSats * 1000).toString()], // NIP-57 specifies amount in millisats in tags
        // Consider adding ['relays', ...your_app_relays] for better zap receipt discovery
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    // Get the invoice from the LNURL provider
    const invoice = await nip57.getInvoice({
        zapProfile: lnurlDetails,
        amount: amountSats * 1000, // Amount in millisatoshis
        comment: message,
        zapEvent: unsignedZapRequest, // Pass the unsigned event
        // relays: [...your_app_relays] // Optional: NIP-57 recommends relays tag in zap request
    });
    
    if (!invoice || !invoice.pr) {
        console.error('[RewardService] Failed to get invoice from LNURL provider:', invoice);
        return { success: false, message: 'Failed to get invoice from LNURL provider.', error: 'Invoice generation failed' };
    }

    console.log(`[RewardService] Obtained invoice for ${amountSats} sats to ${lud16}: ${invoice.pr.substring(0, 60)}...`);

    // Pay the invoice using the Runstr reward wallet
    const paymentResponse = await runstrRewardWallet.makePayment(invoice.pr);
    console.log('[RewardService] Payment response:', paymentResponse);

    // The structure of paymentResponse can vary.
    // A common success indicator is the presence of a `preimage`.
    if (paymentResponse && (paymentResponse.preimage || paymentResponse.payment_hash || (paymentResponse.data && paymentResponse.data.preimage))) {
      console.log(`[RewardService] Successfully sent ${amountSats} sats for ${zapType} to ${recipientPubkey}`);
      return { success: true, message: `Successfully sent ${amountSats} sats!`, paymentResponse };
    } else {
      console.error('[RewardService] Payment failed or preimage not found in response.');
      return { success: false, message: 'Payment failed.', error: 'No preimage or payment failed', paymentResponse };
    }

  } catch (error) {
    console.error(`[RewardService] Error during zap process for ${zapType} to ${recipientPubkey}:`, error);
    let errorMessage = error.message || 'Unknown error during zap.';
    if (error.response && error.response.data && error.response.data.reason) {
      errorMessage = error.response.data.reason;
    }
    return { success: false, message: `Failed to send zap: ${errorMessage}`, error: errorMessage };
  }
}

// Placeholder for NIP101e/h post reward
// You'll need to call this from where you confirm a NIP101e/h post.
export async function rewardNip101Post(recipientPubkey, kind, eventId) {
  // IMPORTANT: Define your KIND numbers and any specific tag checks for NIP101e/h
  const NIP101_REWARD_AMOUNT_SATS = 5;
  let rewardType = '';

  if (kind === globalThis.NIP101e_KIND_NUMBER) { // Replace with actual kind number
    rewardType = 'nip101e_post';
  } else if (kind === globalThis.NIP101h_KIND_NUMBER) { // Replace with actual kind number
    rewardType = 'nip101h_post';
  } else {
    console.warn(`[RewardService] Unknown kind for NIP101 reward: ${kind}`);
    return { success: false, message: 'Unknown NIP101 kind.'};
  }
  
  // Potentially add more checks here based on eventId or specific tags if needed

  const message = `Thanks for your ${rewardType.replace('_', ' ')}! +${NIP101_REWARD_AMOUNT_SATS} sats from Runstr.`;
  return sendRewardZap(recipientPubkey, NIP101_REWARD_AMOUNT_SATS, message, rewardType);
}

// Placeholder for Streak completion reward
// You'll need to call this from where you detect a streak completion.
export async function rewardStreakCompletion(recipientPubkey, streakDays) {
  const STREAK_REWARD_AMOUNT_SATS = 500; // As per previous discussion
  const message = `Congrats on your ${streakDays}-day streak! +${STREAK_REWARD_AMOUNT_SATS} sats from Runstr! 🔥`;
  const rewardType = 'streak_completion';
  return sendRewardZap(recipientPubkey, STREAK_REWARD_AMOUNT_SATS, message, rewardType);
}

/**
 * Generic helper for 5-/10-sat micro-rewards when a user completes an in-app action (workout post, profile update).
 * @param {string} recipientPubkey - Runner's hex pubkey.
 * @param {('workout_record'|'profile_update')} activityType - What they just did.
 * @param {boolean} usedPrivateRelay - true if the publish destination was set to `private`.
 */
export async function rewardUserActivity(recipientPubkey, activityType, usedPrivateRelay = false) {
  const base = 5;
  const finalAmount = usedPrivateRelay ? base + 5 : base; // 10 sats if private relay, else 5
  const messageAction = activityType === 'profile_update' ? 'updating your profile' : 'posting your workout';
  const message = `Thanks for ${messageAction}! +${finalAmount} sats from Runstr${usedPrivateRelay ? ' (private relay bonus!)' : ''}.`;
  const zapType = activityType === 'profile_update' ? 'profile_update_reward' : 'workout_record_reward';

  try {
    const result = await sendRewardZap(recipientPubkey, finalAmount, message, zapType);
    return result;
  } catch (error) {
    console.error(`[RewardService] Error during rewardUserActivity for ${activityType} to ${recipientPubkey}:`, error);
    let errorMessage = error.message || 'Unknown error during rewardUserActivity.';
    if (error.response && error.response.data && error.response.data.reason) {
      errorMessage = error.response.data.reason;
    }
    return { success: false, message: `Failed to send reward: ${errorMessage}`, error: errorMessage };
  }
} 