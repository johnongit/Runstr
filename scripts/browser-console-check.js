// COPY AND PASTE THIS INTO YOUR BROWSER CONSOLE
// This will show all season pass participants stored locally

console.log('🎫 Checking Season Pass Participants in Browser');
console.log('📅', new Date().toLocaleString());

// Get participants from localStorage
const participants = JSON.parse(localStorage.getItem('seasonPassParticipants') || '[]');

console.log('👥 Total participants:', participants.length);

if (participants.length === 0) {
  console.log('⚠️  No participants found in localStorage');
} else {
  console.log('\n=== ALL SEASON PASS PARTICIPANTS ===');
  
  participants
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)) // Most recent first
    .forEach((participant, i) => {
      const paymentDate = new Date(participant.paymentDate);
      const hoursAgo = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60));
      
      console.log(`${i + 1}. ${participant.pubkey}`);
      console.log(`   Payment: ${paymentDate.toLocaleString()} (${hoursAgo} hours ago)`);
      console.log('');
    });
    
  // Show most recent
  const mostRecent = participants[0];
  if (mostRecent) {
    const hoursAgo = Math.floor((Date.now() - new Date(mostRecent.paymentDate).getTime()) / (1000 * 60 * 60));
    console.log('🔥 MOST RECENT PARTICIPANT:');
    console.log(`   Pubkey: ${mostRecent.pubkey}`);
    console.log(`   Payment: ${hoursAgo} hours ago`);
  }
}

// Also check for any payment-related console logs
console.log('\n💡 Also check the Console tab for logs containing:');
console.log('- "Successfully verified payment"');
console.log('- "SeasonPassPayment"');
console.log('- Recent Lightning payment confirmations'); 