#!/usr/bin/env node

/**
 * Debug League Standings Leaderboard
 * 
 * This script simulates the useLeagueLeaderboard hook logic to identify
 * why the leaderboard shows 0 runs when the feed shows actual workouts.
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Default participants from seasonPassService.ts
const DEFAULT_PARTICIPANTS = [
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

// Competition configuration (from useLeagueLeaderboard.js)
const COMPETITION_END = Math.floor(new Date('2025-10-11T23:59:59Z').getTime() / 1000);
const MAX_EVENTS = 5000;
const BATCH_SIZE = 100;

// Relay configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

/**
 * Extract distance from event tags (matches frontend logic)
 */
function extractDistance(event) {
  try {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const distance = parseFloat(distanceTag[1]);
    const unit = distanceTag[2] || 'km';
    
    // Convert to miles if needed
    if (unit.toLowerCase() === 'km') {
      return distance * 0.621371;
    }
    
    return distance;
  } catch (err) {
    console.error('Error extracting distance:', err);
    return 0;
  }
}

/**
 * Process events in batches (matches useLeagueLeaderboard logic)
 */
function processEventsBatch(events, leaderboardMap, participantPaymentDates, batchStart, batchEnd, activityMode = 'run') {
  console.log(`\n🔄 Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1}: events ${batchStart}-${batchEnd}`);
  
  try {
    const batch = events.slice(batchStart, batchEnd);
    const processedEvents = [];
    let filteredCount = 0;
    
    batch.forEach((event, index) => {
      if (!event.pubkey) {
        filteredCount++;
        return;
      }
      
      // Filter by individual participant payment date
      const participantPaymentDate = participantPaymentDates.get(event.pubkey);
      if (!participantPaymentDate) {
        filteredCount++;
        return;
      }
      
      if (event.created_at < participantPaymentDate) {
        console.log(`  ❌ Event ${batchStart + index + 1}: Before payment date (${new Date(event.created_at * 1000).toISOString()})`);
        filteredCount++;
        return;
      }
      
      // Filter by global competition end date
      if (event.created_at > COMPETITION_END) {
        console.log(`  ❌ Event ${batchStart + index + 1}: After competition end`);
        filteredCount++;
        return;
      }
      
      // Filter by current activity mode using exercise tag
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const eventActivityType = exerciseTag?.[1]?.toLowerCase();
      
      const activityMatches = {
        'run': ['run', 'running', 'jog', 'jogging'],
        'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
        'walk': ['walk', 'walking', 'hike', 'hiking']
      };
      
      const acceptedActivities = activityMatches[activityMode] || [activityMode];
      
      if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
        console.log(`  ❌ Event ${batchStart + index + 1}: Activity type mismatch (${eventActivityType} not in ${acceptedActivities})`);
        filteredCount++;
        return;
      }
      
      const distance = extractDistance(event);
      if (distance <= 0) {
        console.log(`  ❌ Event ${batchStart + index + 1}: Invalid distance (${distance})`);
        filteredCount++;
        return;
      }

      processedEvents.push(event);
      console.log(`  ✅ Event ${batchStart + index + 1}: ${distance.toFixed(2)} miles - ${eventActivityType} - ${new Date(event.created_at * 1000).toISOString()}`);

      // Update participant data
      const participant = leaderboardMap.get(event.pubkey);
      if (participant) {
        const oldTotal = participant.totalMiles;
        const oldCount = participant.runCount;
        
        participant.totalMiles += distance;
        participant.runCount++;
        participant.lastActivity = Math.max(participant.lastActivity, event.created_at);
        participant.runs.push({
          distance,
          timestamp: event.created_at,
          eventId: event.id,
          activityType: eventActivityType
        });
        
        console.log(`    📊 Updated ${event.pubkey.substring(0, 8)}: ${oldTotal.toFixed(2)} + ${distance.toFixed(2)} = ${participant.totalMiles.toFixed(2)} miles, ${oldCount} + 1 = ${participant.runCount} runs`);
      } else {
        console.log(`    ❌ Participant not found in leaderboard map: ${event.pubkey.substring(0, 8)}`);
      }
    });
    
    console.log(`📋 Batch summary: ${processedEvents.length} processed, ${filteredCount} filtered out`);
    return processedEvents;
    
  } catch (err) {
    console.error('❌ Error processing batch:', err);
    return [];
  }
}

