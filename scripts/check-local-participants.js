#!/usr/bin/env node

/**
 * Check Local Season Pass Participants
 * This checks the localStorage and service data to see who has paid
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🎫 Local Season Pass Participants Checker');
console.log('📅', new Date().toLocaleString());
console.log('');

// Check for any local storage files or service data
const possibleFiles = [
  'season-pass-participants.json',
  'participants.json',
  'season-pass.json'
];

console.log('🔍 Checking for local participant files...');

for (const filename of possibleFiles) {
  const filepath = join(process.cwd(), filename);
  if (existsSync(filepath)) {
    console.log(`✅ Found: ${filename}`);
    try {
      const content = readFileSync(filepath, 'utf8');
      const data = JSON.parse(content);
      console.log('   Content:', data);
    } catch (error) {
      console.log(`   Error reading: ${error.message}`);
    }
  } else {
    console.log(`❌ Not found: ${filename}`);
  }
}

// Check the seasonPassService.ts file for default participants
console.log('\n🔍 Checking seasonPassService.ts for current participants...');

try {
  const serviceFile = readFileSync('src/services/seasonPassService.ts', 'utf8');
  
  // Look for DEFAULT_PARTICIPANTS
  const defaultParticipantsMatch = serviceFile.match(/DEFAULT_PARTICIPANTS\s*=\s*\[([\s\S]*?)\]/);
  if (defaultParticipantsMatch) {
    console.log('✅ Found DEFAULT_PARTICIPANTS in seasonPassService.ts:');
    console.log(defaultParticipantsMatch[0]);
  }
  
  // Look for any hardcoded pubkeys
  const pubkeyMatches = serviceFile.match(/['""][0-9a-f]{64}['"]/g);
  if (pubkeyMatches) {
    console.log('\n🔑 Found pubkeys in the service:');
    pubkeyMatches.forEach((pubkey, i) => {
      console.log(`${i + 1}. ${pubkey}`);
    });
  }
  
} catch (error) {
  console.log(`❌ Error reading seasonPassService.ts: ${error.message}`);
}

// Check payment service logs in console
console.log('\n💡 To find recent payments, check:');
console.log('1. Browser console logs for: "Successfully verified payment"');
console.log('2. Network tab for recent Lightning payments');
console.log('3. LocalStorage in browser dev tools for "season-pass" keys');
console.log('');
console.log('Or run your app and check console for recent payment verification logs.');

console.log('\n✅ Local check complete'); 