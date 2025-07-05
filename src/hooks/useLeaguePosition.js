import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import seasonPassService from '../services/seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeaguePosition
 * Fetches user's Kind 1301 workout records and calculates their position
 * in the 3-month distance competition. Focuses on competitive metrics
 * rather than course completion.
 * 
 * @returns {Object} { competitionPosition, totalDistance, activities, isLoading, error, competitionStats }
 */
export const useLeaguePosition = () => {
  const { publicKey: userPubkey } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [totalDistance, setTotalDistance] = useState(0); // in miles
  const [activities, setActivities] = useState([]);
  const [competitionPosition, setCompetitionPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Constants
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache
  const CACHE_KEY = `runstr_league_position_${userPubkey}_${activityMode}_v3`; // Updated version
  
  // Competition date range
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

  // Competition stats calculations
  const getCompetitionStats = useCallback(() => {
    const now = Date.now();
    const startDate = new Date(REWARDS.SEASON_1.startUtc);
    const endDate = new Date(REWARDS.SEASON_1.endUtc);
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    
    const hasStarted = now >= startDate.getTime();
    const hasEnded = now >= endDate.getTime();
    
    // Calculate user's daily averages
    const dailyAverage = daysElapsed > 0 ? totalDistance / daysElapsed : 0;
    const projectedTotal = dailyAverage * totalDays;
    
    return {
      totalDays,
      daysElapsed,
      daysRemaining,
      hasStarted,
      hasEnded,
      startDate,
      endDate,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      projectedTotal: Math.round(projectedTotal * 100) / 100
    };
  }, [totalDistance]);

  /**
   * Extract distance from workout event
   */
  const extractDistance = useCallback((event) => {
    if (!event.tags) return 0;
    
    const distanceTag = event.tags.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;
    
    const distance = parseFloat(distanceTag[1]);
    if (isNaN(distance)) return 0;
    
    // Convert to miles if needed
    const unit = distanceTag[2] || 'km';
    if (unit === 'km') {
      return distance * 0.621371; // Convert km to miles
    }
    
    return distance; // Already in miles
  }, []);

  /**
   * Calculate user's position in competition
   */
  const calculateCompetitionPosition = useCallback(async () => {
    if (!userPubkey || totalDistance === 0) return null;
    
    try {
      // Get all Season Pass participants
      const participants = seasonPassService.getParticipants();
      if (participants.length === 0) return null;
      
      // For now, we'll estimate position based on available data
      // In a full implementation, we'd fetch all participants' data
      const position = {
        currentRank: null, // Will be calculated when we have full leaderboard data
        totalParticipants: participants.length,
        distanceFromLeader: null, // Will be calculated when we have leader data
        distanceToNext: null, // Will be calculated when we have next rank data
        percentile: null // Will be calculated when we have full distribution
      };
      
      return position;
    } catch (err) {
      console.error('[useLeaguePosition] Error calculating position:', err);
      return null;
    }
  }, [userPubkey, totalDistance]);

  /**
   * Fetch user's league position and activities
   */
  const fetchLeaguePosition = useCallback(async () => {
    if (!userPubkey) {
      console.log('[useLeaguePosition] No user pubkey available');
      return;
    }

    // Check cache first
    const cacheKey = CACHE_KEY;
    const cached = localStorage.getItem(cacheKey);
    const now = Date.now();
    
    if (cached && now - lastFetchTime < CACHE_DURATION_MS) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < CACHE_DURATION_MS) {
          console.log('[useLeaguePosition] Using cached position data');
          setTotalDistance(data.totalDistance);
          setActivities(data.activities);
          setCompetitionPosition(data.competitionPosition);
          return;
        }
      } catch (err) {
        console.error('[useLeaguePosition] Error parsing cached data:', err);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[useLeaguePosition] Fetching position for ${userPubkey} in ${activityMode} mode`);
      
      // Fetch user's workout events during competition period
      const events = await fetchEvents(
        { fetchEvents: async (filter) => {
          // This is a simplified implementation - in practice, we'd use the NDK instance
          return [];
        }},
        {
          kinds: [1301],
          authors: [userPubkey],
          since: COMPETITION_START,
          until: COMPETITION_END,
          limit: 1000
        }
      );

      console.log(`[useLeaguePosition] Fetched ${events.length} events`);

      // Process events for current activity mode
      const userActivities = [];
      let userTotalDistance = 0;

      events.forEach(event => {
        // Filter by current activity mode
        const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        // Map activity mode to possible exercise tag values
        const activityMatches = {
          'run': ['run', 'running', 'jog', 'jogging'],
          'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
          'walk': ['walk', 'walking', 'hike', 'hiking']
        };
        
        const acceptedActivities = activityMatches[activityMode] || [activityMode];
        
        // Skip events that don't match current activity mode
        if (eventActivityType && !acceptedActivities.includes(eventActivityType)) return;
        
        const distance = extractDistance(event);
        if (distance <= 0) return;

        userActivities.push({
          distance,
          timestamp: event.created_at,
          eventId: event.id,
          activityType: eventActivityType,
          date: new Date(event.created_at * 1000).toISOString()
        });

        userTotalDistance += distance;
      });

      // Sort activities by date (most recent first)
      userActivities.sort((a, b) => b.timestamp - a.timestamp);
      
      // Round total distance
      userTotalDistance = Math.round(userTotalDistance * 100) / 100;

      // Calculate competition position
      const position = await calculateCompetitionPosition();

      // Cache the results
      const cacheData = {
        data: {
          totalDistance: userTotalDistance,
          activities: userActivities,
          competitionPosition: position
        },
        timestamp: now
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Update state
      setTotalDistance(userTotalDistance);
      setActivities(userActivities);
      setCompetitionPosition(position);
      setLastFetchTime(now);

    } catch (err) {
      console.error('[useLeaguePosition] Error fetching position:', err);
      setError(err.message || 'Failed to fetch league position');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, activityMode, extractDistance, calculateCompetitionPosition, CACHE_KEY, lastFetchTime]);

  /**
   * Manual refresh - bypass cache
   */
  const refresh = useCallback(async () => {
    console.log('[useLeaguePosition] Manual refresh triggered');
    setLastFetchTime(0); // Reset cache time
    await fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  // Calculate additional derived values
  const competitionStats = getCompetitionStats();

  return {
    // Core data
    totalDistance,        // Total miles accumulated during competition
    activities,           // Array of user's activities during competition
    competitionPosition,  // User's position in competition
    
    // Competition context
    competitionStats,     // Days elapsed, remaining, averages, projections
    
    // Meta
    isLoading,
    error,
    lastFetchTime,
    
    // Actions
    refresh,
    refetch: fetchLeaguePosition
  };
}; 