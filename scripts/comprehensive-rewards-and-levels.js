#!/usr/bin/env node

/**
 * RUNSTR Comprehensive Rewards & Levels Calculator
 * Fetches complete workout history and calculates accurate levels + weekly rewards
 * Matches UI XP calculation logic exactly (no minimum distance threshold)
 */

import NDK from "@nostr-dev-kit/ndk";
import { nip19 } from 'nostr-tools';
import fs from 'fs';

// Configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const RUNSTR_IDENTIFIERS = ['RUNSTR', 'runstr'];
const FETCH_TIMEOUT_MS = 60000; // 60 seconds for comprehensive fetch
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

// Reward configuration (from existing scripts)
const REWARD_CONFIG = {
  STREAK_MULTIPLIERS: {
    1: 20,   // 1 run: 20 sats
    2: 40,   // 2 runs: 40 sats (total 60)
    3: 60,   // 3 runs: 60 sats (total 120)
    4: 80,   // 4 runs: 80 sats (total 200)
    5: 100,  // 5 runs: 100 sats (total 300)
    6: 120,  // 6 runs: 120 sats (total 420)
    7: 140,  // 7 runs: 140 sats (total 560)
  },
  LEVEL_BONUSES: {
    1: 50,   // Level 1: +50 weekly base reward
    2: 5,    // Level 2: +5 streak reward
  }
};

// Data persistence file
const DATA_FILE = 'scripts/comprehensive-tracking-data.json';

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

// ================================
// UTILITY FUNCTIONS (UI-matched)
// ================================

/**
 * Calculate XP from workout - matches UI logic exactly
 * ALL workouts get XP (no minimum distance threshold)
 */
function calculateWorkoutXP(distanceInMiles) {
  const baseXP = 10;
  const distanceBonus = Math.floor(distanceInMiles - 1) * 5;
  return baseXP + distanceBonus;
}

/**
 * Get XP required for a specific level - matches UI logic
 */
function getXPRequiredForLevel(level) {
  if (level <= 10) {
    return level * 100;
  }
  const baseXP = 1000; // XP for level 10
  const levelsAbove10 = level - 10;
  return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
}

/**
 * Calculate level from total XP - matches UI logic
 */
function calculateLevelFromXP(totalXP) {
  if (totalXP === 0) return 0;
  
  let level = 1;
  while (getXPRequiredForLevel(level + 1) <= totalXP) {
    level++;
  }
  return level;
}

/**
 * Extract distance from event content and tags
 */
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
  
  // Default fallback for workouts without clear distance
  return 1.0; // Assume 1 mile for workouts without clear distance
}

/**
 * Format date from timestamp
 */
function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Get date range string
 */
function getDateRangeString(sinceTimestamp) {
  const startDate = new Date(sinceTimestamp * 1000);
  const endDate = new Date();
  
  return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}

/**
 * Truncate npub for display
 */
function truncateNpub(npub) {
  return npub.substring(0, 63) + '...';
}

// ================================
// DATA COLLECTION MODULE
// ================================

/**
 * Fetch complete workout history for all users
 */
