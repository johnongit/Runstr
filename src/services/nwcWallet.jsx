import { RELAYS } from '../utils/nostr';
import { getPublicKey } from '../utils/nostr';
import { nip19 } from 'nostr-tools';
import NDKNip04 from '@nostr-dev-kit/ndk';

export class NWCWallet {
  constructor() {
    this.client = null;
    this.secretKey = null;
    this.pubKey = null;
    this.relayUrl = null;
    this.walletPubKey = null;
    this.isConnected = false;
    this.authUrl = null;
    this.connectionString = null;
    this.lastConnectionCheck = 0;
    this.connectionCheckInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect(connectionUrl) {
    // Clear any existing reconnection timers
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    try {
      console.log('Connecting NWC wallet with URL:', connectionUrl.substring(0, 20) + '...');
      
      // Store the connection info for potential reconnection
      if (connectionUrl.startsWith('nostr+walletconnect://')) {
        this.connectionString = connectionUrl;
        localStorage.setItem('nwcConnectionString', connectionUrl);
      } else if (connectionUrl.includes('?relay=')) {
        this.authUrl = connectionUrl;
        localStorage.setItem('nwcAuthUrl', connectionUrl);
      }
      
      // Parse the connection URL
      const url = new URL(connectionUrl);
      const params = new URLSearchParams(url.search);
      
      // Extract connection parameters
      this.relayUrl = params.get('relay') || this.relayUrl;
      this.secretKey = params.get('secret') || this.secretKey;
      
      // For nostr+walletconnect format URLs
      if (url.pathname.length > 2) {
        // Extract secret from pathname (removing leading slash)
        this.secretKey = url.pathname.substring(1);
      }
      
      // Generate keys if needed
      if (!this.secretKey) {
        throw new Error('No secret key provided in connection URL');
      }
      
      try {
        this.pubKey = nip19.npubEncode(getPublicKey(this.secretKey));
        this.client = new NDKNip04.NDKPrivateKeySigner(this.secretKey);
      } catch (err) {
        console.error('Error generating keys:', err);
        throw new Error('Invalid secret key in connection URL');
      }
      
      // Reset connection state
      this.reconnectAttempts = 0;
      this.isConnected = false;

      // Test the connection by fetching wallet info
      const info = await this.client.getInfo();
      console.log('Wallet connection info:', info);
      
      this.isConnected = true;
      this.lastConnectionCheck = Date.now();
      console.log('NWC wallet connected successfully');
      
      // Set up periodic connection checks
      this.startConnectionMonitoring();
      
      return true;
    } catch (error) {
      console.error('NWC connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // Add periodic connection monitoring
  startConnectionMonitoring() {
    // Clear any existing interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    // Check connection every 2 minutes
    this.connectionCheckInterval = setInterval(async () => {
      const isConnected = await this.checkConnection();
      
      // If not connected, try to reconnect
      if (!isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Connection lost. Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        await this.ensureConnected();
      } else if (!isConnected) {
        console.log('Max reconnection attempts reached. Please reconnect manually.');
        // Stop trying after max attempts
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      } else {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
      }
    }, 120000); // 2 minutes
  }

  // Add a health check method to verify connection is still alive
  async checkConnection() {
    // Don't check too frequently (limit to once every 30 seconds)
    const now = Date.now();
    if (now - this.lastConnectionCheck < 30000) {
      return this.isConnected;
    }
    
    this.lastConnectionCheck = now;
    
    try {
      if (!this.client) {
        this.isConnected = false;
        return false;
      }
      
      // Try to get info to verify connection is alive
      await this.client.getInfo();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.warn('Wallet connection check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Try to reconnect if connection is lost
  async ensureConnected() {
    if (await this.checkConnection()) {
      return true;
    }
    
    // Try to reconnect using saved connection
    try {
      if (this.authUrl) {
        return await this.connect(this.authUrl);
      } else if (this.connectionString) {
        return await this.connect(this.connectionString);
      } else {
        // Try localStorage as last resort
        const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
        if (savedAuthUrl) {
          return await this.connect(savedAuthUrl);
        }
        
        const savedConnectionString = localStorage.getItem('nwcConnectionString');
        if (savedConnectionString) {
          return await this.connect(savedConnectionString);
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to reconnect wallet:', error);
      return false;
    }
  }

  async makePayment(paymentRequest) {
    try {
      // Ensure wallet is connected before payment
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      // Validate the payment request format
      if (!paymentRequest || typeof paymentRequest !== 'string') {
        throw new Error('Invalid payment request format');
      }

      // Make the payment with timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout
      
      try {
        // Make the payment
        const response = await this.client.payInvoice({
          invoice: paymentRequest
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Ensure we have a proper response
        if (!response) {
          throw new Error('Empty response from wallet');
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // Handle JSON parsing errors specifically
      if (error.message && (
          error.message.includes('JSON') || 
          error.message.includes('Unexpected end')
      )) {
        console.error('JSON parsing error in payment:', error);
        // Mark connection as failed to force reconnect on next attempt
        this.isConnected = false;
        throw new Error('Failed to process wallet response. Please try again or reconnect your wallet.');
      }
      
      // Handle connection errors
      if (error.message && (
          error.message.includes('connection') || 
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.name === 'AbortError'
      )) {
        this.isConnected = false;
        console.error('Connection error in payment:', error);
        throw new Error('Wallet connection lost. Please reconnect your wallet.');
      }
      
      console.error('Payment error:', error);
      throw error;
    }
  }

  async getBalance() {
    try {
      // Ensure wallet is connected before checking balance
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      const response = await this.client.getBalance();
      return response.balance || 0;
    } catch (error) {
      console.error('Get balance error:', error);
      throw error;
    }
  }

  async generateZapInvoice(pubkey, amount = null, content = '') {
    try {
      // Ensure wallet is connected before generating invoice
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      // Use provided amount or get default from localStorage
      let zapAmount = amount;
      if (!zapAmount) {
        const storedAmount = localStorage.getItem('defaultZapAmount');
        zapAmount = storedAmount ? parseInt(storedAmount, 10) : 1000;
      }

      // Create zap request event
      const zapRequest = {
        kind: 9734,
        content: content || '',
        tags: [
          ['p', pubkey],
          ['amount', zapAmount.toString()],
          ['relays', ...RELAYS]
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      // Have NWC sign the request
      const signedZapRequest = await window.nostr.signEvent(zapRequest);
      const encodedZapRequest = btoa(JSON.stringify(signedZapRequest));

      // Create the invoice with timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout
      
      try {
        // Create the invoice
        const response = await this.client.makeInvoice({
          amount: zapAmount,
          memo: `Zap for ${pubkey}`,
          zapRequest: encodedZapRequest
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        return response.paymentRequest || response.invoice || response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // Handle JSON parsing errors
      if (error.message && (
          error.message.includes('JSON') || 
          error.message.includes('Unexpected end')
      )) {
        this.isConnected = false;
        console.error('JSON parsing error in zap invoice generation:', error);
        throw new Error('Failed to process wallet response. Please try again or reconnect your wallet.');
      }
      
      console.error('Generate zap invoice error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      // Clear any monitoring intervals
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
      
      // The NWC client doesn't have a formal disconnect method,
      // so we'll just clean up our internal state
      this.client = null;
      this.secretKey = null;
      this.pubKey = null;
      this.relayUrl = null;
      this.walletPubKey = null;
      this.isConnected = false;
      this.authUrl = null;
      this.connectionString = null;
      this.reconnectAttempts = 0;
      
      // Clear stored connection data
      localStorage.removeItem('nwcAuthUrl');
      localStorage.removeItem('nwcConnectionString');
      
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }
  
  // Returns the connection state
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      hasClient: !!this.client,
      lastChecked: this.lastConnectionCheck
    };
  }
}