/**
 * Create and rank final leaderboard
 */
function createFinalLeaderboard(leaderboardMap) {
  console.log('\n🏆 Creating final leaderboard...');
  
  const leaderboardArray = Array.from(leaderboardMap.values());
  
  // Log each participant before sorting
  leaderboardArray.forEach((participant, index) => {
    console.log(`Participant ${index + 1}:`);
    console.log(`  - Pubkey: ${participant.pubkey.substring(0, 16)}...`);
    console.log(`  - Total miles: ${participant.totalMiles.toFixed(2)}`);
    console.log(`  - Run count: ${participant.runCount}`);
    console.log(`  - Runs: ${participant.runs.length}`);
    console.log(`  - Last activity: ${participant.lastActivity ? new Date(participant.lastActivity * 1000).toISOString() : 'None'}`);
  });
  
  // Sort by distance, then by run count, then by recency, then by pubkey (matches useLeagueLeaderboard logic)
  const sortedLeaderboard = leaderboardArray.sort((a, b) => {
    // Primary: Total distance (descending)
    if (b.totalMiles !== a.totalMiles) {
      return b.totalMiles - a.totalMiles;
    }
    
    // Secondary: Run count (descending)
    if (b.runCount !== a.runCount) {
      return b.runCount - a.runCount;
    }
    
    // Tertiary: Most recent activity (descending)
    if (b.lastActivity !== a.lastActivity) {
      return b.lastActivity - a.lastActivity;
    }
    
    // Quaternary: Pubkey (ascending for consistency)
    return a.pubkey.localeCompare(b.pubkey);
  });
  
  // Add rankings
  const rankedLeaderboard = sortedLeaderboard.map((participant, index) => ({
    ...participant,
    rank: index + 1,
    isComplete: true
  }));
  
  console.log('\n🎯 Final ranked leaderboard:');
  rankedLeaderboard.forEach((participant, index) => {
    console.log(`${participant.rank}. ${participant.pubkey.substring(0, 16)}...:`);
    console.log(`   📏 ${participant.totalMiles.toFixed(1)} miles`);
    console.log(`   🏃 ${participant.runCount} runs`);
    console.log(`   📅 Last: ${participant.lastActivity ? new Date(participant.lastActivity * 1000).toISOString() : 'Never'}`);
  });
  
  return rankedLeaderboard;
}

/**
 * Main debug function for leaderboard
 */
