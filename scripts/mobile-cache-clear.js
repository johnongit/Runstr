/**
 * Mobile Cache Clear Commands
 * 
 * Copy these commands one by one into your mobile browser console
 * or use as debug information for the mobile app.
 */

console.log('📱 MOBILE CACHE CLEAR FOR SIMPLIFIED LEADERBOARD');
console.log('===============================================');

// Clear all old cache versions
const oldCacheKeys = [
  'runstr_league_leaderboard_run_v5',
  'runstr_league_leaderboard_run_v4', 
  'runstr_league_leaderboard_run_v3',
  'runstr_league_activity_feed_run_v2',
  'runstr_league_activity_feed_run_v1',
  'runstr_participants_cache_v3',
  'runstr_participants_cache_v2',
  'runstr_participants_cache_v1',
  'seasonPassParticipants'
];

console.log('\n🧹 Run these commands to clear old cache:');
oldCacheKeys.forEach(key => {
  console.log(`localStorage.removeItem('${key}');`);
});

console.log('\n🔄 Or clear everything:');
console.log('localStorage.clear();');

console.log('\n📊 Expected Results After Cache Clear:');
console.log('- TheWildHustle: 8.15 miles, 2 runs');
console.log('- kamoweasel: 6.70 miles, 2 runs');
console.log('- Competition: July 1-30, 2025');

console.log('\n✅ The simplified approach should work immediately!'); 