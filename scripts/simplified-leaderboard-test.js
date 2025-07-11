#!/usr/bin/env node

/**
 * Simplified Leaderboard Test - Competition Date Only
 * 
 * Tests the simplified approach using only competition date range
 * instead of individual payment dates for filtering 1301 events.
 */

import NDK from '@nostr-dev-kit/ndk';

// Simplified approach - just use competition dates
const COMPETITION_START = Math.floor(new Date('2025-07-01T00:00:00Z').getTime() / 1000);
const COMPETITION_END = Math.floor(new Date('2025-07-30T23:59:59Z').getTime() / 1000); // July 30 for testing

// Participants (just need pubkeys, not payment dates)
const PARTICIPANTS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', // TheWildHustle
  '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc'  // kamoweasel
];

// Relay configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

/**
 * Extract distance and convert to miles
 */
function extractDistanceInMiles(event) {
  try {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const value = parseFloat(distanceTag[1]);
    if (isNaN(value) || value < 0) return 0;
    
    const unit = distanceTag[2]?.toLowerCase() || 'km';
    
    // Convert to km first
    let distanceInKm = value;
    switch (unit) {
      case 'mi':
      case 'mile':
      case 'miles':
        distanceInKm = value * 1.609344;
        break;
      case 'm':
      case 'meter':
      case 'meters':
        distanceInKm = value / 1000;
        break;
      case 'km':
      case 'kilometer':
      case 'kilometers':
      default:
        distanceInKm = value;
        break;
    }
    
    // Validate range
    if (distanceInKm < 0.01 || distanceInKm > 500) {
      console.warn(`Invalid distance: ${value} ${unit}`);
      return 0;
    }
    
    // Return in miles
    return distanceInKm * 0.621371;
  } catch (err) {
    console.error('Error extracting distance:', err);
    return 0;
  }
}

/**
 * Main test function
 */
async function testSimplifiedApproach() {
  console.log('🎯 SIMPLIFIED LEADERBOARD TEST');
  console.log('============================\n');
  
  console.log('📅 Competition Date Range:');
  console.log(`   Start: ${new Date(COMPETITION_START * 1000).toISOString()}`);
  console.log(`   End: ${new Date(COMPETITION_END * 1000).toISOString()}`);
  console.log(`   Current: ${new Date().toISOString()}`);
  
  try {
    // Initialize NDK
    const ndk = new NDK({
      explicitRelayUrls: RELAYS,
      enableOutboxModel: false
    });
    
    console.log('\n🔗 Connecting to relays...');
    await ndk.connect();
    
    // Fetch events using ONLY competition date range
    console.log('\n📡 Fetching events with simplified filter:');
    console.log(`   Kind: 1301`);
    console.log(`   Authors: ${PARTICIPANTS.length} participants`);
    console.log(`   Since: ${new Date(COMPETITION_START * 1000).toISOString()}`);
    console.log(`   Until: ${new Date(COMPETITION_END * 1000).toISOString()}`);
    
    const filter = {
      kinds: [1301],
      authors: PARTICIPANTS,
      since: COMPETITION_START,
      until: COMPETITION_END,
      limit: 1000
    };
    
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);
    
    console.log(`\n📊 Fetched ${eventsArray.length} events`);
    
    if (eventsArray.length === 0) {
      console.log('❌ No events found in date range!');
      return;
    }
    
    // Process events with simplified logic
    const leaderboard = new Map();
    PARTICIPANTS.forEach(pubkey => {
      leaderboard.set(pubkey, {
        pubkey,
        totalMiles: 0,
        runCount: 0,
        runs: []
      });
    });
    
    console.log('\n🔄 Processing events (simplified approach):');
    
    eventsArray.forEach((event, index) => {
      console.log(`\n📝 Event ${index + 1}:`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Pubkey: ${event.pubkey}`);
      console.log(`   Date: ${new Date(event.created_at * 1000).toISOString()}`);
      
      // Check if participant
      if (!PARTICIPANTS.includes(event.pubkey)) {
        console.log(`   ❌ Not a participant`);
        return;
      }
      
      // Check date range (should already be filtered by query, but double-check)
      if (event.created_at < COMPETITION_START || event.created_at > COMPETITION_END) {
        console.log(`   ❌ Outside date range`);
        return;
      }
      
      // Check exercise type
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const exerciseType = exerciseTag?.[1]?.toLowerCase();
      console.log(`   🏃 Exercise: ${exerciseType || 'none'}`);
      
      if (exerciseType !== 'run') {
        console.log(`   ❌ Not a run`);
        return;
      }
      
      // Extract distance
      const distance = extractDistanceInMiles(event);
      console.log(`   📏 Distance: ${distance.toFixed(2)} miles`);
      
      if (distance <= 0) {
        console.log(`   ❌ Invalid distance`);
        return;
      }
      
      // Add to leaderboard
      const participant = leaderboard.get(event.pubkey);
      if (participant) {
        participant.totalMiles += distance;
        participant.runCount++;
        participant.runs.push({
          distance,
          date: new Date(event.created_at * 1000).toISOString(),
          eventId: event.id
        });
        
        console.log(`   ✅ Added to leaderboard: ${distance.toFixed(2)} miles`);
        console.log(`   📊 Total: ${participant.totalMiles.toFixed(2)} miles, ${participant.runCount} runs`);
      }
    });
    
    // Display final results
    console.log('\n🏆 FINAL LEADERBOARD (Simplified Approach):');
    console.log('==========================================');
    
    const sortedParticipants = Array.from(leaderboard.values())
      .sort((a, b) => b.totalMiles - a.totalMiles)
      .map((participant, index) => ({ ...participant, rank: index + 1 }));
    
    sortedParticipants.forEach(participant => {
      const nickname = participant.pubkey === PARTICIPANTS[0] ? 'TheWildHustle' : 'kamoweasel';
      console.log(`\n${participant.rank}. ${nickname}`);
      console.log(`   Total: ${participant.totalMiles.toFixed(2)} miles`);
      console.log(`   Runs: ${participant.runCount}`);
      
      if (participant.runs.length > 0) {
        console.log(`   Details:`);
        participant.runs.forEach((run, i) => {
          console.log(`     ${i + 1}. ${run.distance.toFixed(2)} miles on ${run.date}`);
        });
      }
    });
    
    console.log(`\n✅ Test complete! Found ${sortedParticipants.filter(p => p.runCount > 0).length} participants with runs.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

// Run the test
testSimplifiedApproach().catch(console.error); 