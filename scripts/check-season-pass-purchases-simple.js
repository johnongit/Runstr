#!/usr/bin/env node

/**
 * Simple Season Pass Purchase Checker
 * Fast version with minimal queries and quick timeout
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Just one fast relay
const RELAY = 'wss://relay.damus.io';

console.log('🎫 Simple Season Pass Checker');
console.log('📅', new Date().toLocaleString());
console.log('');

const ndk = new NDK({ 
  explicitRelayUrls: [RELAY],
  devLogLevel: 'error'
});

console.log('🔄 Connecting to relay...');

try {
  // 5 second connection timeout
  await Promise.race([
    ndk.connect(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
  ]);
  
  console.log('✅ Connected');
  
  console.log('🔍 Searching for season pass events...');
  
  // Simple query with 8 second timeout
  const events = await Promise.race([
    ndk.fetchEvents({
      kinds: [33406],
      limit: 20
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout')), 8000))
  ]);
  
  const eventArray = Array.from(events);
  console.log(`📥 Found ${eventArray.length} events`);
  
  if (eventArray.length === 0) {
    console.log('⚠️  No season pass events found');
    process.exit(0);
  }
  
  // Extract purchaser npubs
  const purchasers = [];
  
  for (const event of eventArray) {
    // Look for purchaser tag or d tag with runstr
    const purchaserTag = event.tags?.find(tag => tag[0] === 'purchaser');
    const dTag = event.tags?.find(tag => tag[0] === 'd');
    
    if (purchaserTag && purchaserTag[1]) {
      const timeAgo = Math.floor((Date.now() / 1000) - (event.created_at || 0));
      const timeString = timeAgo < 3600 ? `${Math.floor(timeAgo / 60)} min ago` : `${Math.floor(timeAgo / 3600)} hours ago`;
      
      purchasers.push({
        npub: purchaserTag[1],
        time: event.created_at,
        timeAgo: timeString,
        dTag: dTag?.[1] || 'unknown'
      });
    }
  }
  
  if (purchasers.length === 0) {
    console.log('⚠️  No purchaser info found in events');
    process.exit(0);
  }
  
  // Sort by most recent
  purchasers.sort((a, b) => (b.time || 0) - (a.time || 0));
  
  console.log('');
  console.log('=== SEASON PASS PURCHASERS ===');
  console.log('');
  
  purchasers.forEach((p, i) => {
    console.log(`${i + 1}. ${p.npub}`);
    console.log(`   Time: ${p.timeAgo} (${p.dTag})`);
    console.log('');
  });
  
  console.log(`👥 Total: ${purchasers.length} purchasers`);
  
  if (purchasers.length > 0) {
    console.log('');
    console.log('🔥 MOST RECENT:');
    console.log(`   ${purchasers[0].npub}`);
    console.log(`   ${purchasers[0].timeAgo}`);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  
  if (error.message.includes('timeout')) {
    console.log('💡 Nostr query timed out - try again or check local logs');
  }
}

console.log('');
console.log('✅ Done');
process.exit(0); 