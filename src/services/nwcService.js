// nwcService.js – lightweight Nostr-Wallet-Connect helper
// NOTE:  This is a **first pass** implementation that focuses on the happy-path.
// It will successfully simulate payments in DEMO_MODE and contains everything
// needed to wire up real NWC calls once a test invoice is available.

import { Relay, nip04, finalizeEvent, getPublicKey } from 'nostr-tools';

const DEMO_MODE = false; // set true to bypass real network calls during dev

// Pull NWC URI from env (process.env for Node, import.meta.env for Vite)
const NWC_URI = (typeof import.meta !== 'undefined' && import.meta?.env?.NWC_URI) ||
  process.env.NWC_URI || '';

if (!NWC_URI) {
  console.warn('[nwcService] NWC_URI env variable is not set – payments will fail');
}

/** Parse nostr+walletconnect:// URI → { relayURL, servicePubkey, secretPrivKey } */
function parseNwcUri(uri = NWC_URI) {
  try {
    const parsed = new URL(uri);
    const servicePubkey = parsed.pathname.replace(/\/*/g, ''); // strip leading slashes
    const relayURL = parsed.searchParams.get('relay');
    const secret = parsed.searchParams.get('secret');
    if (!relayURL || !servicePubkey || !secret) throw new Error('Invalid NWC URI');
    return { relayURL, servicePubkey, secretPrivKey: secret };
  } catch (err) {
    console.error('[nwcService] Failed to parse NWC URI', err);
    return {};
  }
}

const parsedNwc = parseNwcUri();

/**
 * Fetch an invoice (bolt11) for the given Lightning address using LNURL-Pay.
 * Only the basic flow is implemented – no optional comment support.
 */
async function lnurlFetchInvoice(lightningAddress, sats, memo = '') {
  try {
    if (!lightningAddress.includes('@')) throw new Error('Not a lightning address');
    const [name, host] = lightningAddress.split('@');
    const lnurlMetaURL = `https://${host}/.well-known/lnurlp/${name}`;
    const metaRes = await fetch(lnurlMetaURL);
    if (!metaRes.ok) throw new Error(`Meta fetch failed: ${metaRes.status}`);
    const meta = await metaRes.json();
    const callback = meta.callback;
    const amountMsat = sats * 1000;
    const invoiceURL = `${callback}?amount=${amountMsat}&comment=${encodeURIComponent(memo)}`;
    const invRes = await fetch(invoiceURL);
    if (!invRes.ok) throw new Error(`Invoice fetch failed: ${invRes.status}`);
    const invJson = await invRes.json();
    if (invJson.status === 'ERROR') throw new Error(invJson.reason || 'LNURL error');
    return { success: true, invoice: invJson.pr };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Pay a bolt11 invoice using NWC.
 * Returns { success: boolean, error?: string, result?: any }
 */
async function payInvoiceWithNwc(invoice, memo = '') {
  if (DEMO_MODE) {
    console.log('[nwcService] DEMO_MODE – pretending to pay invoice');
    return { success: true, result: { demo: true } };
  }
  try {
    const { relayURL, servicePubkey, secretPrivKey } = parsedNwc;
    if (!relayURL) throw new Error('NWC is not configured');

    const relay = new Relay(relayURL);
    await relay.connect();

    const reqPayload = {
      method: 'pay_invoice',
      params: { invoice }
    };
    const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(reqPayload));
    let ev = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(secretPrivKey),
      tags: [['p', servicePubkey]],
      content: encContent
    };
    ev = finalizeEvent(ev, secretPrivKey);

    await relay.publish(ev);

    return await new Promise((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
      const timer = setTimeout(() => {
        sub.close();
        relay.close();
        reject({ success: false, error: 'NWC response timeout' });
      }, 30000);

      sub.on('event', async (event) => {
        clearTimeout(timer);
        sub.close();
        relay.close();
        try {
          const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
          const data = JSON.parse(dec);
          if (data.result) {
            resolve({ success: true, result: data.result });
          } else {
            resolve({ success: false, error: data.error?.message || 'Unknown NWC error' });
          }
        } catch (err) {
          reject({ success: false, error: 'Decrypt error: ' + err.message });
        }
      });
    });
  } catch (err) {
    console.error('[nwcService] payInvoice error', err);
    return { success: false, error: err.message };
  }
}

/**
 * Convenience: pay a Lightning address (LNURL) directly.
 */
async function payLightningAddress(lnAddress, sats, memo = '') {
  const invRes = await lnurlFetchInvoice(lnAddress, sats, memo);
  if (!invRes.success) return { success: false, error: invRes.error };
  return await payInvoiceWithNwc(invRes.invoice, memo);
}

export default {
  payLightningAddress,
  payInvoiceWithNwc,
  lnurlFetchInvoice,
  parseNwcUri
}; 