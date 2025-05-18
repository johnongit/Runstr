#!/usr/bin/env node

/**
 * Nostr Feed Diagnostic Script
 * This script tests each stage of the post processing pipeline
 * to find where posts might be getting lost.
 */

import { fetchRunningPosts, loadSupplementaryData, processPostsWithData } from '../src/utils/nostr.js';
import { awaitNDKReady } from '../src/lib/ndkSingleton.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Diagnostic function
async function diagnoseFeed() {
  console.log(`${colors.magenta}${colors.bold}===== RUNSTR FEED RENDERING DIAGNOSTIC TOOL =====${colors.reset}\n`);
  
  // Step 1: Test NDK connectivity
  console.log(`${colors.blue}[1/5] Testing Nostr connectivity...${colors.reset}`);
  try {
    const connected = await awaitNDKReady();
    
    if (connected) {
      console.log(`${colors.green}✓ Successfully connected to Nostr network${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to connect to Nostr network${colors.reset}`);
      return;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to connect to Nostr: ${error.message}${colors.reset}`);
    return;
  }
  
  // Step 2: Test fetching raw posts with running hashtags
  console.log(`\n${colors.blue}[2/5] Testing raw post fetching with running hashtags...${colors.reset}`);
  
  // Forcing a known post for metadata diagnosis, as app is fetching posts but metadata is missing.
  const rawPosts = [
    {
      id: 'known_post_id_1',
      pubkey: 'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52', // daplums (known active user)
      created_at: Math.floor(Date.now() / 1000) - 3600,
      kind: 1,
      tags: [['t', 'runstr']],
      content: 'Test post from a known user for metadata diagnosis. #runstr',
    },
    {
      id: 'known_post_id_2',
      pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', // jb55 (known active user)
      created_at: Math.floor(Date.now() / 1000) - 7200,
      kind: 1,
      tags: [['t', 'runstr']],
      content: 'Another test post for metadata. #runstr',
    }
  ];
  console.log(`${colors.green}✓ Using ${rawPosts.length} hardcoded sample posts for metadata diagnosis.${colors.reset}`);
  rawPosts.forEach(post => {
    console.log(`${colors.cyan}  Sample Post ID: ${post.id}, Author Pubkey: ${post.pubkey.substring(0,10)}...${colors.reset}`);
  });
  
  // Step 3: Test loading supplementary data (profiles, reactions)
  console.log(`\n${colors.blue}[3/5] Testing supplementary data loading...${colors.reset}`);
  let supplementaryData = {};
  
  try {
    if (rawPosts.length > 0) {
      console.log(`${colors.cyan}Loading supplementary data for ${rawPosts.length} posts...${colors.reset}`);
      supplementaryData = await loadSupplementaryData(rawPosts);
      
      // Log what we found
      const profilesCount = supplementaryData.profileEvents ? supplementaryData.profileEvents.size : 0;
      const likesCount = supplementaryData.likes ? supplementaryData.likes.size : 0;
      const repostsCount = supplementaryData.reposts ? supplementaryData.reposts.size : 0;
      
      console.log(`${colors.green}✓ Loaded supplementary data:${colors.reset}`);
      console.log(`  - ${profilesCount} profiles`);
      console.log(`  - ${likesCount} likes`);
      console.log(`  - ${repostsCount} reposts`);
      
      if (profilesCount === 0) {
        console.log(`${colors.yellow}⚠ No profiles found! This may cause rendering issues.${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}⚠ No posts to load supplementary data for${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to load supplementary data: ${error.message}${colors.reset}`);
  }
  
  // Step 4: Test post processing
  console.log(`\n${colors.blue}[4/5] Testing post processing...${colors.reset}`);
  let processedPosts = [];
  
  try {
    if (rawPosts.length > 0 && supplementaryData) {
      console.log(`${colors.cyan}Processing ${rawPosts.length} posts with supplementary data...${colors.reset}`);
      
      processedPosts = await processPostsWithData(rawPosts, supplementaryData);
      
      console.log(`${colors.green}✓ Successfully processed ${processedPosts.length} posts${colors.reset}`);
      
      if (processedPosts.length < rawPosts.length) {
        console.log(`${colors.yellow}⚠ ${rawPosts.length - processedPosts.length} posts were filtered out during processing!${colors.reset}`);
      }
      
      // Show a sample of a processed post
      if (processedPosts.length > 0) {
        console.log(`${colors.cyan}Sample processed post:${colors.reset}`);
        const samplePost = processedPosts[0];
        console.log(`  ID: ${samplePost.id?.substring(0, 8)}...`);
        console.log(`  Author: ${samplePost.author?.name || 'Unknown'} (${samplePost.author?.pubkey?.substring(0, 8)}...)`);
        console.log(`  Has profile picture: ${samplePost.author?.picture ? 'Yes' : 'No'}`);
        console.log(`  Stats: ${samplePost.stats?.likes || 0} likes, ${samplePost.stats?.reposts || 0} reposts`);
      }
    } else {
      console.log(`${colors.yellow}⚠ No posts/supplementary data to process${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to process posts: ${error.message}${colors.reset}`);
  }
  
  // Step 5: Check for rendering issues
  console.log(`\n${colors.blue}[5/5] Checking for potential rendering issues...${colors.reset}`);
  
  if (processedPosts.length === 0) {
    console.log(`${colors.red}✗ No processed posts to render${colors.reset}`);
  } else {
    // Check for common rendering issues
    const issues = [];
    
    // Check for missing critical properties
    const missingProps = processedPosts.filter(p => !p.id || !p.content || !p.author);
    if (missingProps.length > 0) {
      issues.push(`${missingProps.length} posts are missing critical properties`);
    }
    
    // Check for empty content
    const emptyContent = processedPosts.filter(p => !p.content || p.content.trim() === '');
    if (emptyContent.length > 0) {
      issues.push(`${emptyContent.length} posts have empty content`);
    }
    
    // Check for missing author info
    const missingAuthor = processedPosts.filter(p => 
      !p.author || !p.author.name || !p.author.pubkey
    );
    if (missingAuthor.length > 0) {
      issues.push(`${missingAuthor.length} posts have incomplete author information`);
    }
    
    // Check for missing profile pictures
    const missingPictures = processedPosts.filter(p => !p.author?.picture);
    if (missingPictures.length > 0) {
      issues.push(`${missingPictures.length} posts have authors without profile pictures`);
    }
    
    // Report findings
    if (issues.length > 0) {
      console.log(`${colors.yellow}⚠ Found ${issues.length} potential rendering issues:${colors.reset}`);
      issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    } else {
      console.log(`${colors.green}✓ No obvious rendering issues detected${colors.reset}`);
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}${colors.bold}===== DIAGNOSTIC SUMMARY =====${colors.reset}`);
  console.log(`${colors.cyan}Raw posts found: ${rawPosts.length}${colors.reset}`);
  console.log(`${colors.cyan}Profiles loaded: ${supplementaryData.profileEvents ? supplementaryData.profileEvents.size : 0}${colors.reset}`);
  console.log(`${colors.cyan}Processed posts: ${processedPosts.length}${colors.reset}`);
  
  // Diagnosis
  if (rawPosts.length > 0 && processedPosts.length === 0) {
    console.log(`\n${colors.red}${colors.bold}CRITICAL ISSUE: Posts are found but fail during processing${colors.reset}`);
    console.log(`${colors.yellow}This confirms your issue is in the post processing pipeline${colors.reset}`);
    console.log(`Check processPostsWithData() in src/utils/nostr.js for errors`);
  } else if (rawPosts.length > 0 && processedPosts.length > 0) {
    if (processedPosts.length < rawPosts.length) {
      console.log(`\n${colors.yellow}${colors.bold}POTENTIAL ISSUE: Some posts are filtered out during processing${colors.reset}`);
      console.log(`${colors.yellow}This could be intentional filtering or a bug in the processing code${colors.reset}`);
    }
    console.log(`\n${colors.yellow}${colors.bold}LIKELY ISSUE: Posts are processed correctly but fail during rendering${colors.reset}`);
    console.log(`${colors.yellow}Check your React components, especially Post.jsx and conditional rendering${colors.reset}`);
  } else if (rawPosts.length === 0) {
    console.log(`\n${colors.red}${colors.bold}RELAY ISSUE: No posts found from relays${colors.reset}`);
    console.log(`${colors.yellow}Check your relay connections and hashtag filters${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Recommended next steps:${colors.reset}`);
  console.log(`1. Add a counter to PostList.jsx: <div>Rendering {posts.length} posts</div>`);
  console.log(`2. Add logging in RunClub.jsx to trace the post state changes`);
  console.log(`3. Manually check each condition in the rendering logic of RunClub.jsx`);
  console.log(`4. Check Post.jsx for any conditional rendering that might be filtering posts`);
}

// Run the diagnostic
try {
  diagnoseFeed().catch(error => {
    console.error(`${colors.red}Diagnostic error:${colors.reset}`, error);
  });
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
} 