async function fetchAllWorkoutHistory() {
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });
  
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  
  try {
    await ndk.connect();
    console.log(`${colors.green}✅ Connected to ${RELAYS.length} relays.${colors.reset}`);
    
    console.log(`${colors.blue}🔍 Fetching ALL workout history (no time limit)...${colors.reset}`);
    
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

/**
 * Helper function to fetch events via subscribe with timeout
 */
async function fetchWorkoutEvents(ndkInstance) {
  return new Promise((resolve) => {
    const collected = new Map();

    const sub = ndkInstance.subscribe(
      {
        kinds: [1301],
        // No since parameter - fetch everything
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

// ================================
// LEVEL CALCULATION MODULE
// ================================

/**
 * Calculate lifetime levels for all users based on complete workout history
 */
function calculateUserLevels(allEvents) {
  const userWorkouts = new Map();
  
  // Group events by user
  allEvents.forEach(event => {
    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey);
    
    if (!userWorkouts.has(npub)) {
      userWorkouts.set(npub, []);
    }
    
    userWorkouts.get(npub).push({
      timestamp: event.created_at,
      distance: extractDistance(event),
      date: formatDate(event.created_at),
      event
    });
  });
  
  // Calculate XP and levels for each user
  const userLevels = new Map();
  
  for (const [npub, workouts] of userWorkouts) {
    let totalXP = 0;
    
    // Sort workouts by date for proper progression tracking
    workouts.sort((a, b) => a.timestamp - b.timestamp);
    
    workouts.forEach(workout => {
      const xp = calculateWorkoutXP(workout.distance);
      totalXP += xp;
    });
    
    const currentLevel = calculateLevelFromXP(totalXP);
    const xpToNextLevel = getXPRequiredForLevel(currentLevel + 1) - totalXP;
    
    userLevels.set(npub, {
      npub,
      totalXP,
      currentLevel,
      xpToNextLevel,
      totalWorkouts: workouts.length,
      firstWorkout: workouts[0]?.date || 'N/A',
      lastWorkout: workouts[workouts.length - 1]?.date || 'N/A',
      workouts: workouts
    });
  }
  
  return userLevels;
}

// ================================
// WEEKLY ACTIVITY MODULE
// ================================

/**
 * Calculate weekly activity for rewards calculation
 */
function calculateWeeklyActivity(allEvents, userLevels) {
  const weekAgo = Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS;
  
  // Filter events to last 7 days
  const weeklyEvents = allEvents.filter(event => event.created_at >= weekAgo);
  
  console.log(`${colors.blue}📅 Analyzing activity for last 7 days...${colors.reset}`);
  console.log(`${colors.cyan}   Found ${weeklyEvents.length} workouts in the last week${colors.reset}`);
  
  const weeklyActivity = new Map();
  
  // Group weekly events by user
  weeklyEvents.forEach(event => {
    const pubkey = event.pubkey;
    const npub = nip19.npubEncode(pubkey);
    
    if (!weeklyActivity.has(npub)) {
      weeklyActivity.set(npub, []);
    }
    
    weeklyActivity.get(npub).push({
      timestamp: event.created_at,
      distance: extractDistance(event),
      date: formatDate(event.created_at),
      event
    });
  });
  
  // Calculate weekly stats for each active user
  const weeklyStats = new Map();
  
  for (const [npub, weeklyWorkouts] of weeklyActivity) {
    // Sort workouts by date
    weeklyWorkouts.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate consecutive days (streak)
    const uniqueDays = new Set(weeklyWorkouts.map(w => w.date));
    const streakDays = uniqueDays.size;
    
    // Get user's lifetime level
    const userLevel = userLevels.get(npub);
    
    weeklyStats.set(npub, {
      npub,
      workouts: weeklyWorkouts.length,
      streakDays,
      lifetimeLevel: userLevel?.currentLevel || 0,
      lifetimeXP: userLevel?.totalXP || 0,
      lifetimeWorkouts: userLevel?.totalWorkouts || 0,
      dates: Array.from(uniqueDays).sort(),
      weeklyWorkouts
    });
  }
  
  return {
    weeklyStats,
    weeklyEvents,
    dateRange: getDateRangeString(weekAgo)
  };
}

// ================================
// REWARDS CALCULATION MODULE
// ================================

/**
 * Calculate weekly rewards with accurate lifetime levels
 */
function calculateWeeklyRewards(weeklyActivity, userLevels) {
  const { weeklyStats, dateRange } = weeklyActivity;
  
  // Calculate rewards for each user
  const userRewards = [];
  let totalPayout = 0;
  
  for (const [npub, weeklyData] of weeklyStats) {
    const { streakDays, lifetimeLevel } = weeklyData;
    
    // Calculate base workout rewards (cumulative streak multipliers)
    let workoutSats = 0;
    for (let i = 1; i <= streakDays; i++) {
      workoutSats += REWARD_CONFIG.STREAK_MULTIPLIERS[i] || 140; // Cap at 7-day reward
    }
    
    // Calculate level bonuses
    let bonusSats = 0;
    if (lifetimeLevel >= 1) {
      bonusSats += REWARD_CONFIG.LEVEL_BONUSES[1]; // Base reward
    }
    if (lifetimeLevel >= 2) {
      bonusSats += REWARD_CONFIG.LEVEL_BONUSES[2] * streakDays; // Streak bonus
    }
    
    const totalSats = workoutSats + bonusSats;
    
    userRewards.push({
      npub,
      truncatedNpub: truncateNpub(npub),
      workouts: weeklyData.workouts,
      streakDays,
      lifetimeLevel,
      lifetimeXP: weeklyData.lifetimeXP,
      lifetimeWorkouts: weeklyData.lifetimeWorkouts,
      workoutSats,
      bonusSats,
      totalSats,
      dates: weeklyData.dates
    });
    
    totalPayout += totalSats;
  }
  
  // Sort by total sats (descending)
  userRewards.sort((a, b) => b.totalSats - a.totalSats);
  
  return {
    userRewards,
    totalUsers: userRewards.length,
    totalPayout,
    dateRange
  };
}

// ================================
// LEVEL PROGRESSION TRACKING MODULE
// ================================

/**
 * Calculate level achievements by comparing with previous data
 */
function calculateLevelAchievements(currentLevels, previousData) {
  const achievements = [];
  const currentTime = Date.now();
  
  let totalLevelsGained = 0;
  let totalXPGained = 0;
  let highestLevel = 0;
  
  for (const [npub, current] of currentLevels) {
    const previous = previousData.users?.[npub] || { level: 0, totalXP: 0 };
    
    if (current.currentLevel > previous.level) {
      const levelsGained = current.currentLevel - previous.level;
      const xpGained = current.totalXP - previous.totalXP;
      
      achievements.push({
        npub,
        truncatedNpub: truncateNpub(npub),
        previousLevel: previous.level,
        currentLevel: current.currentLevel,
        levelsGained,
        xpGained,
        totalXP: current.totalXP,
        totalWorkouts: current.totalWorkouts
      });
      
      totalLevelsGained += levelsGained;
      totalXPGained += xpGained;
    }
    
    if (current.currentLevel > highestLevel) {
      highestLevel = current.currentLevel;
    }
  }
  
  // Sort by levels gained (descending)
  achievements.sort((a, b) => b.levelsGained - a.levelsGained);
  
  return {
    achievements,
    totalLevelsGained,
    totalXPGained,
    highestLevel,
    activeUsers: currentLevels.size
  };
}

// ================================
// OUTPUT GENERATION MODULE
// ================================

/**
 * Generate comprehensive formatted output
 */
function generateComprehensiveOutput(levelData, rewardsData, achievementsData) {
  const { userLevels } = levelData;
  const { userRewards, totalUsers, totalPayout, dateRange } = rewardsData;
  const { achievements, totalLevelsGained, highestLevel } = achievementsData;
  
  console.log('\n' + '═'.repeat(100));
  console.log(`${colors.magenta}${colors.bold}🏆 RUNSTR COMPREHENSIVE REWARDS & LEVELS REPORT${colors.reset}`);
  console.log('═'.repeat(100));
  
  // Summary Statistics
  console.log(`${colors.cyan}📊 SUMMARY STATISTICS${colors.reset}`);
  console.log(`   • Total RUNSTR users (lifetime): ${userLevels.size}`);
  console.log(`   • Users active this week: ${totalUsers}`);
  console.log(`   • Users who leveled up this week: ${achievements.length}`);
  console.log(`   • Total levels gained this week: ${totalLevelsGained}`);
  console.log(`   • Highest level achieved: ${highestLevel}`);
  console.log(`   • Weekly payout period: ${dateRange}`);
  console.log(`   • Total weekly payout: ${totalPayout.toLocaleString()} sats`);
  
  // Weekly Rewards Section
  console.log('\n' + '═'.repeat(80));
  console.log(`${colors.green}${colors.bold}💰 WEEKLY REWARDS CALCULATION${colors.reset}`);
  console.log('═'.repeat(80));
  
  if (userRewards.length === 0) {
    console.log(`${colors.yellow}⚠ No users active this week${colors.reset}`);
  } else {
    // Reward breakdown table
    console.log(`\n${colors.bold}📊 REWARD BREAKDOWN:${colors.reset}`);
    console.log('-'.repeat(140));
    console.log(`${colors.bold}NPUB${' '.repeat(59)} WEEKLY  STREAK  LIFETIME LVL  WORKOUT SATS BONUS SATS  TOTAL SATS${colors.reset}`);
    console.log('-'.repeat(140));
    
    userRewards.forEach(user => {
      const npubPadded = user.truncatedNpub.padEnd(63);
      const workoutsPadded = user.workouts.toString().padStart(7);
      const streakPadded = user.streakDays.toString().padStart(6);
      const levelPadded = user.lifetimeLevel.toString().padStart(12);
      const workoutSatsPadded = user.workoutSats.toString().padStart(12);
      const bonusSatsPadded = user.bonusSats.toString().padStart(10);
      const totalSatsPadded = user.totalSats.toString().padStart(11);
      
      console.log(`${npubPadded} ${workoutsPadded} ${streakPadded} ${levelPadded} ${workoutSatsPadded} ${bonusSatsPadded} ${totalSatsPadded}`);
    });
    
    console.log('-'.repeat(140));
    console.log(`${colors.bold}TOTAL:${' '.repeat(130)} ${totalPayout.toLocaleString()}${colors.reset}`);
    
    // Payment list
    console.log(`\n${colors.bold}💰 PAYMENT LIST (copy-paste ready):${colors.reset}`);
    console.log('-'.repeat(80));
    
    userRewards.forEach(user => {
      console.log(`${user.npub}: ${user.totalSats} sats`);
    });
  }
  
  // Level Achievements Section
  console.log('\n' + '═'.repeat(80));
  console.log(`${colors.blue}${colors.bold}🎖️ WEEKLY LEVEL ACHIEVEMENTS${colors.reset}`);
  console.log('═'.repeat(80));
  
  if (achievements.length === 0) {
    console.log(`${colors.yellow}⚠ No users leveled up this week${colors.reset}`);
  } else {
    console.log(`\n${colors.bold}🏆 LEVEL UP ACHIEVEMENTS:${colors.reset}`);
    console.log('-'.repeat(80));
    
    achievements.forEach(achievement => {
      console.log(`${colors.green}🎖️ ${achievement.truncatedNpub}${colors.reset}`);
      console.log(`   Level ${achievement.previousLevel} → ${achievement.currentLevel} (+${achievement.levelsGained})`);
      console.log(`   Gained ${achievement.xpGained.toLocaleString()} XP (Total: ${achievement.totalXP.toLocaleString()} XP)`);
      console.log(`   Lifetime workouts: ${achievement.totalWorkouts}`);
      console.log('');
    });
    
    // Achievement NPUBs for copy-paste
    console.log(`${colors.bold}📋 ACHIEVEMENT NPUB LIST (copy-paste ready):${colors.reset}`);
    console.log('-'.repeat(80));
    
    achievements.forEach(achievement => {
      console.log(`${achievement.npub}: Level ${achievement.previousLevel} → ${achievement.currentLevel} (+${achievement.levelsGained})`);
    });
  }
  
  // Top Users by Level Section
  console.log('\n' + '═'.repeat(80));
  console.log(`${colors.magenta}${colors.bold}🏅 TOP USERS BY LEVEL${colors.reset}`);
  console.log('═'.repeat(80));
  
  const topUsers = Array.from(userLevels.values())
    .sort((a, b) => b.currentLevel - a.currentLevel || b.totalXP - a.totalXP)
    .slice(0, 10);
  
  console.log(`\n${colors.bold}TOP 10 USERS:${colors.reset}`);
  console.log('-'.repeat(120));
  console.log(`${colors.bold}RANK  NPUB${' '.repeat(59)} LEVEL    XP        WORKOUTS${colors.reset}`);
  console.log('-'.repeat(120));
  
  topUsers.forEach((user, index) => {
    const rank = (index + 1).toString().padStart(4);
    const npubPadded = truncateNpub(user.npub).padEnd(63);
    const levelPadded = user.currentLevel.toString().padStart(5);
    const xpPadded = user.totalXP.toLocaleString().padStart(8);
    const workoutsPadded = user.totalWorkouts.toString().padStart(8);
    
    console.log(`${rank}  ${npubPadded} ${levelPadded} ${xpPadded} ${workoutsPadded}`);
  });
  
  console.log(`\n${colors.green}✅ Comprehensive calculation complete!${colors.reset}`);
}

// ================================
// DATA PERSISTENCE MODULE
// ================================

/**
 * Load previous tracking data
 */
function loadTrackingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return data;
    }
  } catch (error) {
    console.warn(`${colors.yellow}⚠ Could not load tracking data:${colors.reset}`, error.message);
  }
  
  return { users: {}, lastUpdate: null };
}

/**
 * Save tracking data
 */
function saveTrackingData(userLevels) {
  const data = {
    users: {},
    lastUpdate: new Date().toISOString()
  };
  
  for (const [npub, levelData] of userLevels) {
    data.users[npub] = {
      level: levelData.currentLevel,
      totalXP: levelData.totalXP,
      totalWorkouts: levelData.totalWorkouts,
      firstWorkout: levelData.firstWorkout,
      lastWorkout: levelData.lastWorkout
    };
  }
  
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`${colors.blue}💾 Tracking data updated for next run${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Could not save tracking data:${colors.reset}`, error.message);
  }
  
  return data;
}

