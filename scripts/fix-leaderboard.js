/**
 * League Standings Fix Instructions
 * 
 * The current League Standings shows 0.0 mi because of two critical bugs:
 * 1. Wrong competition start date (July 11 vs July 1)
 * 2. Unit conversion bug (storing km as miles)
 */

console.log('🔧 LEAGUE STANDINGS FIXES NEEDED');
console.log('================================');

console.log('\n🐛 BUG #1: Competition Start Date');
console.log('Current: Uses REWARDS.SEASON_1.startUtc = July 11, 2025');
console.log('Problem: Participants joined July 1, but events are filtered to start July 11');
console.log('Fix: Change competition start to July 1, 2025');

console.log('\n🐛 BUG #2: Unit Conversion');
console.log('Current: extractDistance() returns km but adds to totalMiles');
console.log('Problem: Storing kilometers but displaying as miles');
console.log('Fix: Convert km to miles before storing');

console.log('\n📝 EXACT CHANGES NEEDED:');
console.log('File: src/hooks/useLeagueLeaderboard.js');
console.log('');
console.log('1. Line ~42: Change competition start date:');
console.log('   FROM: const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);');
console.log('   TO:   const COMPETITION_START = Math.floor(new Date("2025-07-01T00:00:00Z").getTime() / 1000);');
console.log('');
console.log('2. Line ~127: Fix extractDistance return value:');
console.log('   FROM: return distanceInKm;');
console.log('   TO:   return distanceInKm * 0.621371; // Convert to miles');

console.log('\n🧹 STEP 1: Clear cache (run in browser console):');
console.log(`
localStorage.removeItem('runstr_league_leaderboard_run_v3');
localStorage.removeItem('runstr_league_leaderboard_walk_v3');
localStorage.removeItem('runstr_league_leaderboard_cycle_v3');
localStorage.removeItem('runstr_participants_cache_v1');
console.log('Cache cleared!');
`);

console.log('\n📊 EXPECTED RESULT AFTER FIX:');
console.log('- TheWildHustle: ~5.07 mi, 2 runs');
console.log('- kamoweasel: ~4.16 mi, 2 runs');
console.log('- Total events processed: 4 out of 5 (1 filtered for invalid distance)');

console.log('\n✅ After making these changes and clearing cache, refresh the page to see updated League Standings.'); 