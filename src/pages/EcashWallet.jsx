import { EcashWalletConnector } from '../components/EcashWalletConnector';

export const EcashWallet = () => {
  return (
    <div className="ecash-wallet-page">
      <h2>Ecash Wallet (NIP-60)</h2>
      <p className="ecash-description">
        Connect to Cashu mints to manage ecash tokens. This wallet stores your tokens in encrypted Nostr events 
        and syncs across all your RUNSTR apps. Send and receive ecash privately with nutzaps.
      </p>
      <EcashWalletConnector />
    </div>
  );
}; 