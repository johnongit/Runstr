import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NostrContext } from '../contexts/NostrContext';
import { NWCWallet } from '../services/nwcWallet';

export const NWCWalletConnector = () => {
  const { wallet, setWallet } = useAuth();
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [nwcUrl, setNwcUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [donationStatus, setDonationStatus] = useState({ message: '', isError: false });

  // RUNSTR Lightning address
  const RUNSTR_LIGHTNING = 'runstr@geyser.fund';

  // Check for saved connection on mount
  useEffect(() => {
    const savedNwcUrl = localStorage.getItem('nwcConnectionString');
    if (savedNwcUrl) {
      connectWallet(savedNwcUrl);
    }
  }, []);

  // Update zapAmountInput when defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const connectWallet = async (connectionString) => {
    setConnecting(true);
    setConnectionError('');
    
    try {
      const nwcWallet = new NWCWallet();
      const connected = await nwcWallet.connect(connectionString);
      
      if (connected) {
        // Save connection string
        localStorage.setItem('nwcConnectionString', connectionString);
        
        // Set up wallet in context
        setWallet({
          provider: nwcWallet,
          isEnabled: () => true,
          makePayment: async (invoice) => {
            return await nwcWallet.makePayment(invoice);
          },
          sendPayment: async (invoice) => {
            return await nwcWallet.makePayment(invoice);
          },
          getBalance: async () => {
            return await nwcWallet.getBalance();
          },
          generateZapInvoice: async (pubkey, amount, content) => {
            return await nwcWallet.generateZapInvoice(pubkey, amount, content);
          }
        });
        
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect NWC wallet:', error);
      setConnectionError(error.message || 'Failed to connect to wallet');
      localStorage.removeItem('nwcConnectionString');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = () => {
    if (nwcUrl.trim()) {
      connectWallet(nwcUrl.trim());
    }
  };

  const handleDisconnect = async () => {
    try {
      if (wallet?.provider) {
        await wallet.provider.disconnect();
      }
      setWallet(null);
      setIsConnected(false);
      localStorage.removeItem('nwcConnectionString');
      setNwcUrl('');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Added function to check wallet connection status
  const checkWalletConnection = async () => {
    const savedNwcUrl = localStorage.getItem('nwcConnectionString');
    if (savedNwcUrl && !isConnected) {
      console.log('Reconnecting wallet from saved connection');
      await connectWallet(savedNwcUrl);
    }
  };

  // Add effect to recheck connection when the component is focused
  useEffect(() => {
    // Check connection initially
    checkWalletConnection();
    
    // Add event listeners for visibility change to recheck connection when tab is focused
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkWalletConnection();
      }
    });
    
    return () => {
      document.removeEventListener('visibilitychange', () => {});
    };
  }, []);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }
  };

  const handleDonate = async (lightning, name) => {
    if (!wallet) {
      setDonationStatus({ 
        message: 'Wallet not connected. Please connect your wallet first.', 
        isError: true 
      });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
      return;
    }

    try {
      setDonationStatus({ message: `Sending ${defaultZapAmount} sats to ${name}...`, isError: false });

      // Parse the Lightning address and create the payment URL
      let lnurlEndpoint;
      if (lightning.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lightning.split('@');
        lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      } else {
        // In case a raw LNURL is provided
        lnurlEndpoint = lightning;
      }

      // First get the LNURL-pay metadata
      const response = await fetch(lnurlEndpoint);
      const lnurlPayData = await response.json();

      if (!lnurlPayData.callback) {
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }

      // Amount in millisatoshis (convert sats to millisats)
      const amount = defaultZapAmount * 1000;

      // Check if amount is within min/max bounds
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }

      // Construct the callback URL with amount
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      
      // Add comment for the donation
      if (lnurlPayData.commentAllowed && lnurlPayData.commentAllowed > 0) {
        const comment = `Donation to ${name} from RUNSTR app! ⚡️`;
        callbackUrl.searchParams.append('comment', comment);
      }

      // Get the invoice
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();

      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Pay using the NWC wallet
      await wallet.makePayment(invoiceData.pr);

      setDonationStatus({ message: `Successfully donated ${defaultZapAmount} sats to ${name}! ⚡️`, isError: false });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    } catch (error) {
      console.error(`Error donating to ${name}:`, error);
      setDonationStatus({ message: `Failed to donate: ${error.message}`, isError: true });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    }
  };

  return (
    <div className="nwc-wallet-connector">
      <div className="connection-section">
        <h3>Connect your Lightning Wallet with NWC</h3>
        
        {!isConnected ? (
          <>
            <p className="helper-text">
              Enter your Nostr Wallet Connect URL from your wallet (e.g. Alby, Mutiny, etc.)
            </p>
            <div className="input-with-button">
              <input
                type="text"
                value={nwcUrl}
                onChange={(e) => setNwcUrl(e.target.value)}
                placeholder="nostr+walletconnect://..."
                className="nwc-input"
              />
              <button 
                onClick={handleConnect} 
                disabled={connecting || !nwcUrl.trim()}
                className="connect-button"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
            {connectionError && (
              <p className="error-message">{connectionError}</p>
            )}
          </>
        ) : (
          <div className="connected-state">
            <p className="success-message">Wallet connected successfully! ⚡️</p>
            <button onClick={handleDisconnect} className="disconnect-button">
              Disconnect Wallet
            </button>
          </div>
        )}
      </div>

      <div className="zap-settings-section">
        <h3>Default Zap Settings</h3>
        <div className="zap-amount-setting">
          <label htmlFor="defaultZapAmount">Default Zap Amount (sats):</label>
          <div className="input-with-button">
            <input
              id="defaultZapAmount"
              type="number"
              min="1"
              value={zapAmountInput}
              onChange={(e) => setZapAmountInput(e.target.value)}
              placeholder="Default zap amount in sats"
            />
            <button 
              onClick={handleUpdateZapAmount} 
              disabled={!zapAmountInput || parseInt(zapAmountInput, 10) <= 0}
              className="save-button"
            >
              Save
            </button>
          </div>
          {showSuccessMessage && (
            <div className="success-message">Default zap amount updated successfully!</div>
          )}
          <p className="current-setting">Current default: {defaultZapAmount} sats</p>
        </div>
      </div>

      <div className="donation-section">
        <h3>Support RUNSTR</h3>
        <p>Donate to help the project continue building awesome software!</p>
        
        <div className="donation-buttons">
          <button 
            className="donate-button runstr" 
            onClick={() => handleDonate(RUNSTR_LIGHTNING, 'RUNSTR')}
            disabled={!isConnected}
          >
            ⚡️ Zap RUNSTR ({defaultZapAmount} sats)
          </button>
        </div>
        
        {donationStatus.message && (
          <div className={`donation-status ${donationStatus.isError ? 'error' : 'success'}`}>
            {donationStatus.message}
          </div>
        )}
        
        <p className="donation-note">
          Your donations help fund development of free and open source software.
        </p>
      </div>
    </div>
  );
}; 