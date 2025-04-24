import { useState, useEffect, useContext, useRef, useCallback } from 'react';
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
  const connectionCheckInterval = useRef(null);

  // RUNSTR Lightning address
  const RUNSTR_LIGHTNING = 'runstr@geyser.fund';

  // Function for reconnection - defined before it's used
  const reconnectWallet = useCallback(async () => {
    try {
      // Try to reconnect with any saved credentials
      if (wallet?.provider) {
        const connected = await wallet.provider.ensureConnected();
        setIsConnected(connected);
        return connected;
      } else {
        // If no provider exists, create a new one and try to connect
        const nwcWallet = new NWCWallet();
        const connected = await nwcWallet.ensureConnected();
        
        if (connected) {
          setWallet({
            provider: nwcWallet,
            isEnabled: () => nwcWallet.isConnected,
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
            },
            checkConnection: async () => {
              return await nwcWallet.checkConnection();
            }
          });
          setIsConnected(true);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to reconnect wallet:', err);
      setIsConnected(false);
      return false;
    }
  }, [wallet, setWallet]);

  // Connection check function using useCallback to avoid circular dependencies
  const checkWalletConnection = useCallback(async () => {
    // Don't check if no wallet exists
    if (!wallet?.provider) {
      setIsConnected(false);
      return false;
    }
    
    try {
      // Use the provider's connection check method
      const connectionActive = await wallet.provider.checkConnection();
      
      // Update UI state based on connection check
      setIsConnected(connectionActive);
      
      // If connection is lost, try to reconnect
      if (!connectionActive) {
        console.log('Connection lost, attempting to reconnect...');
        await reconnectWallet();
      }
      
      return isConnected;
    } catch (err) {
      console.error('Error checking wallet connection:', err);
      setIsConnected(false);
      return false;
    }
  }, [wallet, reconnectWallet, isConnected]);

  // Setup periodic connection checks to maintain wallet health
  const startConnectionChecks = useCallback(() => {
    // Check every 60 seconds if wallet is still connected
    connectionCheckInterval.current = setInterval(() => {
      // Only check if we think we're connected
      if (isConnected && wallet?.provider) {
        console.log('Performing periodic wallet connection check');
        checkWalletConnection();
      }
    }, 60000); // Check every minute
  }, [isConnected, wallet, checkWalletConnection]);
  
  const stopConnectionChecks = useCallback(() => {
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
      connectionCheckInterval.current = null;
    }
  }, []);

  const connectWallet = useCallback(async (connectionInput) => {
    setConnecting(true);
    setConnectionError('');
    
    try {
      const nwcWallet = new NWCWallet();
      const connected = await nwcWallet.connect(connectionInput);
      
      if (connected) {
        // Save connection string based on the type of connection
        if (connectionInput.startsWith('https://')) {
          localStorage.setItem('nwcAuthUrl', connectionInput);
        } else if (connectionInput.startsWith('nostr+walletconnect://')) {
          localStorage.setItem('nwcConnectionString', connectionInput);
        }
        
        // Set up wallet in context
        setWallet({
          provider: nwcWallet,
          isEnabled: () => nwcWallet.isConnected,
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
          },
          // Add connection check method
          checkConnection: async () => {
            return await nwcWallet.checkConnection();
          }
        });
        
        setIsConnected(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to connect NWC wallet:', err);
      setConnectionError(err.message || 'Failed to connect to wallet');
      
      return false;
    } finally {
      setConnecting(false);
    }
  }, [setWallet]);

  // Check for saved connection on mount
  useEffect(() => {
    // Try to reconnect on mount
    const tryReconnect = async () => {
      const connected = await reconnectWallet();
      if (connected) {
        startConnectionChecks();
      }
    };
    
    tryReconnect();
    
    return () => {
      stopConnectionChecks();
    };
  }, [reconnectWallet, startConnectionChecks, stopConnectionChecks]);

  // Update zapAmountInput when defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleConnect = useCallback(() => {
    if (nwcUrl.trim()) {
      connectWallet(nwcUrl.trim());
    }
  }, [nwcUrl, connectWallet]);

  const handleAuthUrlConnect = useCallback(async () => {
    try {
      const authUrl = prompt("Enter wallet authorization URL", "https://");
      if (authUrl && authUrl.startsWith('https://')) {
        setNwcUrl(authUrl);
        await connectWallet(authUrl);
      } else if (authUrl) {
        setConnectionError("Invalid authorization URL. Must start with https://");
      }
    } catch (err) {
      console.error("Error with auth URL connection:", err);
      setConnectionError(err.message || "Failed to connect with authorization URL");
    }
  }, [connectWallet]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (wallet?.provider) {
        await wallet.provider.disconnect();
      }
      setWallet(null);
      setIsConnected(false);
      localStorage.removeItem('nwcConnectionString');
      localStorage.removeItem('nwcAuthUrl');
      setNwcUrl('');
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    }
  }, [wallet, setWallet]);

  // Add effect to recheck connection when the component is focused
  useEffect(() => {
    // Set up event handlers for various page events
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkWalletConnection();
      }
    };
    
    // Define the pageshow handler outside of the addEventListener to allow proper cleanup
    const handlePageShow = (event) => {
      if (event.persisted) {
        checkWalletConnection();
      }
    };
    
    // When page becomes visible (user switches tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // When user navigates back to this page
    window.addEventListener('focus', checkWalletConnection);
    
    // Additional listener for mobile browsers
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkWalletConnection);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [checkWalletConnection]); // Only depends on checkWalletConnection

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
      // Check connection before attempting donation
      if (wallet.checkConnection && !(await wallet.checkConnection())) {
        const reconnected = await reconnectWallet();
        if (!reconnected) {
          throw new Error('Wallet connection is not active. Please reconnect.');
        }
      }
      
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
      
      // Check for empty response
      if (!response.ok) {
        throw new Error(`Payment endpoint error: ${response.status} ${response.statusText}`);
      }
      
      let lnurlPayData;
      try {
        lnurlPayData = await response.json();
      } catch (err) {
        throw new Error('Invalid response from payment endpoint. Please try again.');
      }

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

      // Get the invoice with timeout and error handling
      let invoiceResponse;
      try {
        // Add timeout to fetch call to avoid hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        invoiceResponse = await fetch(callbackUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!invoiceResponse.ok) {
          throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error('Invoice request timed out. Please try again.');
        }
        throw err;
      }
      
      // Parse invoice data with error handling
      let invoiceData;
      try {
        invoiceData = await invoiceResponse.json();
      } catch (err) {
        throw new Error('Failed to parse invoice response. Please try again.');
      }

      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Pay using the NWC wallet
      await wallet.makePayment(invoiceData.pr);

      setDonationStatus({ message: `Successfully donated ${defaultZapAmount} sats to ${name}! ⚡️`, isError: false });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    } catch (err) {
      console.error(`Error donating to ${name}:`, err);
      setDonationStatus({ message: `Failed to donate: ${err.message}`, isError: true });
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
              Enter your Nostr Wallet Connect URL
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
            
            <div className="auth-url-section">
              <button
                onClick={handleAuthUrlConnect}
                disabled={connecting}
                className="auth-url-button"
              >
                Connect with Authorization URL
              </button>
              <p className="helper-text small">
                Use this if you have an authorization URL from your wallet app
              </p>
            </div>
            
            {connectionError && (
              <p className="error-message">{connectionError}</p>
            )}
          </>
        ) : (
          <div className="connected-state">
            <p className="success-message">Wallet connected successfully! ⚡️</p>
            <button 
              onClick={checkWalletConnection} 
              className="check-connection-button"
            >
              Check Connection
            </button>
            <button 
              onClick={handleDisconnect} 
              className="disconnect-button"
            >
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