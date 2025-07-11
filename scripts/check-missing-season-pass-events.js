#!/usr/bin/env node

/**
 * Check for users who paid for season pass (in localStorage) but are missing Nostr events
 * This helps identify users whose payment succeeded but Nostr event publishing failed
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Default participants from localStorage (seasonPassService.ts)
const LOCAL_PARTICIPANTS = [
  {
    // npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum
    pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
    paymentDate: '2025-07-01T00:00:00.000Z'
  },
  {
    // npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q9y7jlj
    pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
    paymentDate: '2025-07-01T00:00:00.000Z'
  }
];

// Relay configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

async function checkMissingEvents() {
  console.log('🔍 Checking for users who paid but are missing Nostr events...\n');
  
  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: RELAYS
  });
  
  try {
    await ndk.connect();
    console.log('✅ Connected to relays\n');
    
    // Fetch all existing season pass events
    console.log('📥 Fetching existing season pass events...');
    const events = await ndk.fetchEvents({
      kinds: [33406],
      '#d': ['runstr-season-1-2025'],
      limit: 50
    });
    
    const eventArray = Array.from(events);
    console.log(`Found ${eventArray.length} existing season pass events\n`);
    
    // Extract pubkeys from existing events
    const existingPurchasers = new Set();
    for (const event of eventArray) {
      const purchaserTag = event.tags?.find(tag => tag[0] === 'purchaser');
      if (purchaserTag && purchaserTag[1]) {
        // Convert npub back to pubkey
        try {
          const { data: pubkey } = nip19.decode(purchaserTag[1]);
          existingPurchasers.add(pubkey);
        } catch (err) {
          console.warn('Failed to decode npub:', purchaserTag[1]);
        }
      }
    }
    
    console.log('📊 Analysis Results:\n');
    
    // Check each local participant
    const missingUsers = [];
    for (const participant of LOCAL_PARTICIPANTS) {
      const npub = nip19.npubEncode(participant.pubkey);
      const hasEvent = existingPurchasers.has(participant.pubkey);
      
      console.log(`👤 ${npub}`);
      console.log(`   Pubkey: ${participant.pubkey}`);
      console.log(`   Payment Date: ${participant.paymentDate}`);
      console.log(`   Nostr Event: ${hasEvent ? '✅ Found' : '❌ Missing'}`);
      console.log('');
      
      if (!hasEvent) {
        missingUsers.push({
          npub,
          pubkey: participant.pubkey,
          paymentDate: participant.paymentDate
        });
      }
    }
    
    if (missingUsers.length > 0) {
      console.log('🚨 USERS MISSING NOSTR EVENTS:');
      console.log('====================================');
      missingUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.npub}`);
        console.log(`   Pubkey: ${user.pubkey}`);
        console.log(`   Payment Date: ${user.paymentDate}`);
        console.log('');
      });
      
      console.log('💡 To manually add them to the Nostr participant list:');
      console.log('   1. Use the manual recovery script (see next step)');
      console.log('   2. Or manually publish their season pass events');
    } else {
      console.log('✅ All local participants have corresponding Nostr events!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    ndk.destroy();
  }
}

checkMissingEvents().catch(console.error); 