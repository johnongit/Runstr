import { NWCWalletConnector } from '../components/NWCWalletConnector';

export const NWC = () => {
  return (
    <div className="nwc-page">
      <h2>Lightning Wallet Connection</h2>
      <p className="nwc-description">
        Connect your Lightning wallet using Nostr Wallet Connect (NWC). This allows you to send zaps and make payments directly through your preferred Lightning wallet.
      </p>
      <NWCWalletConnector />
      
      <div className="wallet-instructions">
        <h3>How to Get Your NWC URL</h3>
        <div className="instruction-block">
          <h4>From Alby</h4>
          <ol>
            <li>Open your Alby account</li>
            <li>Go to Settings → Connections</li>
            <li>Click "Create new connection"</li>
            <li>Name it "RUNSTR" and set permissions for payments</li>
            <li>Copy the generated URL starting with "nostr+walletconnect://"</li>
          </ol>
        </div>
        
        <div className="instruction-block">
          <h4>From Mutiny Wallet</h4>
          <ol>
            <li>Open Mutiny</li>
            <li>Go to Settings → Developer</li>
            <li>Select "Nostr Wallet Connect"</li>
            <li>Create a new connection for RUNSTR</li>
            <li>Copy the NWC URL</li>
          </ol>
        </div>
        
        <p className="wallet-note">
          For more compatible wallets, check out <a href="https://github.com/getAlby/awesome-nwc" target="_blank" rel="noopener noreferrer">the list of NWC-compatible wallets</a>.
        </p>
      </div>
    </div>
  );
};
