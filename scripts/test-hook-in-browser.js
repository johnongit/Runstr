/**
 * Browser Console Test for useLeagueLeaderboard Hook
 * 
 * Copy and paste this into the browser console while on the RUNSTR app
 * to see exactly what the useLeagueLeaderboard hook is returning.
 */

console.log('🔍 Testing useLeagueLeaderboard Hook State');
console.log('==========================================');

// Check if we're in React DevTools context
if (typeof React !== 'undefined') {
  console.log('✅ React is available');
} else {
  console.log('❌ React not found - make sure you\'re on the RUNSTR app page');
}

// Test localStorage cache
console.log('\n📦 CHECKING CACHE');
console.log('================');

const cacheKeys = [
  'runstr_league_leaderboard_run_v3',
  'runstr_league_leaderboard_walk_v3', 
  'runstr_league_leaderboard_cycle_v3',
  'runstr_participants_cache_v1'
];

cacheKeys.forEach(key => {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      console.log(`✅ ${key}:`, {
        timestamp: new Date(parsed.timestamp).toISOString(),
        dataLength: parsed.data?.length || 0,
        sampleData: parsed.data?.slice(0, 2)
      });
    } catch (e) {
      console.log(`❌ ${key}: Parse error`, e);
    }
  } else {
    console.log(`⚪ ${key}: No cache`);
  }
});

// Test seasonPassService
console.log('\n👥 CHECKING SEASON PASS SERVICE');
console.log('===============================');

// This won't work directly in console since it's a module, but we can check localStorage
const seasonPassData = localStorage.getItem('seasonPassParticipants');
if (seasonPassData) {
  try {
    const participants = JSON.parse(seasonPassData);
    console.log('✅ Season pass participants:', participants);
  } catch (e) {
    console.log('❌ Season pass parse error:', e);
  }
} else {
  console.log('⚪ No season pass data in localStorage');
}

// Check for any React component state (requires React DevTools)
console.log('\n🔍 MANUAL CHECKS TO PERFORM');
console.log('==========================');
console.log('1. Check React DevTools for LeagueMap component state');
console.log('2. Look at useLeagueLeaderboard hook state in DevTools');
console.log('3. Check Network tab for fetch requests to relays');
console.log('4. Check Console for any error messages');
console.log('5. Verify the leaderboard array in component state');

// Instructions for manual inspection
console.log('\n📝 INSPECTION STEPS');
console.log('==================');
console.log('1. Open React DevTools');
console.log('2. Find the LeagueMap component');
console.log('3. Look at its hooks state');
console.log('4. Check the leaderboard array contents');
console.log('5. Verify isLoading and error states');

console.log('\n🔍 Test complete! Check the logs above and follow manual steps.'); 