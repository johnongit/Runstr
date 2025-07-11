/**
 * Mobile Leaderboard Diagnostic Script
 * 
 * Run this in mobile browser console to diagnose why League Standings shows 0.0 mi
 * Works on mobile browsers - no desktop tools needed!
 */

console.log('📱 MOBILE LEADERBOARD DIAGNOSTIC');
console.log('================================');

// Check localStorage cache
console.log('\n🔍 CACHE STATUS:');
const cacheKeys = [
  'runstr_league_leaderboard_run_v4',
  'runstr_league_leaderboard_run_v3', 
  'runstr_participants_cache_v2',
  'runstr_participants_cache_v1',
  'seasonPassParticipants'
];

cacheKeys.forEach(key => {
  const data = localStorage.getItem(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.data) {
        console.log(`✅ ${key}: ${parsed.data.length} items, age: ${Math.round((Date.now() - parsed.timestamp) / 60000)}min`);
      } else {
        console.log(`✅ ${key}: direct data, ${parsed.length || 'unknown'} items`);
      }
    } catch (e) {
      console.log(`❌ ${key}: parse error`);
    }
  } else {
    console.log(`⚪ ${key}: not found`);
  }
});

// Check if we're looking at the right dates
console.log('\n📅 DATE CHECK:');
console.log('July 1, 2025 timestamp:', Math.floor(new Date('2025-07-01T00:00:00Z').getTime() / 1000));
console.log('July 11, 2025 timestamp:', Math.floor(new Date('2025-07-11T00:00:00Z').getTime() / 1000));
console.log('Current timestamp:', Math.floor(Date.now() / 1000));

// Simple mobile-friendly refresh commands
console.log('\n🔄 MOBILE REFRESH COMMANDS:');
console.log('Copy and run these one by one:');
console.log('');
console.log('// Clear all cache:');
console.log('localStorage.clear(); console.log("All cache cleared!");');
console.log('');
console.log('// Clear just leaderboard cache:');
cacheKeys.forEach(key => {
  console.log(`localStorage.removeItem('${key}');`);
});
console.log('console.log("Leaderboard cache cleared!");');

console.log('\n✅ Diagnostic complete! After clearing cache, refresh the page.'); 