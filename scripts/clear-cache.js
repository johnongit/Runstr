/**
 * Cache Clearing Commands for League Standings
 * 
 * Copy and paste these commands into your browser console
 * to clear the cached data that might be showing 0 values.
 */

console.log('🧹 CLEARING LEAGUE STANDINGS CACHE');
console.log('=================================');

// Clear all leaderboard cache
const cacheKeys = [
  'runstr_league_leaderboard_run_v3',
  'runstr_league_leaderboard_walk_v3', 
  'runstr_league_leaderboard_cycle_v3',
  'runstr_participants_cache_v1'
];

cacheKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log('✅ Cleared:', key);
});

console.log('\n🔄 Cache cleared! Refresh the page to see updated data.');
console.log('Note: The leaderboard should now fetch fresh data from relays.'); 