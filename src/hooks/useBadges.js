import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Hook: useBadges (NIP-58 Compliant)
 * Fetches RUNSTR badge data following NIP-58 standard:
 * - Displays badges from user's Profile Badges event (kind 30008)
 * - Detects unclaimed badge awards (kind 8) for notifications
 * - Provides claiming functionality
 */
export const useBadges = () => {
  const { publicKey: userPubkey, ndk, canReadData } = useContext(NostrContext);
  const [badges, setBadges] = useState({
    levelBadges: {}, // { 1: badgeData, 5: badgeData, etc. } - CLAIMED badges
    awards: [] // Array of special badge objects - CLAIMED badges
  });
  const [unclaimedBadges, setUnclaimedBadges] = useState({
    levelBadges: {},
    awards: []
  });
  const [isLoading, setIsLoading] = useState(true); // Start with loading true for initial render
  const [error, setError] = useState(null);

  // Parse NIP-58 Profile Badges event (kind 30008) - these are CLAIMED badges
  const parseProfileBadgesEvent = useCallback((event) => {
    const levelBadges = {};
    const awards = [];

    try {
      // Profile Badges event contains ordered pairs of 'a' and 'e' tags
      const tags = event.tags || [];
      
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const nextTag = tags[i + 1];
        
        // Look for consecutive 'a' (badge definition) and 'e' (badge award) tag pairs
        if (tag[0] === 'a' && nextTag && nextTag[0] === 'e') {
          const badgeDefinitionRef = tag[1]; // e.g., "30009:issuer_pubkey:badge_id"
          const badgeAwardEventId = nextTag[1];
          
          // Extract badge identifier from the 'a' tag
          const parts = badgeDefinitionRef.split(':');
          if (parts.length >= 3) {
            const badgeId = parts[2]; // e.g., "level_5" or "league_winner"
            
            // Check if this is a level badge
            const levelMatch = badgeId.match(/level[_-]?(\d+)/i);
            let badgeType = 'award';
            let levelNumber = null;
            
            if (levelMatch) {
              badgeType = 'level';
              levelNumber = parseInt(levelMatch[1]);
            }

            const badgeData = {
              id: badgeAwardEventId,
              name: badgeId.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              type: badgeType,
              levelNumber: levelNumber,
              badgeDefinitionRef: badgeDefinitionRef,
              timestamp: event.created_at,
              claimed: true
            };

            if (badgeType === 'level' && levelNumber >= 1 && levelNumber <= 21) {
              levelBadges[levelNumber] = badgeData;
            } else {
              awards.push(badgeData);
            }
          }
          
          i++; // Skip the next tag since we processed it as a pair
        }
      }
    } catch (err) {
      console.warn('useBadges: Error parsing Profile Badges event:', err);
    }

    return { levelBadges, awards };
  }, []);

  // Parse Badge Award events (kind 8) to find unclaimed badges
  const parseBadgeAwardEvents = useCallback((events, claimedBadges) => {
    const unclaimedLevelBadges = {};
    const unclaimedAwards = [];

    events.forEach(event => {
      try {
        // Check if this award is already claimed
        const isAlreadyClaimed = claimedBadges.some(claimed => 
          claimed.id === event.id
        );

        if (isAlreadyClaimed) return;

        // Extract badge definition reference from 'a' tag
        const aTag = event.tags?.find(t => t[0] === 'a');
        if (!aTag || !aTag[1]) return;

        const badgeDefinitionRef = aTag[1];
        const parts = badgeDefinitionRef.split(':');
        if (parts.length < 3) return;

        const badgeId = parts[2];
        
        // Check if this is a level badge
        const levelMatch = badgeId.match(/level[_-]?(\d+)/i);
        let badgeType = 'award';
        let levelNumber = null;
        
        if (levelMatch) {
          badgeType = 'level';
          levelNumber = parseInt(levelMatch[1]);
        }

        const badgeData = {
          id: event.id,
          name: badgeId.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: badgeType,
          levelNumber: levelNumber,
          badgeDefinitionRef: badgeDefinitionRef,
          timestamp: event.created_at,
          claimed: false
        };

        if (badgeType === 'level' && levelNumber >= 1 && levelNumber <= 21) {
          unclaimedLevelBadges[levelNumber] = badgeData;
        } else {
          unclaimedAwards.push(badgeData);
        }
      } catch (err) {
        console.warn('useBadges: Error parsing Badge Award event:', err, event);
      }
    });

    return { levelBadges: unclaimedLevelBadges, awards: unclaimedAwards };
  }, []);

  // Claim badges by publishing Profile Badges event
  const claimBadges = useCallback(async (badgesToClaim) => {
    if (!userPubkey || !ndk) {
      throw new Error('User not authenticated');
    }

    try {
      // Get current claimed badges
      const currentClaimed = [...Object.values(badges.levelBadges), ...badges.awards];
      const allBadges = [...currentClaimed, ...badgesToClaim];

      // Build tags for Profile Badges event (kind 30008)
      const tags = [
        ['d', 'profile_badges']
      ];

      // Add ordered pairs of 'a' and 'e' tags for each badge
      allBadges.forEach(badge => {
        tags.push(['a', badge.badgeDefinitionRef]);
        tags.push(['e', badge.id]);
      });

      // Create and publish Profile Badges event
      const event = {
        kind: 30008,
        tags: tags,
        content: '',
        created_at: Math.floor(Date.now() / 1000)
      };

      // Use NDK to publish the event
      const ndkEvent = new NDKEvent(ndk, event);
      await ndkEvent.publish();

      // Wait a moment for event to propagate, then reload will happen automatically
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (err) {
      console.error('Error claiming badges:', err);
      throw err;
    }
  }, [userPubkey, ndk, badges]);

  // Load badge events from Nostr
  const loadBadges = useCallback(async () => {
    // Always set proper loading state first
    setIsLoading(true);
    setError(null);

    // If no user is authenticated, show empty badge grid (for guest users)
    if (!userPubkey) {
      setBadges({ levelBadges: {}, awards: [] });
      setUnclaimedBadges({ levelBadges: {}, awards: [] });
      setIsLoading(false);
      return;
    }

    // Check if we can read data from Nostr (NDK ready)
    if (!canReadData || !ndk) {
      console.warn('useBadges: NDK not ready, will show empty badges');
      setBadges({ levelBadges: {}, awards: [] });
      setUnclaimedBadges({ levelBadges: {}, awards: [] });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch user's Profile Badges event (kind 30008) - CLAIMED badges
      const profileBadgesEvents = await fetchEvents({
        kinds: [30008],
        authors: [userPubkey],
        '#d': ['profile_badges'],
        limit: 1
      });

      let claimedBadges = { levelBadges: {}, awards: [] };
      if (profileBadgesEvents.size > 0) {
        const profileBadgesEvent = Array.from(profileBadgesEvents)[0];
        const event = profileBadgesEvent.rawEvent ? profileBadgesEvent.rawEvent() : profileBadgesEvent;
        claimedBadges = parseProfileBadgesEvent(event);
      }

      // 2. Fetch Badge Award events (kind 8) mentioning this user - ALL awards
      const badgeAwardEvents = await fetchEvents({
        kinds: [8],
        '#p': [userPubkey],
        limit: 100
      });

      const awardEventsArray = Array.from(badgeAwardEvents).map(e => 
        e.rawEvent ? e.rawEvent() : e
      );

      // 3. Determine unclaimed badges
      const allClaimedBadges = [...Object.values(claimedBadges.levelBadges), ...claimedBadges.awards];
      const unclaimed = parseBadgeAwardEvents(awardEventsArray, allClaimedBadges);

      setBadges(claimedBadges);
      setUnclaimedBadges(unclaimed);
    } catch (err) {
      console.error('useBadges fetch error:', err);
      setError(err.message || 'Failed to fetch badges');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, ndk, canReadData, parseProfileBadgesEvent, parseBadgeAwardEvents]);

  // Auto-reload badges periodically to catch new awards
  useEffect(() => {
    loadBadges();
    
    // Set up periodic reload to catch new badge awards
    const interval = setInterval(loadBadges, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [loadBadges]);

  return { 
    badges, 
    unclaimedBadges,
    isLoading, 
    error, 
    reload: loadBadges,
    claimBadges,
    hasUnclaimedBadges: Object.keys(unclaimedBadges.levelBadges).length > 0 || unclaimedBadges.awards.length > 0
  };
}; 