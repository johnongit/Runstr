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

  // Start new initialization with fallback
  initializationPromise = initializeWalletWithFallback(ndk, mintUrl);
  
  try {
    walletInstance = await initializationPromise;
    return walletInstance;
  } finally {
    initializationPromise = null;
  }
};

/**
 * Initialize wallet with fallback for circular reference issues
 * @param {NDK} ndk - NDK instance
 * @param {string} mintUrl - Mint URL
 * @returns {Promise<NDKCashuWallet>} Initialized wallet
 */
const initializeWalletWithFallback = async (ndk, mintUrl) => {
  try {
    // Try standard initialization first
    return await initializeWallet(ndk, mintUrl);
  } catch (error) {
    if (error.message.includes('circular') || error.message.includes('JSON')) {
      console.warn('[NDKWalletUtils] Circular reference detected, trying fallback approach...');
      return await initializeWalletFallback(ndk, mintUrl);
    } else {
      throw error;
    }
  }
};

/**
 * Fallback initialization that avoids potential circular reference issues
 * @param {NDK} ndk - NDK instance
 * @param {string} mintUrl - Mint URL
 * @returns {Promise<NDKCashuWallet>} Initialized wallet
 */
const initializeWalletFallback = async (ndk, mintUrl) => {
  console.log('[NDKWalletUtils] Using fallback wallet initialization...');

  try {
    // Create wallet instance
    const wallet = new NDKCashuWallet(ndk);
    wallet.mints = [mintUrl];

    // Generate P2PK only (skip publish for now)
    console.log('[NDKWalletUtils] Fallback: Generating P2PK only...');
    await wallet.getP2pk();
    
    if (!wallet.p2pk) {
      throw new Error('P2PK generation failed in fallback mode');
    }

    console.log("[NDKWalletUtils] Fallback: P2PK generated successfully:", wallet.p2pk);
    console.log("[NDKWalletUtils] Fallback: Wallet ready (publish skipped to avoid circular reference)");

    return wallet;

  } catch (fallbackError) {
    console.error('[NDKWalletUtils] Fallback initialization also failed:', fallbackError);
    throw new Error(`Both standard and fallback wallet initialization failed. Please try refreshing the page: ${fallbackError.message}`);
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

    console.log('[NDKWalletUtils] Wallet instance created, generating P2PK...');
    
    // REQUIRED: Generate and publish the wallet's P2PK
    try {
      await wallet.getP2pk();
      console.log("[NDKWalletUtils] P2PK generated successfully:", wallet.p2pk);
    } catch (p2pkError) {
      console.error('[NDKWalletUtils] P2PK generation failed:', p2pkError);
      throw new Error(`P2PK generation failed: ${p2pkError.message}`);
    }

    // REQUIRED: Publish the wallet's mint list for token/nutzap reception
    console.log('[NDKWalletUtils] Publishing wallet configuration...');
    try {
      await wallet.publish();
      console.log("[NDKWalletUtils] Wallet published successfully");
    } catch (publishError) {
      console.error('[NDKWalletUtils] Wallet publish failed:', publishError);
      
      // If publish fails but we have p2pk, the wallet might still be usable
      if (wallet.p2pk) {
        console.warn('[NDKWalletUtils] Continuing with wallet despite publish failure - P2PK is available');
        return wallet;
      } else {
        throw new Error(`Wallet publish failed: ${publishError.message}`);
      }
    }

    return wallet;

  } catch (error) {
    console.error('[NDKWalletUtils] Wallet initialization failed:', error);
    
    // Provide more specific error messages
    if (error.message.includes('circular')) {
      throw new Error('Wallet initialization failed: NDK serialization error. Please try refreshing the page and reconnecting Amber.');
    } else if (error.message.includes('signer')) {
      throw new Error('Wallet initialization failed: Please make sure Amber is connected and try again.');
    } else if (error.message.includes('p2pk')) {
      throw new Error('Wallet initialization failed: Could not generate payment key. Check your connection and try again.');
    } else if (error.message.includes('publish')) {
      throw new Error('Wallet initialization failed: Could not publish wallet configuration. Check your relay connections.');
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