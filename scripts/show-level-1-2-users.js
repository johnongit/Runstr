#!/usr/bin/env node

/**
 * RUNSTR Level 1 & 2 Users Display Script
 * Shows all users at level 1 and level 2 with their hex format npubs
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
const FETCH_TIMEOUT_MS = 60000; // 60 seconds for comprehensive fetch

// XP Configuration (matching existing scripts)
const XP_CONFIG = {
  BASE_XP: 10,
  DISTANCE_BONUS: 5,
  QUALIFYING_DISTANCE: 1.0, // 1+ mile
  LEVEL_XP_FORMULA: {
    getXPRequired: (level) => {
      if (level <= 10) {
        return level * 100;
      }
      const baseXP = 1000;
      const levelsAbove10 = level - 10;
      return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
    }
  }
};

// ANSI color codes
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

// Helper function to calculate XP from a workout
function calculateWorkoutXP(distance) {
  if (distance < XP_CONFIG.QUALIFYING_DISTANCE) {
    return 0;
  }
  
  const baseMiles = 1;
  const additionalMiles = Math.floor(distance - baseMiles);
  
  return XP_CONFIG.BASE_XP + (additionalMiles * XP_CONFIG.DISTANCE_BONUS);
}

// Helper function to calculate level from total XP
function calculateLevel(totalXP) {
  if (totalXP === 0) return 0;
  
  for (let level = 1; level <= 100; level++) {
    const requiredXP = XP_CONFIG.LEVEL_XP_FORMULA.getXPRequired(level);
    if (totalXP < requiredXP) {
      return level - 1;
    }
  }
  
  return 100; // Cap at level 100
}

// Helper function to extract distance from event content
function extractDistance(event) {
  const content = event.content || '';
  
  // Look for distance tag first
  const distanceTag = event.tags.find(tag => tag[0] === 'distance');
  if (distanceTag && distanceTag[1]) {
    const distance = parseFloat(distanceTag[1]);
    if (!isNaN(distance)) {
      return distance;
    }
  }
  
  // Parse from content as fallback
  const distanceRegex = /(?:distance|ran|walked|cycled)[\s:]*(\d+\.?\d*)\s*(?:miles?|mi|km|kilometers?)/i;
  const match = content.match(distanceRegex);
  
  if (match) {
    const distance = parseFloat(match[1]);
    if (!isNaN(distance)) {
      // Convert km to miles if needed
      if (content.toLowerCase().includes('km') || content.toLowerCase().includes('kilometer')) {
        return distance * 0.621371;
      }
      return distance;
    }
  }
  
  // Default fallback for qualifying workouts
  return 1.5; // Assume 1.5 miles for workouts without clear distance
}

// Helper function to fetch events via subscribe with timeout
async function fetchWorkoutEvents(ndkInstance) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
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

// Fetch all workout events
async function fetchAllWorkouts() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    let events = await fetchWorkoutEvents(ndk);
    
    console.log(`${colors.cyan}📥 Fetched ${events.size} total kind:1301 events${colors.reset}`);
    
    // Filter for RUNSTR events
    const runstrEvents = Array.from(events).filter(event => 
      event.tags.some(tag => 
        (tag[0] === 'client' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase()))) ||
        (tag[0] === 'source' && RUNSTR_IDENTIFIERS.some(id => tag[1]?.toLowerCase().includes(id.toLowerCase())))
      )
    );
    
    console.log(`${colors.green}✅ Found ${runstrEvents.length} RUNSTR workout events${colors.reset}`);
    
    return runstrEvents;
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching events:${colors.reset}`, error);
    return [];
  }
}

// Calculate user levels and filter for level 1 & 2
function findLevel1And2Users(events) {
  const userWorkouts = new Map();
  
  // Group events by user (using hex pubkey)
  events.forEach(event => {
    const hexPubkey = event.pubkey;
    
    if (!userWorkouts.has(hexPubkey)) {
      userWorkouts.set(hexPubkey, []);
    }
    
    userWorkouts.get(hexPubkey).push({
      timestamp: event.created_at,
      distance: extractDistance(event),
      event
    });
  });
  
  // Calculate XP and levels for each user
  const level1Users = [];
  const level2Users = [];
  
  for (const [hexPubkey, workouts] of userWorkouts) {
    let totalXP = 0;
    let qualifyingWorkouts = 0;
    
    workouts.forEach(workout => {
      const xp = calculateWorkoutXP(workout.distance);
      totalXP += xp;
      if (xp > 0) qualifyingWorkouts++;
    });
    
    const currentLevel = calculateLevel(totalXP);
    const npub = nip19.npubEncode(hexPubkey);
    
    const userData = {
      hexPubkey,
      npub,
      totalXP,
      currentLevel,
      qualifyingWorkouts,
      totalWorkouts: workouts.length,
      truncatedNpub: npub.substring(0, 20) + '...'
    };
    
    if (currentLevel === 1) {
      level1Users.push(userData);
    } else if (currentLevel === 2) {
      level2Users.push(userData);
    }
  }
  
  // Sort by total XP (highest first)
  level1Users.sort((a, b) => b.totalXP - a.totalXP);
  level2Users.sort((a, b) => b.totalXP - a.totalXP);
  
  return { level1Users, level2Users };
}

// Generate formatted output
function generateOutput(userData) {
  const { level1Users, level2Users } = userData;
  
  console.log('\n' + '═'.repeat(100));
  console.log(`${colors.magenta}${colors.bold}🏆 RUNSTR LEVEL 1 & 2 USERS${colors.reset}`);
  console.log('═'.repeat(100));
  console.log(`${colors.cyan}📊 Level 1 Users: ${level1Users.length}${colors.reset}`);
  console.log(`${colors.cyan}📊 Level 2 Users: ${level2Users.length}${colors.reset}`);
  console.log(`${colors.cyan}📊 Total: ${level1Users.length + level2Users.length}${colors.reset}`);
  
  // Level 1 Users
  if (level1Users.length > 0) {
    console.log('\n' + '─'.repeat(100));
    console.log(`${colors.green}${colors.bold}🥉 LEVEL 1 USERS (${level1Users.length} users)${colors.reset}`);
    console.log('─'.repeat(100));
    console.log(`${colors.bold}HEX PUBKEY${' '.repeat(54)} XP     WORKOUTS  NPUB (truncated)${colors.reset}`);
    console.log('─'.repeat(100));
    
    level1Users.forEach((user, index) => {
      const hexPadded = user.hexPubkey.padEnd(64);
      const xpPadded = user.totalXP.toString().padStart(6);
      const workoutsPadded = user.qualifyingWorkouts.toString().padStart(8);
      console.log(`${hexPadded} ${xpPadded} ${workoutsPadded}  ${user.truncatedNpub}`);
    });
    
    // Hex list for copy-paste
    console.log(`\n${colors.bold}📋 LEVEL 1 HEX PUBKEYS (copy-paste ready):${colors.reset}`);
    console.log('-'.repeat(64));
    level1Users.forEach(user => {
      console.log(user.hexPubkey);
    });
  }
  
  // Level 2 Users
  if (level2Users.length > 0) {
    console.log('\n' + '─'.repeat(100));
    console.log(`${colors.blue}${colors.bold}🥈 LEVEL 2 USERS (${level2Users.length} users)${colors.reset}`);
    console.log('─'.repeat(100));
    console.log(`${colors.bold}HEX PUBKEY${' '.repeat(54)} XP     WORKOUTS  NPUB (truncated)${colors.reset}`);
    console.log('─'.repeat(100));
    
    level2Users.forEach((user, index) => {
      const hexPadded = user.hexPubkey.padEnd(64);
      const xpPadded = user.totalXP.toString().padStart(6);
      const workoutsPadded = user.qualifyingWorkouts.toString().padStart(8);
      console.log(`${hexPadded} ${xpPadded} ${workoutsPadded}  ${user.truncatedNpub}`);
    });
    
    // Hex list for copy-paste
    console.log(`\n${colors.bold}📋 LEVEL 2 HEX PUBKEYS (copy-paste ready):${colors.reset}`);
    console.log('-'.repeat(64));
    level2Users.forEach(user => {
      console.log(user.hexPubkey);
    });
  }
  
  if (level1Users.length === 0 && level2Users.length === 0) {
    console.log(`\n${colors.yellow}⚠ No level 1 or level 2 users found${colors.reset}`);
  }
  
  console.log(`\n${colors.green}✅ Level 1 & 2 users analysis complete!${colors.reset}`);
}

// Main execution
async function main() {
  console.log(`${colors.magenta}${colors.bold}🏆 RUNSTR Level 1 & 2 Users Finder${colors.reset}\n`);
  
  // Fetch all workout events
  const events = await fetchAllWorkouts();
  
  if (events.length === 0) {
    console.log(`${colors.yellow}⚠ No RUNSTR workout events found${colors.reset}`);
    return;
  }
  
  // Find level 1 and 2 users
  const userData = findLevel1And2Users(events);
  
  // Generate output
  generateOutput(userData);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
  process.exit(1);
}); 