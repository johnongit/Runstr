import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { Button, init, onConnected } from '@getalby/bitcoin-connect-react';

// Initialize Bitcoin Connect
init({
  appName: "Nostr Run Club",
});

export const WalletConnect = () => {
  const { setWallet } = useAuth();

  useEffect(() => {
    // Set up connection event listener for wallet state management
    const unsub = onConnected((provider) => {
      // Create a wallet interface that matches your app's needs
      const bitcoinWallet = {
        provider,
        makePayment: async (invoice) => {
          return await provider.sendPayment(invoice);
        },
        getBalance: async () => {
          return await provider.getBalance();
        }
      };

      setWallet(bitcoinWallet);
    });

    return () => {
      unsub();
    };
  }, [setWallet]);

  return (
    <div className="wallet-connect">
      <div className="connection-section">
        <h3>Connect your Bitcoin Wallet</h3>
        <Button 
          onConnect={(provider) => {
            // The onConnected event handler above will handle the wallet setup
            console.log('Wallet connected through button:', provider);
          }}
        />
        <p className="helper-text">
          Connect using Alby extension or other Bitcoin Connect compatible wallets
        </p>
      </div>
    </div>
  );
}; 