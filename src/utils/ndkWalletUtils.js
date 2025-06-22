import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';

/**
 * Utility for managing a persistent NDKCashuWallet instance
 * Handles proper initialization, p2pk generation, and mint list publishing
 */

let walletInstance = null;
let initializationPromise = null;

/**
 * Get or create a properly initialized NDKCashuWallet
 * @param {NDK} ndk - NDK instance
 * @param {string} mintUrl - Mint URL to use
 * @returns {Promise<NDKCashuWallet>} Initialized wallet instance
 */
export const getOrCreateWallet = async (ndk, mintUrl) => {
  if (!ndk) {
    throw new Error('NDK instance is required');
  }

  if (!ndk.signer) {
    throw new Error('NDK signer not available. Please sign in with Amber first.');
  }

  // Return existing wallet if already initialized
  if (walletInstance && walletInstance.p2pk) {
    console.log('[NDKWalletUtils] Using existing initialized wallet');
    return walletInstance;
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    console.log('[NDKWalletUtils] Waiting for existing initialization...');
    return await initializationPromise;
  }

  // Start new initialization
  initializationPromise = initializeWallet(ndk, mintUrl);
  
  try {
    walletInstance = await initializationPromise;
    return walletInstance;
  } finally {
    initializationPromise = null;
  }
};

/**
 * Initialize a new NDKCashuWallet with proper setup
 * @param {NDK} ndk - NDK instance  
 * @param {string} mintUrl - Mint URL
 * @returns {Promise<NDKCashuWallet>} Initialized wallet
 */
const initializeWallet = async (ndk, mintUrl) => {
  console.log('[NDKWalletUtils] Initializing new NDK Cashu wallet...');

  try {
    // Create new wallet instance
    const wallet = new NDKCashuWallet(ndk);
    wallet.mints = [mintUrl];

    console.log('[NDKWalletUtils] Generating P2PK...');
    
    // REQUIRED: Generate and publish the wallet's P2PK
    await wallet.getP2pk();
    console.log("[NDKWalletUtils] P2PK generated:", wallet.p2pk);

    // REQUIRED: Publish the wallet's mint list for token/nutzap reception
    console.log('[NDKWalletUtils] Publishing wallet configuration...');
    await wallet.publish();
    console.log("[NDKWalletUtils] Wallet published successfully");

    return wallet;

  } catch (error) {
    console.error('[NDKWalletUtils] Wallet initialization failed:', error);
    
    // Provide more specific error messages
    if (error.message.includes('signer')) {
      throw new Error('Wallet initialization failed: Please make sure Amber is connected and try again.');
    } else if (error.message.includes('p2pk')) {
      throw new Error('Wallet initialization failed: Could not generate payment key. Check your connection and try again.');
    } else {
      throw new Error(`Wallet initialization failed: ${error.message}`);
    }
  }
};

/**
 * Reset the wallet instance (useful for testing or switching users)
 */
export const resetWallet = () => {
  console.log('[NDKWalletUtils] Resetting wallet instance');
  walletInstance = null;
  initializationPromise = null;
};

/**
 * Check if wallet is properly initialized
 * @returns {boolean} True if wallet is ready to use
 */
export const isWalletReady = () => {
  return walletInstance && walletInstance.p2pk;
};

/**
 * Get the current wallet instance (may not be initialized)
 * @returns {NDKCashuWallet|null} Current wallet or null
 */
export const getCurrentWallet = () => {
  return walletInstance;
}; 