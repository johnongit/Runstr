#!/usr/bin/env node

/**
 * Multi-Relay Season Pass Checker
 * Checks multiple relays for kind 33406 events
 */

import { relayInit } from 'nostr-tools';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://eden.nostr.land',
  'wss://nostr.wine'
];

console.log('🎫 Multi-Relay Season Pass Checker');
console.log('📅', new Date().toLocaleString());
console.log('');

async function checkRelay(relayUrl) {
  console.log(`🔄 Checking ${relayUrl}...`);
  
  const relay = relayInit(relayUrl);
  const events = [];
  
  try {
    await relay.connect();
    
    const searchPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('timeout'));
      }, 8000);
      
      const sub = relay.sub([{
        kinds: [33406],
        limit: 50
      }]);
      
      sub.on('event', event => {
        // Only collect events from last 48 hours
        const timeAgo = Math.floor(Date.now() / 1000) - event.created_at;
        if (timeAgo < 172800) { // 48 hours
          events.push({
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            content: event.content || '',
            tags: event.tags || [],
            relay: relayUrl
          });
        }
      });
      
      sub.on('eose', () => {
        clearTimeout(timeoutId);
        sub.unsub();
        resolve(events);
      });
    });
    
    await searchPromise;
    console.log(`✅ ${relayUrl}: Found ${events.length} recent events`);
    
  } catch (error) {
    console.log(`❌ ${relayUrl}: ${error.message}`);
  } finally {
    relay.close();
  }
  
  return events;
}

async function checkAllRelays() {
  console.log('🔍 Checking all relays for recent kind 33406 events...\n');
  
  // Check all relays in parallel
  const promises = RELAYS.map(relay => checkRelay(relay));
  const results = await Promise.all(promises);
  
  // Combine all events
  const allEvents = results.flat();
  
  // Deduplicate by event ID
  const uniqueEvents = [];
  const seenIds = new Set();
  
  for (const event of allEvents) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    }
  }
  
  // Sort by creation time (newest first)
  uniqueEvents.sort((a, b) => b.created_at - a.created_at);
  
  console.log(`\n📊 Total unique events found: ${uniqueEvents.length}`);
  
  if (uniqueEvents.length === 0) {
    console.log('⚠️  No recent events found on any relay');
    return;
  }
  
  console.log('\n=== ALL RECENT KIND 33406 EVENTS ===\n');
  
  uniqueEvents.forEach((event, i) => {
    const timeAgo = Math.floor(Date.now() / 1000) - event.created_at;
    const timeString = timeAgo < 60 ? `${timeAgo} sec ago` :
                      timeAgo < 3600 ? `${Math.floor(timeAgo / 60)} min ago` : 
                      timeAgo < 86400 ? `${Math.floor(timeAgo / 3600)} hours ago` :
                      `${Math.floor(timeAgo / 86400)} days ago`;
    
    console.log(`${i + 1}. ${timeString}`);
    console.log(`   Publisher: ${event.pubkey}`);
    console.log(`   Content: ${event.content.substring(0, 60)}${event.content.length > 60 ? '...' : ''}`);
    console.log(`   Relay: ${event.relay}`);
    
    // Extract key tags
    const keyTags = {};
    event.tags.forEach(tag => {
      if (tag[0] && tag[1]) {
        keyTags[tag[0]] = tag[1];
      }
    });
    
    // Show RUNSTR-related info
    if (keyTags.d?.includes('runstr') || keyTags.client?.includes('runstr') || event.content.toLowerCase().includes('runstr')) {
      console.log('   🏃 RUNSTR SEASON PASS EVENT');
      console.log(`     Purchaser: ${keyTags.purchaser || 'MISSING'}`);
      console.log(`     Amount: ${keyTags.payment_amount || 'MISSING'} ${keyTags.currency || ''}`);
      console.log(`     D-tag: ${keyTags.d || 'MISSING'}`);
    } else if (event.content.includes('joined team')) {
      console.log('   👥 Team join event');
    }
    
    console.log('');
  });
  
  // Show just RUNSTR events
  const runstrEvents = uniqueEvents.filter(event => {
    const hasRunstrTags = event.tags.some(tag => 
      (tag[0] === 'd' && tag[1]?.includes('runstr')) ||
      (tag[0] === 'client' && tag[1]?.includes('runstr'))
    );
    const hasRunstrContent = event.content.toLowerCase().includes('runstr');
    return hasRunstrTags || hasRunstrContent;
  });
  
  if (runstrEvents.length > 0) {
    console.log('=== RUNSTR SEASON PASS EVENTS ONLY ===\n');
    runstrEvents.forEach((event, i) => {
      const timeAgo = Math.floor(Date.now() / 1000) - event.created_at;
      const timeString = timeAgo < 3600 ? `${Math.floor(timeAgo / 60)} min ago` : `${Math.floor(timeAgo / 3600)} hours ago`;
      
      const purchaser = event.tags.find(tag => tag[0] === 'purchaser')?.[1] || 'NOT FOUND';
      
      console.log(`${i + 1}. ${timeString} - ${purchaser}`);
      console.log(`   Publisher: ${event.pubkey}`);
      console.log(`   Found on: ${event.relay}`);
      console.log('');
    });
  }
}

checkAllRelays().then(() => {
  console.log('✅ Multi-relay check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 