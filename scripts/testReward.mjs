// Test script to verify streak reward payout via NWC (ESM)
import 'dotenv/config';
import 'ts-node/register/esm';

// Polyfill localStorage in Node
if (typeof global.localStorage === 'undefined') {
  global.localStorage = (() => {
    let store = {};
    return {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = value.toString();
      },
      removeItem: key => {
        delete store[key];
      },
      clear: () => {
        store = {};
      }
    };
  })();
}

const { resetStreakDataCompletely, updateUserStreak } = await import('../src/utils/streakUtils.ts');

const recipient = process.argv[2] || 'thewildhustle@coinos.io';
const userNwcUri = process.env.USER_NWC_URI;
const fundingNwcUri = process.env.NWC_URI;

if (!fundingNwcUri) {
  console.error('ERROR: funding wallet NWC_URI not set in .env');
  process.exit(1);
}
if (!userNwcUri) {
  console.error('ERROR: USER_NWC_URI (runner\'s wallet) not provided in environment');
  process.exit(1);
}

localStorage.setItem('nwcConnectionString', userNwcUri);
localStorage.setItem('userPubkey', recipient);

console.log('Resetting streak data...');
resetStreakDataCompletely();

console.log('Simulating run (>0.5 mi)...');
updateUserStreak(new Date(), recipient);

console.log('Run recorded. Waiting 40 seconds for payout to settle...');
setTimeout(() => {
  console.log('Done. Check your wallet / console logs for success message.');
  process.exit(0);
}, 40000); 