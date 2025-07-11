#!/usr/bin/env node

/**
 * Debug League Feed vs Leaderboard Comparison
 * 
 * This script runs both League Feed and League Leaderboard processing logic
 * side-by-side to identify exactly where the disconnect occurs that causes
 * the feed to show runs but the leaderboard to show 0 runs.
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

// Competition configuration (from both hooks)
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
 * Extract distance from event tags (matches both hooks)
 */
function extractDistanceForFeed(event) {
  try {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const value = parseFloat(distanceTag[1]);
    if (isNaN(value) || value < 0) return 0;
    
    const unit = distanceTag[2]?.toLowerCase() || 'km';
    
    // Add reasonable bounds checking to filter out corrupted data
    const MAX_REASONABLE_DISTANCE_KM = 500; // 500km covers ultramarathons
    const MIN_REASONABLE_DISTANCE_KM = 0.01; // 10 meters minimum
    
    // Convert to km first for validation
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
    
    // Validate reasonable range
    if (distanceInKm < MIN_REASONABLE_DISTANCE_KM || distanceInKm > MAX_REASONABLE_DISTANCE_KM) {
      console.warn(`Invalid distance detected: ${value} ${unit} (${distanceInKm.toFixed(2)}km) - filtering out event ${event.id}`);
      return 0;
    }
    
    // Return in km for internal consistency (like Profile/Stats)
    return distanceInKm;
  } catch (err) {
    console.error('Error extracting distance:', err);
    return 0;
  }
}

/**
 * Extract distance for leaderboard (matches useLeagueLeaderboard logic)
 */
