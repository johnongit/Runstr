import { getPublicKey } from 'nostr-tools';
import * as secp256k1 from '@noble/secp256k1';
import { webln } from '@getalby/sdk';

// Fallback relay list for zap requests; adjust as needed or import from config
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay.primal.net'
];

export class NWCWallet {
  constructor() {
    this.secretKey = null;
    this.pubKey = null;
    this.relayUrl = null;
    this.walletPubKey = null;
  }

  async connect(connectionString) {
    try {
      const url = new URL(connectionString);

      // Expect schemes like nostr+walletconnect://<walletPubKey>?relay=...&secret=...
      if (url.protocol !== 'nostr+walletconnect:') {
        throw new Error(`Invalid NWC URL protocol: ${url.protocol}`);
      }

      // Generate a fresh key used only for this NWC session (needed for NIP-47 auth).
      this.secretKey = secp256k1.utils.randomPrivateKey();
      this.pubKey = getPublicKey(this.secretKey);

      // The host portion after the double slashes is the wallet pubkey
      this.walletPubKey = url.hostname || url.pathname.replace(/^\/+/, '');

      // Query string carries relay + secret
      const params = url.searchParams ?? new URLSearchParams(url.search);
      this.relayUrl = params.get('relay');
      this.secret = params.get('secret');

      if (!this.relayUrl || !this.walletPubKey) {
        throw new Error('Missing required relay or wallet pubkey in NWC URI');
      }

      // Initialise the WebLN provider (Alby SDK) with the raw URI
      this.provider = new webln.NostrWebLNProvider({
        nostrWalletConnectUrl: connectionString
      });

      await this.provider.enable();
      return true;
    } catch (error) {
      console.error('NWC connection error:', error);
      throw error;
    }
  }

  async makePayment(paymentRequest) {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      const response = await this.provider.sendPayment(paymentRequest);
      return response;
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  }

  async getBalance() {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      const response = await this.provider.getBalance();
      return response.balance;
    } catch (error) {
      console.error('Get balance error:', error);
      throw error;
    }
  }

  async generateZapInvoice(pubkey, amount = null, content = '') {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      // Determine zap amount: use provided amount or fallback to stored/default value
      let zapAmount = amount;
      if (!zapAmount) {
        const storedAmount = localStorage.getItem('defaultZapAmount');
        zapAmount = storedAmount ? parseInt(storedAmount, 10) : 1000; // default 1000 sats
      }

      const zapRequest = {
        kind: 9734,
        content,
        tags: [
          ['p', pubkey],
          ['amount', zapAmount.toString()],
          ['relays', ...DEFAULT_RELAYS]
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      const signedZapRequest = await window.nostr.signEvent(zapRequest);
      const encodedZapRequest = btoa(JSON.stringify(signedZapRequest));

      const invoice = await this.provider.makeInvoice({
        amount: zapAmount,
        defaultMemo: `Zap for ${pubkey}`,
        zapRequest: encodedZapRequest
      });

      return invoice;
    } catch (error) {
      console.error('Generate zap invoice error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.provider) {
        await this.provider.disable();
      }
      this.provider = null;
      this.secretKey = null;
      this.pubKey = null;
      this.relayUrl = null;
      this.walletPubKey = null;
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }
}
