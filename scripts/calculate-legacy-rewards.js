#!/usr/bin/env node

/**
 * RUNSTR Legacy Weekly Rewards Calculation Script
 * Queries kind:1301 workout events and calculates weekly rewards
 * Based on old reward system: 50 sats per workout + 50 sats per streak day
 */

import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from 'nostr-tools';

// Configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const RUNSTR_IDENTIFIERS = ['RUNSTR', 'runstr'];
const FETCH_TIMEOUT_MS = 30000; // 30 seconds
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

// Legacy reward configuration
const LEGACY_REWARD_CONFIG = {
  SATS_PER_WORKOUT: 50,
  SATS_PER_STREAK_DAY: 50
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Helper function to fetch events via subscribe with timeout
async function fetchWorkoutEvents(ndkInstance, sinceTimestamp) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        since: sinceTimestamp,
      },
      { closeOnEose: false }
    );

    const done = () => {
      try { sub.stop(); } catch (_) {}
      resolve(new Set(collected.values()));
    };

    // Safety timeout
    const timeoutId = setTimeout(done, FETCH_TIMEOUT_MS);

    sub.on("event", (ev) => {
      collected.set(ev.id, ev);
    });

    sub.on("eose", () => {
      clearTimeout(timeoutId);
      done();
    });
  });
}

// Fetch workout events for the week
async function fetchWeeklyWorkouts() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  const weekAgo = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    let events = await fetchWorkoutEvents(ndk, weekAgo);
    
    console.log(`${colors.cyan}📥 Fetched ${events.size} total kind:1301 events${colors.reset}`);
    
    // Filter for RUNSTR events
    const runstrEvents = Array.from(events).filter(event => 
      event.tags.some(tag => 
        (tag[0] === 'client' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase()))) ||
        (tag[0] === 'source' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase())))
      )
    );
    
    console.log(`${colors.green}✅ Found ${runstrEvents.length} RUNSTR workout events this week${colors.reset}`);
    
    return runstrEvents;
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching events:${colors.reset}`, error);
    return [];
  }
}

// Calculate legacy rewards for the week
function calculateLegacyRewards(events) {
  // Group events by user
  const userActivity = new Map();
  
  events.forEach(event => {
    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey);
    const eventDate = new Date(event.created_at * 1000).toDateString();
    
    if (!userActivity.has(npub)) {
      userActivity.set(npub, {
        workouts: 0,
        uniqueDays: new Set(),
        events: []
      });
    }
    
    const userData = userActivity.get(npub);
    userData.workouts++;
    userData.uniqueDays.add(eventDate);
    userData.events.push(event);
  });
  
  // Calculate rewards for each user
  const userRewards = [];
  let totalPayout = 0;
  
  for (const [npub, activity] of userActivity) {
    const workouts = activity.workouts;
    const streakDays = activity.uniqueDays.size;
    
    // Legacy calculation: 50 sats per workout + 50 sats per streak day
    const workoutSats = workouts * LEGACY_REWARD_CONFIG.SATS_PER_WORKOUT;
    const streakSats = streakDays * LEGACY_REWARD_CONFIG.SATS_PER_STREAK_DAY;
    const totalSats = workoutSats + streakSats;
    
    userRewards.push({
      npub,
      truncatedNpub: npub.substring(0, 63) + '...',
      workouts,
      streakDays,
      workoutSats,
      streakSats,
      totalSats
    });
    
    totalPayout += totalSats;
  }
  
  // Sort by total sats (descending)
  userRewards.sort((a, b) => b.totalSats - a.totalSats);
  
  return {
    userRewards,
    totalUsers: userRewards.length,
    totalPayout
  };
}

// Generate formatted output
function generateOutput(rewardsData) {
  const { userRewards, totalUsers, totalPayout } = rewardsData;
  const startDate = new Date(Date.now() - (WEEK_IN_SECONDS * 1000));
  const endDate = new Date();
  
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.magenta}${colors.bold}🏃 RUNSTR WEEKLY REWARDS CALCULATION (LEGACY SYSTEM)${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`${colors.cyan}📅 Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}${colors.reset}`);
  console.log(`${colors.cyan}💰 Rate: ${LEGACY_REWARD_CONFIG.SATS_PER_WORKOUT} sats per workout + ${LEGACY_REWARD_CONFIG.SATS_PER_STREAK_DAY} sats per streak day${colors.reset}`);
  console.log(`${colors.cyan}👥 Total users: ${totalUsers}${colors.reset}`);
  console.log(`${colors.cyan}💸 Total payout: ${totalPayout.toLocaleString()} sats${colors.reset}`);
  console.log('='.repeat(80));
  
  if (userRewards.length === 0) {
    console.log(`${colors.yellow}⚠ No users found with RUNSTR workouts this week${colors.reset}`);
    return;
  }
  
  // Reward breakdown table
  console.log('\n' + `${colors.bold}📊 REWARD BREAKDOWN:${colors.reset}`);
  console.log('-'.repeat(120));
  console.log(`${colors.bold}NPUB${' '.repeat(59)} WORKOUTS  STREAK  WORKOUT SATS STREAK SATS   TOTAL SATS${colors.reset}`);
  console.log('-'.repeat(120));
  
  userRewards.forEach(user => {
    const npubPadded = user.truncatedNpub.padEnd(63);
    const workoutsPadded = user.workouts.toString().padStart(8);
    const streakPadded = user.streakDays.toString().padStart(6);
    const workoutSatsPadded = user.workoutSats.toString().padStart(12);
    const streakSatsPadded = user.streakSats.toString().padStart(11);
    const totalSatsPadded = user.totalSats.toString().padStart(11);
    
    console.log(`${npubPadded} ${workoutsPadded} ${streakPadded} ${workoutSatsPadded} ${streakSatsPadded} ${totalSatsPadded}`);
  });
  
  console.log('-'.repeat(120));
  console.log(`${colors.bold}TOTAL:${' '.repeat(115)} ${totalPayout.toLocaleString()}${colors.reset}`);
  
  // Payment list
  console.log('\n' + `${colors.bold}💰 PAYMENT LIST (copy-paste ready):${colors.reset}`);
  console.log('-'.repeat(80));
  
  userRewards.forEach(user => {
    console.log(`${user.npub}: ${user.totalSats} sats`);
  });
  
  console.log(`\n${colors.green}✅ Legacy rewards calculation complete!${colors.reset}`);
  console.log(`${colors.yellow}📝 Note: This uses the old system (${LEGACY_REWARD_CONFIG.SATS_PER_WORKOUT} sats/workout + ${LEGACY_REWARD_CONFIG.SATS_PER_STREAK_DAY} sats/streak day)${colors.reset}`);
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}🏃 RUNSTR Legacy Weekly Rewards Calculator${colors.reset}\n`);
  
  // Fetch weekly workout events
  const events = await fetchWeeklyWorkouts();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found this week${colors.reset}`);
    return;
  }
  
  // Calculate legacy rewards
  const rewardsData = calculateLegacyRewards(events);
  
  // Generate output
  generateOutput(rewardsData);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
  process.exit(1);
}); 