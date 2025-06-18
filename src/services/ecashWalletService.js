import { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Send token via encrypted DM using NDK
 */
export const sendTokenViaDM = async (ndk, recipientPubkey, token, memo) => {
  try {
    if (!ndk || !ndk.signer) {
      throw new Error('NDK or signer not available');
    }

    // Create DM content with token and memo
    const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token: ${token}`;
    
    // Create encrypted DM event (kind 4)
    const dmEvent = new NDKEvent(ndk);
    dmEvent.kind = 4;
    dmEvent.content = dmContent;
    dmEvent.tags = [['p', recipientPubkey]];
    dmEvent.created_at = Math.floor(Date.now() / 1000);

    // Encrypt the content for the recipient
    await dmEvent.encrypt(recipientPubkey);
    
    // Publish the encrypted DM
    await dmEvent.publish();
    
    console.log('[EcashWallet] Token sent via DM successfully');
    
  } catch (error) {
    console.error('[EcashWallet] Failed to send DM:', error);
    throw new Error('Failed to send token via DM: ' + error.message);
  }
};

/**
 * Create a transferable token from wallet balance
 */
export const createTransferableToken = async (wallet, amount) => {
  try {
    // In NDK Cashu wallet, mintTokens actually creates tokens from existing balance
    // This is confusing naming but it's the correct method for creating transferable tokens
    const token = await wallet.mintTokens(amount);
    
    if (!token) {
      throw new Error('Failed to create transferable token');
    }
    
    return token;
  } catch (error) {
    console.error('[EcashWallet] Error creating transferable token:', error);
    throw error;
  }
};

/**
 * Extract cashu tokens from text content (DMs, etc.)
 */
export const extractCashuToken = (content) => {
  // Look for cashu token patterns in the message
  const tokenMatch = content.match(/cashu[A-Za-z0-9+/=]+/);
  return tokenMatch ? tokenMatch[0] : null;
}; 