function extractDistanceForLeaderboard(event) {
  try {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const distance = parseFloat(distanceTag[1]);
    const unit = distanceTag[2] || 'km';
    
    // Convert to miles if needed (leaderboard uses miles)
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
 * Process events for feed (matches useLeagueActivityFeed logic)
 */
function processEventsForFeed(events, participantPaymentDates, activityMode = 'run') {
  console.log('\n🔄 PROCESSING EVENTS FOR FEED');
  console.log('================================================');
  
  const processedEvents = [];
  let duplicateCount = 0;
  let filteredCount = 0;
  
  events.forEach((event, index) => {
    console.log(`\n📝 Processing event ${index + 1}/${events.length}`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Pubkey: ${event.pubkey}`);
    console.log(`   Created: ${new Date(event.created_at * 1000).toISOString()}`);
    
    if (!event.pubkey) {
      console.log('   ❌ No pubkey - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by individual participant payment date
    const participantPaymentDate = participantPaymentDates.get(event.pubkey);
    if (!participantPaymentDate) {
      console.log('   ❌ Not a participant - FILTERED');
      filteredCount++;
      return;
    }
    
    if (event.created_at < participantPaymentDate) {
      console.log('   ❌ Before payment date - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by global competition end date
    if (event.created_at > COMPETITION_END) {
      console.log('   ❌ After competition end - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by current activity mode using exercise tag
    const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
    const eventActivityType = exerciseTag?.[1]?.toLowerCase();
    
    console.log(`   🏃 Exercise tag: ${eventActivityType || 'none'}`);
    
    const activityMatches = {
      'run': ['run', 'running', 'jog', 'jogging'],
      'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
      'walk': ['walk', 'walking', 'hike', 'hiking']
    };
    
    const acceptedActivities = activityMatches[activityMode] || [activityMode];
    
    if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
      console.log(`   ❌ Activity mismatch (${eventActivityType} not in ${acceptedActivities.join(', ')}) - FILTERED`);
      filteredCount++;
      return;
    }
    
    const distance = extractDistanceForFeed(event);
    console.log(`   📏 Distance: ${distance} km`);
    
    if (distance <= 0) {
      console.log('   ❌ Invalid distance - FILTERED');
      filteredCount++;
      return;
    }

    // Create feed-specific event object
    const feedEvent = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      content: event.content,
      tags: event.tags,
      distance: distance,
      activityType: eventActivityType,
      title: event.tags?.find(tag => tag[0] === 'title')?.[1] || '',
      duration: event.tags?.find(tag => tag[0] === 'duration')?.[1] || '',
      displayDistance: `${distance.toFixed(1)} km`,
      displayActivity: eventActivityType || 'activity',
      rawEvent: event
    };

    console.log('   ✅ ACCEPTED FOR FEED');
    processedEvents.push(feedEvent);
  });
  
  console.log(`\n📊 FEED PROCESSING SUMMARY:`);
  console.log(`   Total events: ${events.length}`);
  console.log(`   Processed: ${processedEvents.length}`);
  console.log(`   Filtered: ${filteredCount}`);
  console.log(`   Activity mode: ${activityMode}`);
  
  return processedEvents;
}

/**
 * Process events for leaderboard (matches useLeagueLeaderboard logic)
 */
function processEventsForLeaderboard(events, participantPaymentDates, activityMode = 'run') {
  console.log('\n🏆 PROCESSING EVENTS FOR LEADERBOARD');
  console.log('================================================');
  
  // Initialize leaderboard map
  const leaderboardMap = new Map();
  DEFAULT_PARTICIPANTS.forEach(participant => {
    leaderboardMap.set(participant.pubkey, {
      pubkey: participant.pubkey,
      totalMiles: 0,
      runCount: 0,
      lastActivity: 0,
      runs: [],
      paymentDate: participant.paymentDate
    });
  });
  
  let processedEvents = [];
  let filteredCount = 0;
  
  events.forEach((event, index) => {
    console.log(`\n📝 Processing event ${index + 1}/${events.length}`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Pubkey: ${event.pubkey}`);
    console.log(`   Created: ${new Date(event.created_at * 1000).toISOString()}`);
    
    if (!event.pubkey) {
      console.log('   ❌ No pubkey - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by individual participant payment date
    const participantPaymentDate = participantPaymentDates.get(event.pubkey);
    if (!participantPaymentDate) {
      console.log('   ❌ Not a participant - FILTERED');
      filteredCount++;
      return;
    }
    
    if (event.created_at < participantPaymentDate) {
      console.log('   ❌ Before payment date - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by global competition end date
    if (event.created_at > COMPETITION_END) {
      console.log('   ❌ After competition end - FILTERED');
      filteredCount++;
      return;
    }
    
    // Filter by current activity mode using exercise tag
    const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
    const eventActivityType = exerciseTag?.[1]?.toLowerCase();
    
    console.log(`   🏃 Exercise tag: ${eventActivityType || 'none'}`);
    
    const activityMatches = {
      'run': ['run', 'running', 'jog', 'jogging'],
      'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
      'walk': ['walk', 'walking', 'hike', 'hiking']
    };
    
    const acceptedActivities = activityMatches[activityMode] || [activityMode];
    
    if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
      console.log(`   ❌ Activity mismatch (${eventActivityType} not in ${acceptedActivities.join(', ')}) - FILTERED`);
      filteredCount++;
      return;
    }
    
    const distance = extractDistanceForLeaderboard(event);
    console.log(`   📏 Distance: ${distance} miles`);
    
    if (distance <= 0) {
      console.log('   ❌ Invalid distance - FILTERED');
      filteredCount++;
      return;
    }

    processedEvents.push(event);

    // Update participant data
    const participant = leaderboardMap.get(event.pubkey);
    if (participant) {
      participant.totalMiles += distance;
      participant.runCount++;
      participant.lastActivity = Math.max(participant.lastActivity, event.created_at);
      participant.runs.push({
        distance,
        timestamp: event.created_at,
        eventId: event.id,
        activityType: eventActivityType
      });
      
      console.log(`   ✅ ACCEPTED FOR LEADERBOARD - Added ${distance} miles to ${event.pubkey}`);
      console.log(`   📊 Participant totals: ${participant.totalMiles.toFixed(2)} miles, ${participant.runCount} runs`);
    } else {
      console.log('   ⚠️ Participant not found in leaderboard map');
    }
  });
  
  console.log(`\n📊 LEADERBOARD PROCESSING SUMMARY:`);
  console.log(`   Total events: ${events.length}`);
  console.log(`   Processed: ${processedEvents.length}`);
  console.log(`   Filtered: ${filteredCount}`);
  console.log(`   Activity mode: ${activityMode}`);
  
  // Convert leaderboard map to array and sort
  const leaderboard = Array.from(leaderboardMap.values())
    .sort((a, b) => b.totalMiles - a.totalMiles)
    .map((participant, index) => ({
      ...participant,
      rank: index + 1
    }));
  
  console.log(`\n🏆 FINAL LEADERBOARD:`);
  leaderboard.forEach(participant => {
    console.log(`   ${participant.rank}. ${participant.pubkey}: ${participant.totalMiles.toFixed(2)} miles, ${participant.runCount} runs`);
  });
  
  return { processedEvents, leaderboard };
}

/**
 * Main debug function
 */
async function debugLeagueComparison() {
  console.log('🔍 DEBUGGING LEAGUE FEED VS LEADERBOARD');
  console.log('========================================\n');
  
  try {
    // Initialize NDK
    const ndk = new NDK({
      explicitRelayUrls: RELAYS,
      outboxRelayUrls: RELAYS,
      enableOutboxModel: false
    });
    
    console.log('🔗 Connecting to relays...');
    await ndk.connect();
    console.log('✅ Connected to relays');
    
    // Set up participant payment dates
    const participantPaymentDates = new Map();
    DEFAULT_PARTICIPANTS.forEach(participant => {
      const paymentTimestamp = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
      participantPaymentDates.set(participant.pubkey, paymentTimestamp);
      console.log(`👤 Participant: ${participant.pubkey} - Payment: ${participant.paymentDate}`);
    });
    
    console.log(`\n📅 Competition End: ${new Date(COMPETITION_END * 1000).toISOString()}`);
    console.log(`📅 Earliest Payment: ${new Date(Math.min(...Array.from(participantPaymentDates.values())) * 1000).toISOString()}`);
    
    // Fetch events
    const participantPubkeys = DEFAULT_PARTICIPANTS.map(p => p.pubkey);
    const earliestPaymentDate = Math.min(...Array.from(participantPaymentDates.values()));
    
    console.log('\n📡 Fetching events...');
    console.log(`   Kind: 1301`);
    console.log(`   Authors: ${participantPubkeys.length} participants`);
    console.log(`   Since: ${new Date(earliestPaymentDate * 1000).toISOString()}`);
    console.log(`   Until: ${new Date(COMPETITION_END * 1000).toISOString()}`);
    console.log(`   Limit: ${MAX_EVENTS}`);
    
    const filter = {
      kinds: [1301],
      authors: participantPubkeys,
      since: earliestPaymentDate,
      until: COMPETITION_END,
      limit: MAX_EVENTS
    };
    
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);
    
    console.log(`\n📊 Fetched ${eventsArray.length} events`);
    
    if (eventsArray.length === 0) {
      console.log('❌ No events found! Check:');
      console.log('   - Are participants posting 1301 events?');
      console.log('   - Are the pubkeys correct?');
      console.log('   - Are the dates correct?');
      console.log('   - Are the relays responding?');
      return;
    }
    
    // Show first few events for inspection
    console.log('\n🔍 SAMPLE EVENTS:');
    eventsArray.slice(0, 3).forEach((event, i) => {
      console.log(`\n📝 Event ${i + 1}:`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Pubkey: ${event.pubkey}`);
      console.log(`   Created: ${new Date(event.created_at * 1000).toISOString()}`);
      console.log(`   Content: ${event.content.substring(0, 100)}...`);
      console.log(`   Tags: ${JSON.stringify(event.tags.slice(0, 5), null, 2)}`);
    });
    
    // Process with both methods
    const activityMode = 'run';
    
    const feedEvents = processEventsForFeed(eventsArray, participantPaymentDates, activityMode);
    const { processedEvents: leaderboardEvents, leaderboard } = processEventsForLeaderboard(eventsArray, participantPaymentDates, activityMode);
    
    // Compare results
    console.log('\n🔍 COMPARISON RESULTS');
    console.log('====================');
    console.log(`📊 Feed processed: ${feedEvents.length} events`);
    console.log(`🏆 Leaderboard processed: ${leaderboardEvents.length} events`);
    console.log(`📊 Total runs in leaderboard: ${leaderboard.reduce((sum, p) => sum + p.runCount, 0)}`);
    console.log(`📊 Total miles in leaderboard: ${leaderboard.reduce((sum, p) => sum + p.totalMiles, 0).toFixed(2)}`);
    
    if (feedEvents.length > 0 && leaderboardEvents.length === 0) {
      console.log('\n❌ PROBLEM IDENTIFIED: Feed processes events but leaderboard doesn\'t!');
      console.log('   This suggests a difference in the filtering or processing logic.');
    } else if (feedEvents.length === 0 && leaderboardEvents.length === 0) {
      console.log('\n❌ PROBLEM IDENTIFIED: Neither feed nor leaderboard processes events!');
      console.log('   This suggests a fundamental filtering issue (dates, participants, etc.)');
    } else if (feedEvents.length > 0 && leaderboardEvents.length > 0) {
      console.log('\n✅ Both feed and leaderboard process events successfully!');
      console.log('   The issue might be in the UI display or state management.');
    }
    
    // Show differences in distance calculation
    if (feedEvents.length > 0 && leaderboardEvents.length > 0) {
      console.log('\n📏 DISTANCE CALCULATION DIFFERENCES:');
      console.log('Feed uses km, Leaderboard uses miles');
      
      feedEvents.slice(0, 3).forEach((feedEvent, i) => {
        const leaderboardEvent = leaderboardEvents[i];
        if (leaderboardEvent) {
          const feedDistance = feedEvent.distance; // km
          const leaderboardDistance = extractDistanceForLeaderboard(leaderboardEvent); // miles
          console.log(`Event ${i + 1}: Feed=${feedDistance.toFixed(2)}km, Leaderboard=${leaderboardDistance.toFixed(2)}mi`);
        }
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Error during debug:', error);
    process.exit(1);
  }
}

// Run the debug
debugLeagueComparison().catch(console.error); 