import { getPublicKey } from 'nostr-tools';
import * as secp256k1 from '@noble/secp256k1';
import { nwc } from '@getalby/sdk';
import { RELAYS } from '../utils/nostr';

export class NWCWallet {
  constructor() {
    this.client = null;
    this.secretKey = null;
    this.pubKey = null;
    this.relayUrl = null;
    this.walletPubKey = null;
    this.isConnected = false;
  }

  async connect(connectionString) {
    try {
      if (!connectionString.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC URL format. Must start with nostr+walletconnect://');
      }

      // Initialize the NWC client
      this.client = new nwc.NWCClient({
        nostrWalletConnectUrl: connectionString
      });

      // Test the connection by fetching wallet info
      await this.client.getInfo();
      
      this.isConnected = true;
      console.log('NWC wallet connected successfully');
      return true;
    } catch (error) {
      console.error('NWC connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async makePayment(paymentRequest) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Wallet not connected');
      }

      const response = await this.client.payInvoice({
        invoice: paymentRequest
      });
      
      return response;
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  }

  async getBalance() {
    try {
      if (!this.client || !this.isConnected) {
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
      if (!this.client || !this.isConnected) {
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

      // Create the invoice
      const response = await this.client.makeInvoice({
        amount: zapAmount,
        memo: `Zap for ${pubkey}`,
        zapRequest: encodedZapRequest
      });

      return response.paymentRequest || response.invoice || response;
    } catch (error) {
      console.error('Generate zap invoice error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      // The NWC client doesn't have a formal disconnect method,
      // so we'll just clean up our internal state
      this.client = null;
      this.secretKey = null;
      this.pubKey = null;
      this.relayUrl = null;
      this.walletPubKey = null;
      this.isConnected = false;
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }
}
