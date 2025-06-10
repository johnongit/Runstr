import { NostrEvent } from 'nostr-tools';
import { NDKEvent } from '@nostr-dev-kit/ndk';

type WalletLike = { makePayment: (invoice: string) => Promise<any> };

/**
 * Pay a fixed amount (in sats) to a lightning address or LNURL using the connected wallet provider.
 * Returns true on success, throws on failure.
 */
export async function payLnurl({ lightning, amount, wallet, comment }: { lightning: string; amount: number; wallet: WalletLike; comment?: string; }): Promise<void> {
  // 1. Derive LNURL endpoint
  let lnurlEndpoint: string;
  if (lightning.includes('@')) {
    const [username, domain] = lightning.split('@');
    lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
  } else {
    lnurlEndpoint = lightning; // assume raw lnurl/http url
  }

  // 2. Fetch pay metadata
  const metaResp = await fetch(lnurlEndpoint);
  if (!metaResp.ok) throw new Error(`LNURL metadata fetch failed: ${metaResp.status}`);
  const payData = await metaResp.json();
  if (payData.tag !== 'payRequest' || !payData.callback) throw new Error('Invalid LNURL-pay metadata');

  const msats = amount * 1000;
  if (msats < payData.minSendable || msats > payData.maxSendable) {
    throw new Error(`Amount out of bounds (min ${payData.minSendable/1000}, max ${payData.maxSendable/1000})`);
  }

  const cbUrl = new URL(payData.callback);
  cbUrl.searchParams.append('amount', msats.toString());
  if (comment && payData.commentAllowed) cbUrl.searchParams.append('comment', comment.substring(0, payData.commentAllowed));

  const invResp = await fetch(cbUrl.toString());
  if (!invResp.ok) throw new Error(`LNURL callback failed: ${invResp.status}`);
  const invData = await invResp.json();
  if (!invData.pr) throw new Error('Invoice missing in LNURL response');

  // 3. Pay invoice using provided wallet
  if (!wallet || typeof wallet.makePayment !== 'function') {
    throw new Error('Wallet not connected');
  }
  await wallet.makePayment(invData.pr);
}

/**
 * Fetch an invoice for a fixed amount from a lightning address/LNURL without attempting to pay it.
 */
export async function requestLnurlInvoice({ lightning, amount, comment }: { lightning: string; amount: number; comment?: string; }): Promise<string> {
  let lnurlEndpoint: string;
  if (lightning.includes('@')) {
    const [username, domain] = lightning.split('@');
    lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
  } else {
    lnurlEndpoint = lightning;
  }

  const metaResp = await fetch(lnurlEndpoint);
  if (!metaResp.ok) throw new Error(`LNURL metadata fetch failed: ${metaResp.status}`);
  const payData = await metaResp.json();
  if (payData.tag !== 'payRequest' || !payData.callback) throw new Error('Invalid LNURL-pay metadata');

  const msats = amount * 1000;
  if (msats < payData.minSendable || msats > payData.maxSendable) {
    throw new Error(`Amount out of bounds (min ${payData.minSendable/1000}, max ${payData.maxSendable/1000})`);
  }

  const cbUrl = new URL(payData.callback);
  cbUrl.searchParams.append('amount', msats.toString());
  if (comment && payData.commentAllowed) cbUrl.searchParams.append('comment', comment.substring(0, payData.commentAllowed));

  const invResp = await fetch(cbUrl.toString());
  if (!invResp.ok) throw new Error(`LNURL callback failed: ${invResp.status}`);
  const invData = await invResp.json();
  if (!invData.pr) throw new Error('Invoice missing in LNURL response');

  return invData.pr as string;
}

export const getInvoiceFromLnAddress = async (lnaddress: string, amount: number): Promise<string> => {
    const parts = lnaddress.split('@');
    const url = `https://{domain}/.well-known/lnurlp/{user}`
      .replace('{domain}', parts[1])
      .replace('{user}', parts[0]);

    const res = await fetch(url);
    const body = await res.json();
    
    if (body.status === 'ERROR') {
        throw new Error(body.reason);
    }
    
    const callbackRes = await fetch(`${body.callback}?amount=${amount * 1000}`);
    const callbackBody = await callbackRes.json();
    
    if (callbackBody.status === 'ERROR') {
        throw new Error(callbackBody.reason);
    }
    
    return callbackBody.pr;
}; 