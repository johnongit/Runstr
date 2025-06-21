import { useState, useEffect, useCallback } from 'react';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useLeagueLeaderboard
 * Fetches top 10 users' 1301 workout data, calculates their progress toward 1000 miles,
 * gets their display names from Nostr profiles, and returns top 10 leaderboard
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh }
 */
export const useLeagueLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const COURSE_TOTAL_MILES = 1000;

  const calculateUserDistance = useCallback((events) => {
    let totalMiles = 0;
    let runCount = 0;

    events.forEach(event => {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      
      if (distanceTag && distanceTag[1]) {
        const distanceValue = parseFloat(distanceTag[1]);
        const unit = distanceTag[2] || 'km';
        
        if (!isNaN(distanceValue) && distanceValue > 0) {
          const distanceInMiles = unit === 'km' ? (distanceValue * 0.621371) : distanceValue;
          totalMiles += distanceInMiles;
          runCount++;
        }
      }
    });

    return {
      totalMiles: Math.round(totalMiles * 100) / 100,
      runCount,
      percentComplete: Math.min(100, (totalMiles / COURSE_TOTAL_MILES) * 100)
    };
  }, []);

  const fetchUserProfile = useCallback(async (pubkey) => {
    try {
      const profileEvents = await fetchEvents({ 
        kinds: [0], 
        authors: [pubkey], 
        limit: 1 
      });
      
      if (profileEvents.size > 0) {
        const profileEvent = Array.from(profileEvents)[0];
        const rawEvent = profileEvent.rawEvent ? profileEvent.rawEvent() : profileEvent;
        
        if (rawEvent.content) {
          try {
            const profileData = JSON.parse(rawEvent.content);
            return {
              displayName: profileData.display_name || profileData.name || null,
              name: profileData.name || null,
              picture: profileData.picture || null
            };
          } catch (e) {
            console.warn(`Failed to parse profile for ${pubkey}:`, e);
          }
        }
      }
      
      return { displayName: null, name: null, picture: null };
    } catch (error) {
      console.warn(`Failed to fetch profile for ${pubkey}:`, error);
      return { displayName: null, name: null, picture: null };
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useLeagueLeaderboard] Fetching 1301 events for leaderboard...');
      
      const eventSet = await fetchEvents({ 
        kinds: [1301], 
        limit: 2000 
      });
      
      const events = Array.from(eventSet).map(e => e.rawEvent ? e.rawEvent() : e);
      console.log(`[useLeagueLeaderboard] Found ${events.length} total 1301 events`);

      const userEventGroups = {};
      events.forEach(event => {
        if (event.pubkey) {
          if (!userEventGroups[event.pubkey]) {
            userEventGroups[event.pubkey] = [];
          }
          userEventGroups[event.pubkey].push(event);
        }
      });

      const userDistances = Object.entries(userEventGroups).map(([pubkey, userEvents]) => {
        const { totalMiles, runCount, percentComplete } = calculateUserDistance(userEvents);
        const latestRun = Math.max(...userEvents.map(e => e.created_at || 0));
        
        return {
          pubkey,
          totalMiles,
          runCount,
          percentComplete,
          latestRun
        };
      });

      const topUsers = userDistances
        .filter(user => user.totalMiles > 0)
        .sort((a, b) => b.totalMiles - a.totalMiles)
        .slice(0, 10);

      const usersWithProfiles = await Promise.all(
        topUsers.map(async (user, index) => {
          const profile = await fetchUserProfile(user.pubkey);
          return {
            ...user,
            rank: index + 1,
            displayName: profile.displayName,
            name: profile.name,
            picture: profile.picture,
            fallbackName: profile.displayName || profile.name || `Runner ${user.pubkey.slice(0, 8)}`
          };
        })
      );

      setLeaderboard(usersWithProfiles);
      
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error fetching leaderboard:', err);
      setError(err.message || 'Failed to fetch leaderboard data');
    } finally {
      setIsLoading(false);
    }
  }, [calculateUserDistance, fetchUserProfile]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    isLoading,
    error,
    refresh: fetchLeaderboard
  };
}; 