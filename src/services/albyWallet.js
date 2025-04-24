import { LN, nwc } from '@getalby/sdk';

/**
 * AlbyWallet class provides a complete wallet implementation using
 * the Alby SDK for NWC functionality
 */
export class AlbyWallet {
  constructor() {
    this.client = null;
    this.lnClient = null;
    this.nwcClient = null;
    this.isConnected = false;
    this.connectionString = null;
    this.connectionCheckInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastConnectionCheck = 0;
  }

  /**
   * Connect to a wallet using NWC URL
   * @param {string} url - NWC connection URL or authorization URL
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect(url) {
    try {
      console.log('Connecting to wallet with URL:', url.substring(0, 20) + '...');

      // Clean up any existing connection
      this.disconnect();

      if (url.startsWith('nostr+walletconnect://')) {
        // Direct NWC connection string
        this.connectionString = url;
        localStorage.setItem('nwcConnectionString', url);
        
        // Create both clients
        this.nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: url });
        this.lnClient = new LN(url);
      }
      else if (url.startsWith('https://')) {
        // Authorization URL
        localStorage.setItem('nwcAuthUrl', url);
        
        try {
          // Create NWC client from authorization URL
          this.nwcClient = await nwc.NWCClient.fromAuthorizationUrl(url, {
            name: "RUNSTR App " + Date.now(),
          });
          
          // Store the connection and create LN client
          const nwcUrl = this.nwcClient.getNostrWalletConnectUrl();
          this.connectionString = nwcUrl;
          localStorage.setItem('nwcConnectionString', nwcUrl);
          this.lnClient = new LN(nwcUrl);
        } catch (error) {
          console.error('Failed to connect via authorization URL:', error);
          throw error;
        }
      }
      else {
        throw new Error('Invalid connection format. Must start with nostr+walletconnect:// or https://');
      }

      // Test the connection
      await this.getInfo();
      
      this.isConnected = true;
      this.lastConnectionCheck = Date.now();
      
      // Set up connection monitoring
      this.startConnectionMonitoring();
      
      return true;
    } catch (error) {
      console.error('Wallet connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Start periodic connection monitoring
   */
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
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      } else {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
      }
    }, 120000); // 2 minutes
  }

  /**
   * Check if the wallet connection is alive
   * @returns {Promise<boolean>} - Connection status
   */
  async checkConnection() {
    // Throttle checks to prevent too many requests
    const now = Date.now();
    if (now - this.lastConnectionCheck < 30000) {
      return this.isConnected;
    }
    
    this.lastConnectionCheck = now;
    
    try {
      if (!this.nwcClient || !this.lnClient) {
        this.isConnected = false;
        return false;
      }
      
      // Try to get wallet info to verify connection
      await this.getInfo();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.warn('Wallet connection check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Ensure the wallet is connected, attempting to reconnect if needed
   * @returns {Promise<boolean>} - Connection status
   */
  async ensureConnected() {
    if (await this.checkConnection()) {
      return true;
    }
    
    // Try to reconnect using saved credentials
    try {
      const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
      if (savedAuthUrl) {
        return await this.connect(savedAuthUrl);
      }
      
      const savedConnectionString = localStorage.getItem('nwcConnectionString');
      if (savedConnectionString) {
        return await this.connect(savedConnectionString);
      }
      
      return false;
    } catch (error) {
      console.error('Failed to reconnect wallet:', error);
      return false;
    }
  }

  /**
   * Get information about the wallet
   * @returns {Promise<Object>} - Wallet information
   */
  async getInfo() {
    try {
      return await this.nwcClient.getInfo();
    } catch (error) {
      console.error('Get wallet info error:', error);
      throw error;
    }
  }

  /**
   * Get the wallet balance
   * @returns {Promise<number>} - Balance in sats
   */
  async getBalance() {
    try {
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }
      
      const response = await this.nwcClient.getBalance();
      // Convert msats to sats
      return Math.floor((response.balance || 0) / 1000);
    } catch (error) {
      console.error('Get balance error:', error);
      throw error;
    }
  }

  /**
   * Make a payment using the connected wallet
   * @param {string} invoice - BOLT11 invoice to pay
   * @returns {Promise<Object>} - Payment result
   */
  async makePayment(invoice) {
    try {
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      // Validate invoice
      if (!invoice || typeof invoice !== 'string') {
        throw new Error('Invalid invoice format');
      }

      // Create abort controller for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      try {
        // Use the LN client for better payment experience
        const response = await this.lnClient.pay(invoice);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // If LN client fails, fallback to NWC client
        if (error.message?.includes('timeout') || error.name === 'AbortError') {
          console.warn('LN client payment timeout, using NWC client instead');
          return await this.nwcClient.payInvoice({ invoice });
        }
        throw error;
      }
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  }

  /**
   * Generate an invoice for receiving payments
   * @param {number} amount - Amount in sats
   * @param {string} memo - Optional description for the invoice
   * @returns {Promise<string>} - BOLT11 invoice
   */
  async generateInvoice(amount, memo = '') {
    try {
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      // Convert sats to msats for NWC API
      const amountMsats = amount * 1000;
      
      const response = await this.nwcClient.makeInvoice({
        amount: amountMsats,
        memo: memo || `Invoice for ${amount} sats`
      });
      
      // Return the invoice string depending on the response format
      return response.paymentRequest || response.invoice || response;
    } catch (error) {
      console.error('Generate invoice error:', error);
      throw error;
    }
  }

  /**
   * Generate a zap invoice for the specified pubkey
   * @param {string} pubkey - Target pubkey to zap
   * @param {number} amount - Amount in sats
   * @param {string} content - Optional content for the zap
   * @returns {Promise<string>} - BOLT11 invoice
   */
  async generateZapInvoice(pubkey, amount, content = '') {
    try {
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      if (!pubkey) {
        throw new Error('Pubkey is required for zap invoice');
      }

      // List of reliable relays for zap requests
      const relays = [
        "wss://relay.damus.io",
        "wss://nos.lol", 
        "wss://relay.nostr.band"
      ];

      // Create zap request event as a plain object instead of using NostrEvent
      const zapRequest = {
        kind: 9734,
        content: content || '',
        tags: [
          ['p', pubkey],
          ['amount', amount.toString()],
          ['relays', ...relays]
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      // Sign the zap request using window.nostr if available
      let encodedZapRequest;
      if (window.nostr) {
        // No need to call toObject() since it's already a plain object
        const signedZapRequest = await window.nostr.signEvent(zapRequest);
        encodedZapRequest = btoa(JSON.stringify(signedZapRequest));
      } else {
        // Handle case where window.nostr is not available (fallback)
        throw new Error('Nostr extension not available for signing zap request');
      }

      // Create timeout handler
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      try {
        // Try standard format first
        const response = await this.nwcClient.makeInvoice({
          amount: amount * 1000, // Convert to msats
          memo: `Zap for ${pubkey.substring(0, 8)}...`,
          zapRequest: encodedZapRequest
        });
        
        clearTimeout(timeoutId);
        return response.paymentRequest || response.invoice || response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Try alternative format if the first attempt fails
        console.error('First zap invoice attempt failed:', error);
        
        // Try alternative format with zap_request
        try {
          const altResponse = await this.nwcClient.makeInvoice({
            amount: amount * 1000,
            description: `Zap for ${pubkey.substring(0, 8)}...`,
            zap_request: encodedZapRequest
          });
          
          return altResponse.paymentRequest || altResponse.invoice || altResponse;
        } catch (altError) {
          console.error('Alternative format failed:', altError);
          
          // Last resort: generate a regular invoice without zap request
          const basicResponse = await this.nwcClient.makeInvoice({
            amount: amount * 1000,
            memo: `Zap for ${pubkey.substring(0, 8)}...`
          });
          
          return basicResponse.paymentRequest || basicResponse.invoice || basicResponse;
        }
      }
    } catch (error) {
      console.error('Generate zap invoice error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the wallet
   * @returns {Promise<boolean>} - Disconnect success status
   */
  async disconnect() {
    try {
      // Clear connection monitoring
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
      
      // Clean up client instances
      this.nwcClient = null;
      this.lnClient = null;
      this.isConnected = false;
      this.connectionString = null;
      this.reconnectAttempts = 0;
      
      // Clear stored connection info
      localStorage.removeItem('nwcAuthUrl');
      localStorage.removeItem('nwcConnectionString');
      
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }

  /**
   * Get the current connection state
   * @returns {Object} - Connection state information
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      hasNwcClient: !!this.nwcClient,
      hasLnClient: !!this.lnClient,
      lastChecked: this.lastConnectionCheck
    };
  }
} 