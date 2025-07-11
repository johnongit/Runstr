#!/usr/bin/env node

/**
 * Debug Season Pass Filtering
 * 
 * This script fetches real 1301 workout events from Season Pass participants
 * and tests each filtering condition to identify why events appear in the feed
 * but not in the leaderboard standings.
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

// Competition configuration
const COMPETITION_END = Math.floor(new Date('2025-10-11T23:59:59Z').getTime() / 1000);
const MAX_EVENTS = 1000;

// Relay configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band'
];

/**
 * Extract distance from event tags (mimics the frontend logic)
 */
function extractDistance(event) {
  try {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const distance = parseFloat(distanceTag[1]);
    const unit = distanceTag[2] || 'km';
    
    // Convert to miles if needed (assuming backend stores in miles)
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
 * Test feed filtering logic (simplified version)
 */
function testFeedFiltering(event) {
  console.log('\n=== FEED FILTERING TEST ===');
  
  // Check required tags
  const hasRequiredTags = {
    source: false,
    client: false,
    workoutId: false,
    title: false,
    exercise: false,
    distance: false,
    duration: false
  };
  
  for (const tag of event.tags || []) {
    switch (tag[0]) {
      case 'source':
        if (tag[1] === 'RUNSTR') {
          hasRequiredTags.source = true;
        }
        break;
      case 'client':
        if (tag[1] && tag[1].toLowerCase().includes('runstr')) {
          hasRequiredTags.client = true;
        }
        break;
      case 'd':
        if (tag[1]) {
          hasRequiredTags.workoutId = true;
        }
        break;
      case 'title':
        if (tag[1]) {
          hasRequiredTags.title = true;
        }
        break;
      case 'exercise':
        if (tag[1]) {
          hasRequiredTags.exercise = true;
        }
        break;
      case 'distance':
        if (tag[1] && tag[2]) {
          hasRequiredTags.distance = true;
        }
        break;
      case 'duration':
        if (tag[1] && typeof tag[1] === 'string' && tag[1].length > 0) {
          hasRequiredTags.duration = true;
        }
        break;
    }
  }
  
  const hasRunstrIdentification = hasRequiredTags.source || hasRequiredTags.client;
  const hasRunstrStructure = hasRequiredTags.workoutId && 
                            hasRequiredTags.title && 
                            hasRequiredTags.exercise && 
                            hasRequiredTags.distance && 
                            hasRequiredTags.duration;
  
  const isRunstrWorkout = hasRunstrIdentification && hasRunstrStructure;
  
  console.log('Feed Filter Results:');
  console.log('- Has RUNSTR identification:', hasRunstrIdentification);
  console.log('- Has RUNSTR structure:', hasRunstrStructure);
  console.log('- Is RUNSTR workout:', isRunstrWorkout);
  console.log('- Required tags:', hasRequiredTags);
  
  // Check participant status
  const isParticipant = DEFAULT_PARTICIPANTS.some(p => p.pubkey === event.pubkey);
  console.log('- Is participant:', isParticipant);
  
  const passesFeeedFilter = isRunstrWorkout && isParticipant;
  console.log('- PASSES FEED FILTER:', passesFeeedFilter);
  
  return passesFeeedFilter;
}

/**
 * Test leaderboard filtering logic
 */
function testLeaderboardFiltering(event, activityMode = 'run') {
  console.log('\n=== LEADERBOARD FILTERING TEST ===');
  
  // Find participant
  const participant = DEFAULT_PARTICIPANTS.find(p => p.pubkey === event.pubkey);
  if (!participant) {
    console.log('❌ Not a participant');
    return false;
  }
  
  // Check payment date
  const participantPaymentDate = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
  const eventDate = event.created_at;
  
  console.log('Payment Date Comparison:');
  console.log('- Participant payment date:', participantPaymentDate, `(${new Date(participantPaymentDate * 1000).toISOString()})`);
  console.log('- Event created_at:', eventDate, `(${new Date(eventDate * 1000).toISOString()})`);
  console.log('- Event is after payment:', eventDate >= participantPaymentDate);
  
  if (eventDate < participantPaymentDate) {
    console.log('❌ Event before payment date');
    return false;
  }
  
  // Check competition end date
  if (eventDate > COMPETITION_END) {
    console.log('❌ Event after competition end');
    return false;
  }
  
  // Check activity mode
  const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
  const eventActivityType = exerciseTag?.[1]?.toLowerCase();
  
  const activityMatches = {
    'run': ['run', 'running', 'jog', 'jogging'],
    'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
    'walk': ['walk', 'walking', 'hike', 'hiking']
  };
  
  const acceptedActivities = activityMatches[activityMode] || [activityMode];
  
  console.log('Activity Mode Check:');
  console.log('- Event activity type:', eventActivityType);
  console.log('- Current activity mode:', activityMode);
  console.log('- Accepted activities:', acceptedActivities);
  console.log('- Activity matches:', !eventActivityType || acceptedActivities.includes(eventActivityType));
  
  if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
    console.log('❌ Activity type mismatch');
    return false;
  }
  
  // Check distance
  const distance = extractDistance(event);
  console.log('Distance Check:');
  console.log('- Extracted distance:', distance);
  console.log('- Distance > 0:', distance > 0);
  
  if (distance <= 0) {
    console.log('❌ Invalid distance');
    return false;
  }
  
  console.log('✅ PASSES LEADERBOARD FILTER');
  return true;
}

/**
 * Main debug function
 */
async function debugSeasonPassFiltering() {
  console.log('🔍 Starting Season Pass Filtering Debug');
  console.log('📅 Current date:', new Date().toISOString());
  console.log('👥 Default participants:', DEFAULT_PARTICIPANTS.length);
  
  // Log participant details
  DEFAULT_PARTICIPANTS.forEach((participant, index) => {
    console.log(`\nParticipant ${index + 1}:`);
    console.log('- Pubkey:', participant.pubkey);
    console.log('- Payment date:', participant.paymentDate);
    console.log('- Payment timestamp:', Math.floor(new Date(participant.paymentDate).getTime() / 1000));
  });
  
  // Connect to NDK
  console.log('\n📡 Connecting to Nostr relays...');
  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  
  try {
    await ndk.connect();
    console.log('✅ Connected to Nostr');
  } catch (err) {
    console.error('❌ Failed to connect to Nostr:', err);
    return;
  }
  
  // Fetch events
  console.log('\n🔄 Fetching 1301 workout events...');
  const participantPubkeys = DEFAULT_PARTICIPANTS.map(p => p.pubkey);
  const earliestPaymentDate = Math.min(...DEFAULT_PARTICIPANTS.map(p => Math.floor(new Date(p.paymentDate).getTime() / 1000)));
  
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
    console.log('❌ No events found. This might be the issue!');
    return;
  }
  
  // Test each event
  console.log('\n🧪 Testing each event:');
  
  eventArray.forEach((event, index) => {
    console.log(`\n\n=== EVENT ${index + 1} ===`);
    console.log('Event ID:', event.id);
    console.log('Pubkey:', event.pubkey);
    console.log('Created at:', event.created_at, `(${new Date(event.created_at * 1000).toISOString()})`);
    console.log('Content preview:', event.content.substring(0, 100) + '...');
    
    // Show all tags
    console.log('Tags:');
    event.tags?.forEach((tag, tagIndex) => {
      console.log(`  ${tagIndex}: [${tag.join(', ')}]`);
    });
    
    // Test feed filtering
    const passesFeeedFilter = testFeedFiltering(event);
    
    // Test leaderboard filtering
    const passesLeaderboardFilter = testLeaderboardFiltering(event);
    
    console.log('\n📋 SUMMARY:');
    console.log('- Passes feed filter:', passesFeeedFilter);
    console.log('- Passes leaderboard filter:', passesLeaderboardFilter);
    
    if (passesFeeedFilter && !passesLeaderboardFilter) {
      console.log('🚨 ISSUE FOUND: Event passes feed but not leaderboard!');
    }
  });
  
  // Summary
  const feedPassCount = eventArray.filter(event => testFeedFiltering(event)).length;
  const leaderboardPassCount = eventArray.filter(event => testLeaderboardFiltering(event)).length;
  
  console.log('\n\n=== FINAL SUMMARY ===');
  console.log(`📊 Total events fetched: ${eventArray.length}`);
  console.log(`✅ Events passing feed filter: ${feedPassCount}`);
  console.log(`✅ Events passing leaderboard filter: ${leaderboardPassCount}`);
  console.log(`🚨 Discrepancy: ${feedPassCount - leaderboardPassCount} events`);
  
  if (feedPassCount > leaderboardPassCount) {
    console.log('\n🔍 ISSUE IDENTIFIED: Some events pass feed filtering but not leaderboard filtering.');
    console.log('This explains why you see workouts in the feed but not in the standings.');
  }
  
  await ndk.destroy();
  console.log('\n✅ Debug complete');
}

// Run the debug script
debugSeasonPassFiltering().catch(console.error); 