async function debugLeagueLeaderboard() {
  console.log('🏆 Starting League Leaderboard Debug');
  console.log('📅 Current date:', new Date().toISOString());
  console.log('👥 Default participants:', DEFAULT_PARTICIPANTS.length);
  
  // Step 1: Initialize participants
  console.log('\n📋 Step 1: Initialize participant payment dates');
  const participantPaymentDates = new Map();
  
  DEFAULT_PARTICIPANTS.forEach((participant, index) => {
    const paymentTimestamp = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
    participantPaymentDates.set(participant.pubkey, paymentTimestamp);
    
    console.log(`Participant ${index + 1}:`);
    console.log(`- Pubkey: ${participant.pubkey.substring(0, 16)}...`);
    console.log(`- Payment date: ${participant.paymentDate}`);
    console.log(`- Payment timestamp: ${paymentTimestamp} (${new Date(paymentTimestamp * 1000).toISOString()})`);
  });
  
  // Step 2: Create initial leaderboard map
  console.log('\n📋 Step 2: Create initial leaderboard map');
  const leaderboardMap = new Map();
  
  DEFAULT_PARTICIPANTS.forEach((participant, index) => {
    const initialParticipant = {
      pubkey: participant.pubkey,
      totalMiles: 0,
      runCount: 0,
      lastActivity: 0,
      runs: [],
      isComplete: false,
      paymentDate: participant.paymentDate,
      rank: index + 1
    };
    
    leaderboardMap.set(participant.pubkey, initialParticipant);
    console.log(`Initialized participant ${index + 1}: ${participant.pubkey.substring(0, 16)}...`);
  });
  
  // Step 3: Connect to Nostr
  console.log('\n📡 Step 3: Connect to Nostr relays');
  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  
  try {
    await ndk.connect();
    console.log('✅ Connected to Nostr');
  } catch (err) {
    console.error('❌ Failed to connect to Nostr:', err);
    return;
  }
  
  // Step 4: Fetch events
  console.log('\n🔄 Step 4: Fetch 1301 workout events');
  const participantPubkeys = DEFAULT_PARTICIPANTS.map(p => p.pubkey);
  const earliestPaymentDate = Math.min(...Array.from(participantPaymentDates.values()));
  
  console.log('Query parameters:');
  console.log('- Kinds:', [1301]);
  console.log('- Authors:', participantPubkeys);
  console.log('- Since:', earliestPaymentDate, `(${new Date(earliestPaymentDate * 1000).toISOString()})`);
  console.log('- Until:', COMPETITION_END, `(${new Date(COMPETITION_END * 1000).toISOString()})`);
  console.log('- Limit:', MAX_EVENTS);
  
  const events = await ndk.fetchEvents({
    kinds: [1301],
    authors: participantPubkeys,
    since: earliestPaymentDate,
    until: COMPETITION_END,
    limit: MAX_EVENTS
  });
  
  const eventArray = Array.from(events);
  console.log(`\n📊 Found ${eventArray.length} events`);
  
  if (eventArray.length === 0) {
    console.log('❌ No events found - this explains why leaderboard is empty!');
    return;
  }
  
  // Step 5: Process events in batches (matches useLeagueLeaderboard logic)
  console.log('\n🔄 Step 5: Process events in batches');
  console.log(`Processing ${eventArray.length} events in batches of ${BATCH_SIZE}`);
  
  const totalBatches = Math.ceil(eventArray.length / BATCH_SIZE);
  let totalProcessedEvents = 0;
  
  for (let i = 0; i < eventArray.length; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, eventArray.length);
    const processedEvents = processEventsBatch(
      eventArray, 
      leaderboardMap, 
      participantPaymentDates, 
      i, 
      batchEnd, 
      'run'
    );
    
    totalProcessedEvents += processedEvents.length;
    
    console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}/${totalBatches} complete. Total processed so far: ${totalProcessedEvents}`);
  }
  
  // Step 6: Create final leaderboard
  console.log('\n🏆 Step 6: Create final ranked leaderboard');
  const finalLeaderboard = createFinalLeaderboard(leaderboardMap);
  
  // Step 7: Summary
  console.log('\n\n=== FINAL SUMMARY ===');
  console.log(`📊 Total events fetched: ${eventArray.length}`);
  console.log(`✅ Total events processed: ${totalProcessedEvents}`);
  console.log(`🏆 Leaderboard participants: ${finalLeaderboard.length}`);
  
  if (totalProcessedEvents === 0 && eventArray.length > 0) {
    console.log('\n🚨 ISSUE IDENTIFIED: Events were fetched but none were processed!');
    console.log('This explains why the leaderboard shows 0 runs.');
    console.log('Check the filtering logic in the batch processing above.');
  } else if (totalProcessedEvents > 0) {
    console.log('\n✅ SUCCESS: Events were processed successfully.');
    console.log('If the UI still shows 0 runs, the issue is in the React component or state management.');
  }
  
  console.log('\n✅ Debug complete');
  process.exit(0);
}

// Run the debug script
debugLeagueLeaderboard().catch(console.error); 