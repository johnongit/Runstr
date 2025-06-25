import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { NDKCashuWallet, NDKNutzapMonitor } from '@nostr-dev-kit/ndk-wallet';
import { NDKUser } from '@nostr-dev-kit/ndk';

/**
 * Hook for monitoring incoming nutzaps (NIP-61)
 * Automatically detects and redeems incoming cashu tokens via nostr events
 */
export const useNutzapMonitor = () => {
  const { ndk, publicKey } = useContext(NostrContext);
  const [monitor, setMonitor] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recentNutzaps, setRecentNutzaps] = useState([]);

  useEffect(() => {
    if (!ndk || !publicKey) {
      console.log('[useNutzapMonitor] NDK or publicKey not available');
      return;
    }

    const setupMonitor = async () => {
      try {
        console.log('[useNutzapMonitor] Setting up nutzap monitor for user:', publicKey.substring(0, 8) + '...');

        // Create NDK User instance
        const user = new NDKUser({ pubkey: publicKey });

        // Create nutzap monitor
        const nutzapMonitor = new NDKNutzapMonitor(ndk, user);

        // Create wallet for the monitor
        const wallet = new NDKCashuWallet(ndk);
        
        // Initialize wallet if needed
        if (!wallet.p2pk) {
          await wallet.getP2pk();
          await wallet.publish();
        }

        // Assign wallet to monitor
        nutzapMonitor.wallet = wallet;

        // Set up event listeners
        nutzapMonitor.on("seen", (nutzap) => {
          console.log("[useNutzapMonitor] Seen new nutzap:", nutzap.id);
          setRecentNutzaps(prev => [...prev.slice(-9), { 
            id: nutzap.id, 
            type: 'seen', 
            timestamp: Date.now() 
          }]);
        });

        nutzapMonitor.on("redeem", (nutzaps, amount) => {
          console.log(`[useNutzapMonitor] Redeemed ${nutzaps.length} nutzaps for ${amount} sats`);
          setRecentNutzaps(prev => [...prev.slice(-9), { 
            id: nutzaps[0]?.id, 
            type: 'redeemed', 
            amount, 
            count: nutzaps.length,
            timestamp: Date.now() 
          }]);
        });

        nutzapMonitor.on("spent", (nutzap) => {
          console.log("[useNutzapMonitor] Nutzap was already spent:", nutzap.id);
          setRecentNutzaps(prev => [...prev.slice(-9), { 
            id: nutzap.id, 
            type: 'spent', 
            timestamp: Date.now() 
          }]);
        });

        nutzapMonitor.on("failed", (nutzap, error) => {
          console.log(`[useNutzapMonitor] Failed to redeem nutzap ${nutzap.id}:`, error);
          setRecentNutzaps(prev => [...prev.slice(-9), { 
            id: nutzap.id, 
            type: 'failed', 
            error: error.message,
            timestamp: Date.now() 
          }]);
        });

        // Start monitoring
        await nutzapMonitor.start({
          pageSize: 10,
        });

        setMonitor(nutzapMonitor);
        setIsMonitoring(true);
        console.log('[useNutzapMonitor] Nutzap monitoring started successfully');

      } catch (error) {
        console.error('[useNutzapMonitor] Error setting up monitor:', error);
      }
    };

    setupMonitor();

    // Cleanup on unmount
    return () => {
      if (monitor) {
        console.log('[useNutzapMonitor] Stopping nutzap monitor');
        monitor.stop();
        setIsMonitoring(false);
      }
    };
  }, [ndk, publicKey]);

  return {
    isMonitoring,
    recentNutzaps,
    monitor
  };
}; 