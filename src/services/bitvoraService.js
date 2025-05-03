/**
 * Bitvora API Service
 * Core service for interacting with Bitvora Bitcoin API
 */

import axios from 'axios';

// API configuration
const BITVORA_API_URL = 'https://api.bitvora.com/v1';
const BITVORA_API_KEY = '48|31651aad-632f-4162-8eb9-d6146587d497';
const NETWORK_TYPE = 'mainnet'; // or 'testnet', 'signet'

// DEMO_MODE: Set to false to use the real API with the correct key format
const DEMO_MODE = false; // API connection confirmed working with full key format

// Create axios instance with auth headers
const bitvoraApi = axios.create({
  baseURL: BITVORA_API_URL,
  headers: {
    'Authorization': `Bearer ${BITVORA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
bitvoraApi.interceptors.response.use(
  response => response,
  error => {
    console.error('Bitvora API error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Simulate network delay for demo mode
const simulateDelay = async (ms = 500) => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Bitvora API Service
 */
const bitvoraService = {
  /**
   * Check API connection status and get balance
   * @returns {Promise<Object>} Balance and connection status
   */
  checkConnection: async () => {
    if (DEMO_MODE) {
      await simulateDelay();
      return {
        valid: true,
        balance: 150000, // 150,000 sats
        message: 'Demo mode: Connection simulated'
      };
    }

    try {
      const response = await bitvoraApi.get('/transactions/balance');
      return {
        valid: true,
        balance: response.data.data.balance,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        valid: false,
        message: error.response?.data?.message || 'Connection failed'
      };
    }
  },

  /**
   * Get current Bitcoin balance
   * @returns {Promise<number>} Balance in satoshis
   */
  getBalance: async () => {
    if (DEMO_MODE) {
      await simulateDelay();
      return 150000; // 150,000 sats
    }

    const response = await bitvoraApi.get('/transactions/balance');
    return response.data.data.balance;
  },

  /**
   * Send Bitcoin to a recipient
   * @param {string} destination - Lightning address, invoice, or Bitcoin address
   * @param {number} amount - Amount in satoshis
   * @param {string} reason - Reason/description for the payment
   * @param {Object} metadata - Additional metadata to store with transaction
   * @returns {Promise<Object>} Transaction result
   */
  sendBitcoin: async (destination, amount, reason, metadata = {}) => {
    if (DEMO_MODE) {
      await simulateDelay(1000);
      return {
        success: true,
        txid: `demo_tx_${Date.now().toString(16)}`,
        amount: amount,
        destination: destination,
        fee: Math.floor(amount * 0.01), // Simulate 1% fee
        network: NETWORK_TYPE,
        rail: 'lightning',
        status: 'settled',
        timestamp: new Date().toISOString()
      };
    }
    
    // First estimate the transaction to validate destination
    try {
      const estimateResponse = await bitvoraApi.post('/bitcoin/withdraw/estimate', {
        amount: amount,
        currency: 'sats',
        destination: destination
      });
      
      // Check success probability
      const probability = estimateResponse.data.data.success_probability;
      if (probability < 0.9) {
        return {
          success: false,
          error: `Low success probability (${probability * 100}%)`
        };
      }
      
      // If estimate looks good, proceed with actual payment
      const paymentResponse = await bitvoraApi.post('/bitcoin/withdraw/confirm', {
        amount: amount,
        currency: 'sats',
        destination: destination,
        metadata: {
          ...metadata,
          reason: reason
        }
      });
      
      return {
        success: true,
        txid: paymentResponse.data.data.id,
        amount: paymentResponse.data.data.amount_sats,
        destination: paymentResponse.data.data.recipient,
        fee: paymentResponse.data.data.fee_sats,
        network: paymentResponse.data.data.network_type,
        rail: paymentResponse.data.data.rail_type,
        status: paymentResponse.data.data.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Payment failed'
      };
    }
  },
  
  /**
   * Check payment status
   * @param {string} txid - Transaction ID to check
   * @returns {Promise<Object>} Transaction status
   */
  checkPaymentStatus: async (txid) => {
    if (DEMO_MODE) {
      await simulateDelay();
      
      // In demo mode, always return settled status for recent transactions,
      // and randomly pending/settled for older ones to simulate realistic behavior
      const isRecent = txid.includes(Date.now().toString(16).substring(0, 6));
      const settled = isRecent ? true : Math.random() > 0.3;
      
      return {
        success: true,
        txid: txid,
        status: settled ? 'settled' : 'pending',
        amount: Math.floor(Math.random() * 10000) + 1000,
        recipient: `demo_recipient_${txid.substring(0, 8)}@bitvora.me`,
        network: NETWORK_TYPE,
        rail: Math.random() > 0.5 ? 'lightning' : 'onchain',
        settled: settled,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    try {
      const response = await bitvoraApi.get(`/transactions/withdrawals/${txid}`);
      const data = response.data.data;
      
      return {
        success: true,
        txid: data.id,
        status: data.status,
        amount: data.amount_sats,
        recipient: data.recipient,
        network: data.network_type,
        rail: data.rail_type,
        settled: data.status === 'settled',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      return {
        success: false,
        txid,
        error: error.response?.data?.message || error.message || 'Status check failed'
      };
    }
  },
  
  /**
   * Create a lightning address for receiving Bitcoin
   * @param {Object} metadata - Additional metadata to associate with the address
   * @returns {Promise<Object>} Lightning address details
   */
  createLightningAddress: async (metadata = {}) => {
    if (DEMO_MODE) {
      await simulateDelay(800);
      const randomHandle = `user${Math.floor(Math.random() * 100000)}`;
      
      return {
        success: true,
        id: `demo_addr_${Date.now().toString(16)}`,
        address: `${randomHandle}@bitvora.me`,
        handle: randomHandle,
        domain: 'bitvora.me',
        created_at: new Date().toISOString()
      };
    }
    
    try {
      const response = await bitvoraApi.post('/bitcoin/deposit/lightning-address', {
        handle: "", // Leave blank for random handle
        domain: "", // Use default domain
        metadata
      });
      
      return {
        success: true,
        id: response.data.data.id,
        address: response.data.data.address,
        handle: response.data.data.handle,
        domain: response.data.data.domain,
        created_at: response.data.data.created_at
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create lightning address'
      };
    }
  },
  
  /**
   * Create a lightning invoice for receiving Bitcoin
   * @param {number} amount - Amount in satoshis
   * @param {string} description - Description for the invoice
   * @param {number} expirySeconds - Expiry time in seconds
   * @param {Object} metadata - Additional metadata to associate with the invoice
   * @returns {Promise<Object>} Lightning invoice details
   */
  createLightningInvoice: async (amount, description, expirySeconds = 3600, metadata = {}) => {
    if (DEMO_MODE) {
      await simulateDelay(800);
      
      return {
        success: true,
        id: `demo_inv_${Date.now().toString(16)}`,
        payment_request: `lnbc${amount}n1p38qgaupp5xwkm7tf3zgd3s8xw5s8s7zvzrytfkthggjcf8wwtgsh2lwsfcdksdqqcqzzsxqyz5vqsp5n7qy0stsg4kr0y9hstwl9v2nukznqnhwkpz8yksfmea2gcqjprd9sq9qyyssqcw6e9z5atkwfvnhgvrtpx9gx3rnc9qwkaa6ftkk9kgykzawnfpgp9qftmz5ewm99llypw5h5u2jwzmvj7myuwa0wvvs0zu0cqvcf8wc4qp92r3ds`,
        amount: amount,
        description: description,
        settled: false,
        created_at: new Date().toISOString()
      };
    }
    
    try {
      const response = await bitvoraApi.post('/bitcoin/deposit/lightning-invoice', {
        amount,
        currency: 'sats',
        description,
        expiry_seconds: expirySeconds,
        metadata
      });
      
      return {
        success: true,
        id: response.data.data.id,
        payment_request: response.data.data.payment_request,
        amount: response.data.data.amount_sats,
        description: response.data.data.memo,
        settled: response.data.data.settled,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create lightning invoice'
      };
    }
  },
  
  /**
   * Get transaction history
   * @returns {Promise<Array>} Transaction history
   */
  getTransactions: async () => {
    if (DEMO_MODE) {
      await simulateDelay(1000);
      
      // Generate some dummy transactions for demo mode
      const demoTransactions = [];
      const types = ['deposit', 'withdrawal'];
      const statuses = ['settled', 'pending', 'failed'];
      const rails = ['lightning', 'onchain'];
      
      for (let i = 0; i < 10; i++) {
        const amount = Math.floor(Math.random() * 50000) + 1000;
        const txType = types[Math.floor(Math.random() * types.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const rail = rails[Math.floor(Math.random() * rails.length)];
        const timestamp = new Date(Date.now() - (i * 86400000 * Math.random())).toISOString();
        
        demoTransactions.push({
          id: `demo_tx_${i}_${Date.now().toString(16)}`,
          type: txType,
          amount_sats: amount,
          fee_sats: Math.floor(amount * 0.01),
          status: status,
          rail_type: rail,
          network_type: NETWORK_TYPE,
          created_at: timestamp,
          updated_at: timestamp,
          recipient: txType === 'withdrawal' ? `recipient_${i}@bitvora.me` : undefined,
          settled: status === 'settled'
        });
      }
      
      return {
        success: true,
        transactions: demoTransactions
      };
    }
    
    try {
      const response = await bitvoraApi.get('/transactions');
      return {
        success: true,
        transactions: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to retrieve transactions'
      };
    }
  },
  
  /**
   * Check lightning invoice status
   * @param {string} invoiceId - Invoice ID to check
   * @returns {Promise<Object>} Invoice status
   */
  checkInvoiceStatus: async (invoiceId) => {
    if (DEMO_MODE) {
      await simulateDelay();
      
      // In demo mode, return settled for some invoices to simulate payments
      const isSettled = invoiceId.includes('settled') || Math.random() > 0.7;
      
      return {
        success: true,
        id: invoiceId,
        settled: isSettled,
        amount: Math.floor(Math.random() * 10000) + 1000,
        payment_request: 'lnbc1500n1p38qgaupp5yf5gztlrdn0aw68y7ul8nwrc5ut8c2mrzwatmjeqk2zthx87ussdqqcqzzsxqyz5vqsp5n7qy0stsg4kr0y9hst',
        memo: 'Demo invoice payment'
      };
    }
    
    try {
      const response = await bitvoraApi.get(`/bitcoin/deposit/lightning-invoice/${invoiceId}`);
      const data = response.data.data;
      
      return {
        success: true,
        id: data.id,
        settled: data.settled,
        amount: data.amount_sats,
        payment_request: data.payment_request,
        memo: data.memo
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to check invoice status'
      };
    }
  }
};

export default bitvoraService; 