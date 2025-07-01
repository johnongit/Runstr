import { getPublicKey, getEventHash, signEvent, nip19 } from 'nostr-tools';
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
    this.walletNpub = null;
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
      this.walletPubKey = url.hostname || (url.pathname && typeof url.pathname === 'string' ? url.pathname.replace(/^\/+/, '') : '');

      // Convert to npub format for compatibility testing
      try {
        this.walletNpub = nip19.npubEncode(this.walletPubKey);
      } catch (error) {
        console.warn('[NWCWallet] Could not convert wallet pubkey to npub format:', error);
        this.walletNpub = null;
      }

      // Query string carries relay + secret
      const params = url.searchParams ?? new URLSearchParams(url.search);
      this.relayUrl = params.get('relay');
      this.secret = params.get('secret');

      console.log('[NWCWallet] Connection details:', {
        walletPubKeyHex: this.walletPubKey,
        walletNpub: this.walletNpub,
        relayUrl: this.relayUrl,
        hasSecret: !!this.secret
      });

      if (!this.relayUrl || !this.walletPubKey) {
        throw new Error('Missing required relay or wallet pubkey in NWC URI');
      }

      // Try different connection string formats
      const connectionVariants = [
        connectionString, // Original
        connectionString.replace(this.walletPubKey, this.walletNpub || this.walletPubKey) // Try npub if available
      ];

      let connectionSuccess = false;
      let lastError = null;

      for (const [index, variant] of connectionVariants.entries()) {
        try {
          console.log(`[NWCWallet] Trying connection variant ${index + 1}:`, {
            variant: variant.substring(0, 80) + '...',
            usingNpub: index === 1
          });

          // Initialise the WebLN provider (Alby SDK) with the variant URI
          this.provider = new webln.NostrWebLNProvider({
            nostrWalletConnectUrl: variant
          });

          await this.provider.enable();
          console.log(`[NWCWallet] Connection variant ${index + 1} successful!`);
          connectionSuccess = true;
          break;
        } catch (error) {
          console.log(`[NWCWallet] Connection variant ${index + 1} failed:`, error.message);
          lastError = error;
          this.provider = null;
        }
      }

      if (!connectionSuccess) {
        throw lastError || new Error('All connection variants failed');
      }

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

  async makeInvoice(params) {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      console.log('[NWCWallet] Making invoice with params:', params);
      console.log('[NWCWallet] Provider state:', {
        hasProvider: !!this.provider,
        hasEnable: typeof this.provider.enable === 'function',
        hasMakeInvoice: typeof this.provider.makeInvoice === 'function',
        providerType: this.provider.constructor?.name || 'unknown'
      });

      try {
        // Try Alby SDK first
        const response = await this.provider.makeInvoice(params);
        
        console.log('[NWCWallet] Raw invoice response:', response);
        console.log('[NWCWallet] Invoice response analysis:', {
          hasResponse: !!response,
          responseType: typeof response,
          isArray: Array.isArray(response),
          hasInvoice: !!response?.invoice,
          hasPr: !!response?.pr,
          hasPaymentRequest: !!response?.paymentRequest,
          responseKeys: response ? Object.keys(response) : 'no response',
          fullResponse: JSON.stringify(response)
        });

        // Handle different response formats
        let invoice = null;
        if (response?.invoice) {
          invoice = response.invoice;
        } else if (response?.pr) {
          invoice = response.pr;
        } else if (response?.paymentRequest) {
          invoice = response.paymentRequest;
        } else if (typeof response === 'string' && response.startsWith('lnbc')) {
          invoice = response;
        }

        if (invoice) {
          console.log('[NWCWallet] Found invoice via Alby SDK:', {
            invoicePreview: invoice.substring(0, 50) + '...',
            invoiceLength: invoice.length
          });
          return { invoice };
        } else {
          console.log('[NWCWallet] Alby SDK returned no invoice, trying fallback...');
          throw new Error('No invoice in Alby SDK response');
        }
      } catch (albyError) {
        console.log('[NWCWallet] Alby SDK failed, trying direct NWC fallback:', albyError.message);
        
        // Fallback: Direct NWC implementation
        return await this.makeInvoiceDirect(params);
      }
    } catch (error) {
      console.error('[NWCWallet] Make invoice error:', error);
      throw error;
    }
  }

  /**
   * Direct NWC implementation as fallback
   */
  async makeInvoiceDirect(params) {
    console.log('[NWCWallet] Using direct NWC implementation...');
    
    if (!this.walletPubKey || !this.relayUrl || !this.secretKey) {
      throw new Error('Missing NWC connection parameters for direct implementation');
    }

    // Try both hex and npub formats for wallet pubkey
    const walletPubkeyVariants = [
      this.walletPubKey, // hex format
      this.walletNpub // npub format (if available)
    ].filter(Boolean); // Remove null/undefined values

    console.log('[NWCWallet] Will try wallet pubkey variants:', {
      hexFormat: this.walletPubKey,
      npubFormat: this.walletNpub,
      variantsToTry: walletPubkeyVariants.length
    });

    for (const [index, walletPubkey] of walletPubkeyVariants.entries()) {
      try {
        console.log(`[NWCWallet] Trying direct NWC with wallet pubkey variant ${index + 1}:`, {
          walletPubkey: walletPubkey,
          isNpub: walletPubkey.startsWith('npub'),
          isHex: walletPubkey.length === 64 && !walletPubkey.startsWith('npub')
        });

        // Create NIP-47 make_invoice request
        const requestEvent = {
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', walletPubkey.startsWith('npub') ? nip19.decode(walletPubkey).data : walletPubkey]], // Always use hex in tags
          content: JSON.stringify({
            method: 'make_invoice',
            params: {
              amount: params.amount * 1000, // Convert sats to msats
              description: params.defaultMemo || 'RUNSTR Season Pass'
            }
          }),
          pubkey: getPublicKey(this.secretKey)
        };

        // Sign the event
        requestEvent.id = getEventHash(requestEvent);
        requestEvent.sig = signEvent(requestEvent, this.secretKey);

        console.log('[NWCWallet] Direct NWC request event:', {
          kind: requestEvent.kind,
          pubkey: requestEvent.pubkey,
          walletPubkeyInTags: requestEvent.tags[0][1],
          relay: this.relayUrl,
          variantNumber: index + 1
        });

        // Send via WebSocket
        const result = await this.sendDirectNWCRequest(requestEvent);
        console.log(`[NWCWallet] Direct NWC variant ${index + 1} succeeded!`);
        return result;

      } catch (error) {
        console.log(`[NWCWallet] Direct NWC variant ${index + 1} failed:`, error.message);
        if (index === walletPubkeyVariants.length - 1) {
          // Last variant failed, throw the error
          throw error;
        }
        // Continue to next variant
      }
    }
  }

  /**
   * Send direct NWC request via WebSocket
   */
  async sendDirectNWCRequest(requestEvent) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.relayUrl);
      let timeout;

      ws.onopen = () => {
        console.log('[NWCWallet] Direct NWC WebSocket connected');
        ws.send(JSON.stringify(['REQ', 'nwc-response', { kinds: [23195], '#p': [requestEvent.pubkey] }]));
        ws.send(JSON.stringify(['EVENT', requestEvent]));
        
        timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Direct NWC request timeout'));
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const [type, , responseEvent] = JSON.parse(event.data);
          
          if (type === 'EVENT' && responseEvent?.kind === 23195) {
            console.log('[NWCWallet] Direct NWC response received:', responseEvent);
            clearTimeout(timeout);
            ws.close();
            
            const content = JSON.parse(responseEvent.content);
            if (content.result?.invoice) {
              console.log('[NWCWallet] Direct NWC invoice generated successfully');
              resolve({ invoice: content.result.invoice });
            } else if (content.error) {
              reject(new Error(`Direct NWC error: ${content.error.message || 'Unknown error'}`));
            } else {
              reject(new Error(`Direct NWC: No invoice in response: ${JSON.stringify(content)}`));
            }
          }
        } catch (parseError) {
          console.error('[NWCWallet] Direct NWC parse error:', parseError);
        }
      };

      ws.onerror = (error) => {
        console.error('[NWCWallet] Direct NWC WebSocket error:', error);
        clearTimeout(timeout);
        reject(new Error('Direct NWC WebSocket connection failed'));
      };
    });
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
