#!/usr/bin/env node

/**
 * Season Pass Checker - Pure nostr-tools version
 * Shows ALL kind 33406 events with minimal filtering
 */

import { relayInit } from 'nostr-tools';
import WebSocket from 'ws';

// Make WebSocket available globally for nostr-tools
globalThis.WebSocket = WebSocket;

const RELAY_URL = 'wss://relay.damus.io';

console.log('🎫 Season Pass Checker (showing ALL kind 33406 events)');
console.log('📅', new Date().toLocaleString());
console.log('');

async function checkSeasonPass() {
  console.log('🔄 Connecting to relay...');
  
  const relay = relayInit(RELAY_URL);
  
  try {
    await relay.connect();
    console.log('✅ Connected to', RELAY_URL);
    
    const allEvents = [];
    
    console.log('🔍 Searching for ALL kind 33406 events...');
    
    // Set up subscription with timeout
    const timeoutMs = 15000; // 15 seconds
    let timeoutId;
    
    const searchPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Search timeout'));
      }, timeoutMs);
      
      const sub = relay.sub([
        {
          kinds: [33406],
          limit: 100 // Increased limit
        }
      ]);
      
      sub.on('event', event => {
        console.log('📥 Found event:', event.id.substring(0, 8) + '...');
        
        // Store ALL events, no filtering
        const timeAgo = Math.floor(Date.now() / 1000) - event.created_at;
        const timeString = timeAgo < 60 ? `${timeAgo} sec ago` :
                          timeAgo < 3600 ? `${Math.floor(timeAgo / 60)} min ago` : 
                          timeAgo < 86400 ? `${Math.floor(timeAgo / 3600)} hours ago` :
                          `${Math.floor(timeAgo / 86400)} days ago`;
        
        // Extract key tags
        const tags = {};
        if (event.tags) {
          event.tags.forEach(tag => {
            if (tag[0] && tag[1]) {
              tags[tag[0]] = tag[1];
            }
          });
        }
        
        allEvents.push({
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          timeAgo: timeString,
          content: event.content || '',
          tags: tags,
          rawTags: event.tags
        });
      });
      
      sub.on('eose', () => {
        console.log('✅ Search complete');
        clearTimeout(timeoutId);
        sub.unsub();
        resolve(allEvents);
      });
    });
    
    const results = await searchPromise;
    
    if (results.length === 0) {
      console.log('⚠️  No kind 33406 events found');
      return;
    }
    
    // Sort by most recent
    results.sort((a, b) => b.created_at - a.created_at);
    
    console.log('');
    console.log('=== ALL KIND 33406 EVENTS ===');
    console.log('');
    
    results.forEach((event, i) => {
      console.log(`${i + 1}. Event ID: ${event.id.substring(0, 12)}...`);
      console.log(`   Publisher: ${event.pubkey}`);
      console.log(`   Time: ${event.timeAgo}`);
      console.log(`   Content: ${event.content.substring(0, 80)}${event.content.length > 80 ? '...' : ''}`);
      
      // Show key tags
      const keyTags = ['d', 'purchaser', 'payment_amount', 'currency', 'client', 'name'];
      console.log('   Key Tags:');
      keyTags.forEach(tagName => {
        if (event.tags[tagName]) {
          console.log(`     ${tagName}: ${event.tags[tagName]}`);
        }
      });
      
      // Show if this looks like a RUNSTR event
      const isRunstr = event.tags.d?.includes('runstr') || 
                      event.tags.client?.includes('runstr') ||
                      event.content.toLowerCase().includes('runstr');
      if (isRunstr) {
        console.log('   🏃 RUNSTR-related event');
      }
      
      console.log('');
    });
    
    // Summary
    console.log(`📊 Total events found: ${results.length}`);
    
    // Filter for RUNSTR-related events
    const runstrEvents = results.filter(event => 
      event.tags.d?.includes('runstr') || 
      event.tags.client?.includes('runstr') ||
      event.content.toLowerCase().includes('runstr')
    );
    
    console.log(`🏃 RUNSTR-related events: ${runstrEvents.length}`);
    
    if (runstrEvents.length > 0) {
      console.log('');
      console.log('=== RUNSTR EVENTS ONLY ===');
      runstrEvents.forEach((event, i) => {
        console.log(`${i + 1}. ${event.timeAgo} - Publisher: ${event.pubkey}`);
        console.log(`   Purchaser tag: ${event.tags.purchaser || 'MISSING'}`);
        console.log(`   Amount: ${event.tags.payment_amount || 'MISSING'} ${event.tags.currency || ''}`);
        console.log('');
      });
    }
    
    // Show events from last 24 hours
    const recent = results.filter(event => 
      (Math.floor(Date.now() / 1000) - event.created_at) < 86400
    );
    
    if (recent.length > 0) {
      console.log('=== EVENTS FROM LAST 24 HOURS ===');
      recent.forEach((event, i) => {
        console.log(`${i + 1}. ${event.timeAgo}`);
        console.log(`   Publisher: ${event.pubkey}`);
        console.log(`   Content: ${event.content}`);
        console.log(`   All Tags:`, JSON.stringify(event.rawTags, null, 2));
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    relay.close();
    console.log('✅ Done');
  }
}

checkSeasonPass().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
}); 