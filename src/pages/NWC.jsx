import { NWCWalletConnector } from '../components/NWCWalletConnector';

export const NWC = () => {
  return (
    <div className="nwc-page">
      <h2>Lightning Wallet Connection</h2>
      <p className="nwc-description">
        Connect your Lightning wallet using Nostr Wallet Connect (NWC). This allows you to send zaps and make payments directly through your preferred Lightning wallet.
      </p>
      <NWCWalletConnector />
    </div>
  );
};
