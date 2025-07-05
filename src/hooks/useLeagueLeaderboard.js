import { useState, useEffect, useCallback, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import seasonPassService from '../services/seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeagueLeaderboard
 * Fetches Kind 1301 workout records from Season Pass participants only and creates a comprehensive leaderboard
 * Filters by current activity mode (run/walk/cycle) for activity-specific leagues
 * Only counts activities during the competition period (3-month distance competition)
 * Uses localStorage caching (30 min expiry) and lazy loading for better UX
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, activityMode, competitionStats }
 */
export const useLeagueLeaderboard = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Constants
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}_v3`; // Updated version for new competition format
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries
  
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
    
    return {
      totalDays,
      daysElapsed,
      daysRemaining,
      hasStarted,
      hasEnded,
      startDate,
      endDate
    };
  }, []);

  /**
   * Load cached leaderboard data
   */
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION_MS) {
          console.log('[useLeagueLeaderboard] Using cached data');
          setLeaderboard(data);
          setLastUpdated(new Date(timestamp));
          setIsLoading(false);
          return true; // Cache is valid
        }
      }
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error loading cache:', err);
    }
    return false; // No valid cache
  }, [CACHE_KEY]);

  /**
   * Save leaderboard data to cache
   */
  const saveCachedData = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error saving cache:', err);
    }
  }, [CACHE_KEY]);

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
   * Check if event is a duplicate
   */
  const isDuplicateEvent = useCallback((event, processedEvents) => {
    return processedEvents.some(processed => 
      processed.id === event.id || 
      (processed.pubkey === event.pubkey && 
       processed.created_at === event.created_at &&
       Math.abs(extractDistance(processed) - extractDistance(event)) < 0.01)
    );
  }, [extractDistance]);

  /**
   * Process events into user statistics
   * Only counts activities during the competition period
   */
  const processEvents = useCallback((events) => {
    const userStats = {};
    const processedEvents = [];

    // Filter duplicates and process events
    events.forEach(event => {
      if (!event.pubkey || isDuplicateEvent(event, processedEvents)) return;
      
      // Filter by competition date range - only count activities during the competition
      if (event.created_at < COMPETITION_START || event.created_at > COMPETITION_END) {
        console.log(`[useLeagueLeaderboard] Skipping event outside competition period: ${new Date(event.created_at * 1000).toISOString()}`);
        return; // Skip events outside competition period
      }
      
      // Filter by current activity mode using exercise tag
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const eventActivityType = exerciseTag?.[1]?.toLowerCase();
      
      // Map activity mode to possible exercise tag values (RUNSTR uses 'run', others might use 'running')
      const activityMatches = {
        'run': ['run', 'running', 'jog', 'jogging'],
        'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
        'walk': ['walk', 'walking', 'hike', 'hiking']
      };
      
      const acceptedActivities = activityMatches[activityMode] || [activityMode];
      
      // Skip events that don't match current activity mode
      if (eventActivityType && !acceptedActivities.includes(eventActivityType)) return;
      
      // If no exercise tag but is valid event, allow it through (fallback)
      if (!eventActivityType) {
        console.log(`[useLeagueLeaderboard] Event with no exercise tag - allowing through`);
      }
      
      const distance = extractDistance(event);
      if (distance <= 0) return;

      processedEvents.push(event);

      // Initialize user if not exists
      if (!userStats[event.pubkey]) {
        userStats[event.pubkey] = {
          pubkey: event.pubkey,
          totalMiles: 0,
          activityCount: 0,
          lastActivity: 0,
          activities: []
        };
      }

      // Add activity data
      userStats[event.pubkey].totalMiles += distance;
      userStats[event.pubkey].activityCount++;
      userStats[event.pubkey].lastActivity = Math.max(
        userStats[event.pubkey].lastActivity, 
        event.created_at
      );
      userStats[event.pubkey].activities.push({
        distance,
        timestamp: event.created_at,
        eventId: event.id,
        activityType: eventActivityType
      });
    });

    // Convert to leaderboard format and sort
    const leaderboardData = Object.values(userStats)
      .map(user => ({
        ...user,
        totalMiles: Math.round(user.totalMiles * 100) / 100, // Round to 2 decimals
        averageDistance: user.activityCount > 0 ? Math.round((user.totalMiles / user.activityCount) * 100) / 100 : 0
      }))
      .sort((a, b) => b.totalMiles - a.totalMiles) // Sort by distance descending
      .slice(0, 10) // Top 10 only
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return leaderboardData;
  }, [extractDistance, isDuplicateEvent, activityMode, COMPETITION_START, COMPETITION_END]);

  /**
   * Fetch fresh leaderboard data from Season Pass participants only
   */
  const fetchLeaderboardData = useCallback(async () => {
    if (!ndk) {
      console.log('[useLeagueLeaderboard] NDK not available');
      return;
    }

    try {
      setError(null);
      
      // Get Season Pass participants first
      const participants = seasonPassService.getParticipants();
      console.log(`[useLeagueLeaderboard] Season Pass participants: ${participants.length}`);
      
      // Handle empty participants gracefully - no error, just empty leaderboard
      if (participants.length === 0) {
        console.log('[useLeagueLeaderboard] No Season Pass participants found - showing empty leaderboard');
        const emptyLeaderboard = [];
        setLeaderboard(emptyLeaderboard);
        saveCachedData(emptyLeaderboard);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // Only fetch events from Season Pass participants during competition period
      console.log(`[useLeagueLeaderboard] Fetching events from ${participants.length} participants for ${activityMode} mode during competition period`);
      
      const events = await fetchEvents(ndk, {
        kinds: [1301],
        authors: participants, // Only query Season Pass participants
        limit: MAX_EVENTS,
        since: COMPETITION_START, // Competition start date
        until: COMPETITION_END   // Competition end date
      });

      console.log(`[useLeagueLeaderboard] Fetched ${events.length} events from ${participants.length} participants`);

      // Process events into leaderboard
      const leaderboardData = processEvents(events);
      console.log(`[useLeagueLeaderboard] Processed ${leaderboardData.length} users for leaderboard`);

      // Update state and cache
      setLeaderboard(leaderboardData);
      saveCachedData(leaderboardData);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('[useLeagueLeaderboard] Error fetching leaderboard:', err);
      setError(err.message || 'Failed to fetch leaderboard data');
    } finally {
      setIsLoading(false);
    }
  }, [ndk, activityMode, processEvents, saveCachedData]);

  /**
   * Manual refresh - bypass cache
   */
  const refresh = useCallback(async () => {
    console.log('[useLeagueLeaderboard] Manual refresh triggered');
    setIsLoading(true);
    await fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Load cached data on mount, then fetch fresh data
  useEffect(() => {
    const hasCachedData = loadCachedData();
    
    if (!hasCachedData) {
      fetchLeaderboardData();
    } else {
      // Fetch fresh data in background
      setTimeout(fetchLeaderboardData, 100);
    }
  }, [loadCachedData, fetchLeaderboardData]);

  // Calculate additional derived values
  const competitionStats = getCompetitionStats();

  return {
    // Core data
    leaderboard,
    isLoading,
    error,
    lastUpdated,
    
    // Competition context
    activityMode,
    competitionStats,
    
    // Actions
    refresh
  };
}; 