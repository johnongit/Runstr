import transactionService, { TRANSACTION_TYPES } from '../src/services/transactionService.js';

/**
 * Minimal Node-side smoke-test for the payout pipeline.
 * Usage:
 *   VITE_BITVORA_ACCESS_TOKEN=<token> \
 *   REWARD_DESTINATION=<ln-address> \
 *   node scripts/test-rewards.mjs
 *
 * Environment vars:
 *   REWARD_DESTINATION  lightning address / lnurl / bolt11 invoice (required)
 *   REWARD_AMOUNT       sats to send (default 1)
 */

// ---------------------------------------------------------------------------
// Very light browser-API polyfills so transactionService doesn't crash in Node
// ---------------------------------------------------------------------------
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    dispatchEvent: () => {},
  };
}
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class {
    constructor() {}
  };
}
// ---------------------------------------------------------------------------

const destination = process.env.REWARD_DESTINATION;
if (!destination) {
  console.error('❌  REWARD_DESTINATION env-var required (lightning address / invoice)');
  process.exit(1);
}
const amount = Number(process.env.REWARD_AMOUNT || 1);

(async () => {
  console.log('▶  Initiating streak-reward payout test');
  console.log('   Destination:', destination);
  console.log('   Amount     :', amount, 'sat');

  // reason kept small – Bitvora API truncates > 32 chars
  const result = await transactionService.processStreakReward(
    destination,
    amount,
    'cli test',
    { source: 'cli_test' }
  );

  if (result.success) {
    console.log('✅  Payout success!  TXID:', result.transaction?.bitvora_txid || '(pending)');
  } else {
    console.error('❌  Payout failed:', result.error);
  }
})(); 