// ================================
// MAIN ORCHESTRATOR
// ================================

/**
 * Main execution function
 */
async function main() {
  console.log(`${colors.magenta}${colors.bold}🏆 RUNSTR Comprehensive Rewards & Levels Calculator${colors.reset}`);
  console.log(`${colors.cyan}Matching UI XP calculation logic exactly${colors.reset}\n`);
  
  try {
    // Phase 1: Data Collection
    console.log(`${colors.bold}Phase 1: Data Collection${colors.reset}`);
    const allEvents = await fetchAllWorkoutHistory();
    
    if (allEvents.length === 0) {
      console.log(`${colors.yellow}⚠ No RUNSTR workout events found${colors.reset}`);
      return;
    }
    
    // Phase 2: Level Calculation
    console.log(`\n${colors.bold}Phase 2: Level Calculation${colors.reset}`);
    const userLevels = calculateUserLevels(allEvents);
    console.log(`${colors.green}✅ Calculated levels for ${userLevels.size} users${colors.reset}`);
    
    // Phase 3: Weekly Activity Analysis
    console.log(`\n${colors.bold}Phase 3: Weekly Activity Analysis${colors.reset}`);
    const weeklyActivity = calculateWeeklyActivity(allEvents, userLevels);
    
    // Phase 4: Rewards Calculation
    console.log(`\n${colors.bold}Phase 4: Rewards Calculation${colors.reset}`);
    const rewardsData = calculateWeeklyRewards(weeklyActivity, userLevels);
    console.log(`${colors.green}✅ Calculated rewards for ${rewardsData.totalUsers} active users${colors.reset}`);
    
    // Phase 5: Level Achievements Tracking
    console.log(`\n${colors.bold}Phase 5: Level Achievements Tracking${colors.reset}`);
    const previousData = loadTrackingData();
    const achievementsData = calculateLevelAchievements(userLevels, previousData);
    console.log(`${colors.green}✅ Found ${achievementsData.achievements.length} level achievements${colors.reset}`);
    
    // Phase 6: Output Generation
    console.log(`\n${colors.bold}Phase 6: Output Generation${colors.reset}`);
    generateComprehensiveOutput(
      { userLevels },
      rewardsData,
      achievementsData
    );
    
    // Phase 7: Data Persistence
    console.log(`\n${colors.bold}Phase 7: Data Persistence${colors.reset}`);
    saveTrackingData(userLevels);
    
  } catch (error) {
    console.error(`${colors.red}❌ Script error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}❌ Unhandled error:${colors.reset}`, error);
  process.exit(1);
}); 