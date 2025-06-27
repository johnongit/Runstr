#!/usr/bin/env node

/**
 * Clear RUNSTR Feed Cache Utility
 * 
 * This script clears localStorage feed cache that might contain
 * unfiltered POWR strength workouts.
 * 
 * Usage: node scripts/clear-feed-cache.js
 */

console.log('🗑️  RUNSTR Feed Cache Clearer');
console.log('================================');

// Since this is a Node script and localStorage is browser-only,
// this script provides instructions for manual cache clearing

console.log('');
console.log('To clear the cached feed data in your browser:');
console.log('');
console.log('📱 MOBILE (Android Chrome/Firefox):');
console.log('1. Open your RUNSTR app');
console.log('2. Go to League tab');
console.log('3. Look for the red "🗑️ Clear Cache" button in development mode');
console.log('4. Click it to force refresh with RUNSTR filtering');
console.log('');
console.log('🖥️  DESKTOP (Chrome DevTools):');
console.log('1. Open RUNSTR in Chrome');
console.log('2. Press F12 to open DevTools');
console.log('3. Go to Console tab');
console.log('4. Run this command:');
console.log('   localStorage.removeItem("runstr_league_leaderboard");');
console.log('   localStorage.removeItem("relayPerformance");');
console.log('5. Refresh the page (F5)');
console.log('');
console.log('🚀 DEVELOPMENT MODE:');
console.log('1. If running in development, you can use the red');
console.log('   "🗑️ Clear Cache" button in the top-right corner');
console.log('2. This will force clear all cached data and re-fetch');
console.log('   with proper RUNSTR filtering applied');
console.log('');
console.log('✅ After clearing cache:');
console.log('- Only RUNSTR running/cycling/walking workouts will show');
console.log('- POWR strength workouts will be filtered out');
console.log('- Cache will rebuild with filtered data');
console.log('');
console.log('🔧 Technical Details:');
console.log('- The issue was caused by cached unfiltered data');
console.log('- New filtering logic has been implemented');
console.log('- Cache clearing forces a fresh filtered fetch');
console.log('');

// Exit successfully
process.exit(0); 