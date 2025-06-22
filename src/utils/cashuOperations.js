import { CashuMint, CashuWallet, getEncodedToken } from '@cashu/cashu-ts';
import { createTokenEvent, sendTokenViaDM } from './nip60Events';

/**
 * Cashu operations for sending and receiving ecash tokens
 * Integrates with NIP-60 events for storage and sharing
 */

export class CashuOperations {
  constructor(mintUrl, ndk, userPubkey) {
    this.mintUrl = mintUrl;
    this.ndk = ndk;
    this.userPubkey = userPubkey;
    this.mint = new CashuMint(mintUrl);
    this.wallet = new CashuWallet(this.mint);
  }

  /**
   * Send ecash tokens to a recipient
   * @param {string} recipientPubkey - Recipient's nostr pubkey
   * @param {number} amount - Amount in sats
   * @param {string} memo - Optional memo
   * @returns {Promise<Object>} Result with success status and details
   */
  async sendTokens(recipientPubkey, amount, memo = '') {
    try {
      console.log(`[CashuOperations] Sending ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

      // Get mint info and keysets
      const info = await this.mint.getInfo();
      const keysets = await this.mint.getKeys();
      
      if (!keysets || keysets.length === 0) {
        throw new Error('No active keysets available from mint');
      }

      // Create tokens for the specified amount
      const { send, returnChange } = await this.wallet.send(amount, await this.wallet.getProofs());
      
      if (!send || send.length === 0) {
        throw new Error('Failed to create tokens for sending');
      }

      // Encode tokens for sharing
      const token = getEncodedToken({
        token: [{ mint: this.mintUrl, proofs: send }]
      });

      // Create NIP-60 token event
      await createTokenEvent(this.ndk, recipientPubkey, amount, this.mintUrl, token, memo);

      // Send via encrypted DM
      await sendTokenViaDM(this.ndk, recipientPubkey, token, memo);

      console.log('[CashuOperations] Tokens sent successfully');
      return {
        success: true,
        token,
        amount,
        message: 'Tokens sent successfully via encrypted DM'
      };

    } catch (error) {
      console.error('[CashuOperations] Send error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to send tokens: ' + error.message
      };
    }
  }

  /**
   * Receive ecash tokens from a token string
   * @param {string} tokenString - Encoded cashu token
   * @returns {Promise<Object>} Result with success status and amount received
   */
  async receiveTokens(tokenString) {
    try {
      console.log('[CashuOperations] Receiving tokens...');

      // Decode and validate token
      const decodedToken = this.decodeToken(tokenString);
      if (!decodedToken) {
        throw new Error('Invalid token format');
      }

      // Receive the tokens
      const receivedProofs = await this.wallet.receive(decodedToken);
      
      if (!receivedProofs || receivedProofs.length === 0) {
        throw new Error('No proofs received');
      }

      // Calculate total amount received
      const totalAmount = receivedProofs.reduce((sum, proof) => sum + proof.amount, 0);

      // Create NIP-60 token event for received tokens
      await createTokenEvent(this.ndk, this.userPubkey, totalAmount, this.mintUrl, tokenString, 'Received tokens');

      console.log(`[CashuOperations] Successfully received ${totalAmount} sats`);
      return {
        success: true,
        amount: totalAmount,
        proofs: receivedProofs,
        message: `Successfully received ${totalAmount} sats`
      };

    } catch (error) {
      console.error('[CashuOperations] Receive error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to receive tokens: ' + error.message
      };
    }
  }

  /**
   * Request a Lightning invoice for funding the wallet
   * @param {number} amount - Amount in sats
   * @returns {Promise<Object>} Invoice details
   */
  async requestInvoice(amount) {
    try {
      console.log(`[CashuOperations] Requesting ${amount} sat invoice...`);

      // Get mint quote for creating tokens
      const quote = await this.mint.requestMint(amount);
      
      if (!quote || !quote.request) {
        throw new Error('Failed to get mint quote');
      }

      return {
        success: true,
        invoice: quote.request,
        quote: quote.quote,
        amount,
        message: 'Invoice created successfully'
      };

    } catch (error) {
      console.error('[CashuOperations] Invoice request error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create invoice: ' + error.message
      };
    }
  }

  /**
   * Check if a Lightning invoice has been paid and mint tokens
   * @param {string} quote - Quote from requestInvoice
   * @returns {Promise<Object>} Minting result
   */
  async checkAndMintTokens(quote) {
    try {
      console.log('[CashuOperations] Checking payment and minting tokens...');

      // Mint tokens using the paid quote
      const { proofs } = await this.wallet.requestTokens(quote);
      
      if (!proofs || proofs.length === 0) {
        throw new Error('No tokens minted');
      }

      // Calculate total amount minted
      const totalAmount = proofs.reduce((sum, proof) => sum + proof.amount, 0);

      console.log(`[CashuOperations] Successfully minted ${totalAmount} sats`);
      return {
        success: true,
        amount: totalAmount,
        proofs,
        message: `Successfully minted ${totalAmount} sats`
      };

    } catch (error) {
      console.error('[CashuOperations] Mint error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Payment not yet confirmed or minting failed'
      };
    }
  }

  /**
   * Get current wallet balance
   * @returns {Promise<number>} Balance in sats
   */
  async getBalance() {
    try {
      const proofs = await this.wallet.getProofs();
      return proofs.reduce((sum, proof) => sum + proof.amount, 0);
    } catch (error) {
      console.error('[CashuOperations] Balance error:', error);
      return 0;
    }
  }

  /**
   * Decode a cashu token string
   * @param {string} tokenString - Encoded token
   * @returns {Object|null} Decoded token or null if invalid
   */
  decodeToken(tokenString) {
    try {
      // Remove cashu prefix if present
      const cleanToken = tokenString.replace(/^cashu/, '');
      
      // Decode base64
      const decoded = JSON.parse(atob(cleanToken));
      
      // Validate structure
      if (!decoded.token || !Array.isArray(decoded.token)) {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('[CashuOperations] Token decode error:', error);
      return null;
    }
  }

  /**
   * Validate if a token string is properly formatted
   * @param {string} tokenString - Token to validate
   * @returns {boolean} True if valid
   */
  isValidToken(tokenString) {
    if (!tokenString || typeof tokenString !== 'string') {
      return false;
    }

    const decoded = this.decodeToken(tokenString);
    return decoded !== null;
  }
}

/**
 * Create CashuOperations instance for current user
 * @param {string} mintUrl - Mint URL
 * @param {Object} ndk - NDK instance
 * @param {string} userPubkey - User's pubkey
 * @returns {CashuOperations} Operations instance
 */
export const createCashuOperations = (mintUrl, ndk, userPubkey) => {
  return new CashuOperations(mintUrl, ndk, userPubkey);
}; 