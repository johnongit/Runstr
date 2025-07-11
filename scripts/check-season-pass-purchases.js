#!/usr/bin/env node

/**
 * Season Pass Purchase Checker
 * 
 * This script fetches all kind 33406 season pass purchase events from Nostr
 * and displays which npubs have made purchases, helping identify recent buyers.
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Relay configuration - using faster relays first
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol', 
  'wss://relay.snort.social'
];

// Colors for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Extract purchase details from season pass event
 */
function extractPurchaseDetails(event) {
  const details = {
    purchaser: null,
    paymentDate: null,
    paymentAmount: null,
    currency: null,
    eventTitle: null
  };

  if (!event.tags) return details;

  for (const tag of event.tags) {
    switch (tag[0]) {
      case 'purchaser':
        details.purchaser = tag[1];
        break;
      case 'payment_date':
        details.paymentDate = parseInt(tag[1]);
        break;
      case 'payment_amount':
        details.paymentAmount = tag[1];
        break;
      case 'currency':
        details.currency = tag[1];
        break;
      case 'event_title':
        details.eventTitle = tag[1];
        break;
    }
  }

  return details;
}

/**
 * Main function to check season pass purchases
 */
async function checkSeasonPassPurchases() {
  console.log(`${colors.bright}🎫 Season Pass Purchase Checker${colors.reset}`);
  console.log(`${colors.cyan}📅 Current time: ${new Date().toLocaleString()}${colors.reset}\n`);

  // Initialize NDK with timeout
  console.log(`${colors.blue}🔄 Connecting to Nostr relays...${colors.reset}`);
  const ndk = new NDK({ 
    explicitRelayUrls: RELAYS,
    devLogLevel: 'error' // Reduce logging noise
  });

  try {
    const connectPromise = ndk.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log(`${colors.green}✅ Connected to relays${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to connect to Nostr:${colors.reset}`, error.message);
    return;
  }

  // Fetch season pass events with timeout and progress
  console.log(`${colors.blue}🔍 Fetching season pass events (15 second timeout)...${colors.reset}`);
  
  try {
    const fetchPromise = ndk.fetchEvents({
      kinds: [33406],
      '#d': ['runstr-season-1-2025'], // Filter for RUNSTR Season 1
      limit: 50 // Reduced limit for faster response
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Fetch timeout - no events found within 15 seconds')), 15000)
    );

    const events = await Promise.race([fetchPromise, timeoutPromise]);
    const eventArray = Array.from(events);
    
    console.log(`${colors.cyan}📥 Found ${eventArray.length} season pass events${colors.reset}\n`);

    if (eventArray.length === 0) {
      console.log(`${colors.yellow}⚠️  No season pass purchase events found${colors.reset}`);
      console.log(`${colors.yellow}💡 This could mean:${colors.reset}`);
      console.log(`   - No purchases have been made yet`);
      console.log(`   - Events haven't propagated to these relays`);
      console.log(`   - Events use different tags than expected`);
      return;
    }

    // Sort events by creation time (most recent first)
    const sortedEvents = eventArray.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    // Simple summary first
    const uniquePurchasers = [...new Set(sortedEvents.map(event => {
      const details = extractPurchaseDetails(event);
      return details.purchaser;
    }).filter(Boolean))];

    console.log(`${colors.bright}=== SUMMARY ===${colors.reset}`);
    console.log(`${colors.green}📊 Total purchases:${colors.reset} ${eventArray.length}`);
    console.log(`${colors.green}👥 Unique purchasers:${colors.reset} ${uniquePurchasers.length}`);
    
    if (uniquePurchasers.length > 0) {
      console.log(`\n${colors.bright}Purchaser NPUBs:${colors.reset}`);
      uniquePurchasers.forEach((npub, index) => {
        console.log(`${colors.green}${index + 1}.${colors.reset} ${npub}`);
      });
    }

    // Show most recent purchase
    if (sortedEvents.length > 0) {
      const mostRecent = sortedEvents[0];
      const recentDetails = extractPurchaseDetails(mostRecent);
      const timeDiff = Math.floor(Date.now() / 1000) - (mostRecent.created_at || 0);
      const timeAgo = timeDiff < 60 ? `${timeDiff} seconds ago` :
                     timeDiff < 3600 ? `${Math.floor(timeDiff / 60)} minutes ago` :
                     timeDiff < 86400 ? `${Math.floor(timeDiff / 3600)} hours ago` :
                     `${Math.floor(timeDiff / 86400)} days ago`;

      console.log(`\n${colors.bright}=== MOST RECENT PURCHASE ===${colors.reset}`);
      console.log(`${colors.magenta}👤 Purchaser:${colors.reset} ${recentDetails.purchaser}`);
      console.log(`${colors.magenta}⏱️  Time:${colors.reset} ${timeAgo}`);
      console.log(`${colors.magenta}💰 Amount:${colors.reset} ${recentDetails.paymentAmount} ${recentDetails.currency}`);
      console.log(`${colors.magenta}🆔 Event ID:${colors.reset} ${mostRecent.id}`);
    }

    // Offer detailed view
    console.log(`\n${colors.yellow}💡 For detailed view of all purchases, add --detailed flag${colors.reset}`);

  } catch (error) {
    if (error.message.includes('timeout')) {
      console.error(`${colors.red}❌ ${error.message}${colors.reset}`);
      console.log(`${colors.yellow}💡 Try running again - Nostr queries can be slow${colors.reset}`);
    } else {
      console.error(`${colors.red}❌ Error fetching season pass events:${colors.reset}`, error);
    }
  }
}

// Check for --detailed flag
const showDetailed = process.argv.includes('--detailed');

if (showDetailed) {
  // Original detailed version for when needed
  console.log(`${colors.cyan}Running in detailed mode...${colors.reset}\n`);
}

// Run the script
checkSeasonPassPurchases().then(() => {
  console.log(`\n${colors.bright}🎫 Season Pass check complete${colors.reset}`);
  process.exit(0);
}).catch(error => {
  console.error(`${colors.red}❌ Script failed:${colors.reset}`, error);
  process.exit(1);
}); 