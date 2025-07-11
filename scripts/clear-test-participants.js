#!/usr/bin/env node

/**
 * Clear Test Participants Script
 * 
 * This script clears the test participants from the Season Pass participant list.
 * Run this to remove the hardcoded test npubs now that we have proper payment verification.
 */

console.log('🧹 Clearing test participants from Season Pass...');

// Clear the localStorage key that stores season pass participants
if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('seasonPassParticipants');
  console.log('✅ Test participants cleared from localStorage');
} else {
  console.log('ℹ️  localStorage not available in Node.js environment');
  console.log('ℹ️  To clear test participants:');
  console.log('   1. Open browser dev tools');
  console.log('   2. Go to Console tab');
  console.log('   3. Run: localStorage.removeItem("seasonPassParticipants")');
  console.log('   4. Refresh the app');
}

console.log('');
console.log('📝 Summary of changes:');
console.log('  • Test npubs removed from participant list');
console.log('  • Payment verification now required for Season Pass');
console.log('  • Users must pay Lightning invoice to be added to leaderboard');
console.log('');
console.log('🎯 Next steps:');
console.log('  1. Clear test participants using browser console (see above)');
console.log('  2. Test the payment flow with real Lightning invoices');
console.log('  3. Verify users are added to leaderboard after payment');
console.log('  4. Monitor payment verification logs for any issues'); 