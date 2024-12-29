import { useState } from 'react';
import { NWCWallet } from '../services/nwcWallet.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

export const WalletConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [nwcString, setNwcString] = useState('');
  const { setWallet } = useAuth();

  const connectWithAlby = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (typeof window.nostr === 'undefined') {
        throw new Error('No Nostr provider found. Please install Alby extension.');
      }

      const nwc = new NWCWallet();
      const connectionString = await window.nostr.getConnectURI();
      await nwc.connect(connectionString);
      setWallet(nwc);
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWithNWCString = async (e) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);

    try {
      if (!nwcString.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC string format. Should start with nostr+walletconnect://');
      }

      const nwc = new NWCWallet();
      await nwc.connect(nwcString);
      setWallet(nwc);
      setNwcString('');
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="wallet-connect">
      <div className="connection-section">
        <h3>Option 1: Connect with Alby Extension</h3>
        <button 
          onClick={connectWithAlby}
          disabled={isConnecting}
          className="connect-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect with Alby'}
        </button>
      </div>

      <div className="connection-divider">
        <span>OR</span>
      </div>

      <div className="connection-section">
        <h3>Option 2: Connect with NWC String</h3>
        <form onSubmit={connectWithNWCString} className="nwc-form">
          <input
            type="text"
            value={nwcString}
            onChange={(e) => setNwcString(e.target.value)}
            placeholder="Enter your NWC string (nostr+walletconnect://...)"
            className="nwc-input"
            disabled={isConnecting}
          />
          <button 
            type="submit"
            disabled={!nwcString || isConnecting}
            className="connect-button"
          >
            {isConnecting ? 'Connecting...' : 'Connect with NWC String'}
          </button>
        </form>
      </div>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}; 