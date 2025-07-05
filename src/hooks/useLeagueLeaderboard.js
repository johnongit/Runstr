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
 * Only counts runs during the competition period (July 11 - October 11, 2025)
 * Uses localStorage caching (30 min expiry) and lazy loading for better UX
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, activityMode, courseTotal }
 */
export const useLeagueLeaderboard = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Constants
  const COURSE_TOTAL_MILES = 500; // Updated to 500 miles
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}_v3`; // Activity-specific cache with participant-first logic
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries
  
  // Competition date range
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

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
   * Extract distance from event tags
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
      // Convert to miles
      if (unit === 'mi' || unit === 'mile' || unit === 'miles') {
        return value;
      } else if (unit === 'km' || unit === 'kilometer' || unit === 'kilometers') {
        return value * 0.621371; // km to miles
      } else if (unit === 'm' || unit === 'meter' || unit === 'meters') {
        return value * 0.000621371; // meters to miles
      }
      
      return value; // Default assumption is miles
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event is duplicate
   */
  const isDuplicateEvent = useCallback((event, processedEvents) => {
    return processedEvents.some(existing => {
      // Primary check: exact same event ID
      if (existing.id === event.id) return true;
      
      // Secondary checks for same user
      if (existing.pubkey !== event.pubkey) return false;
      
      const existingDistance = extractDistance(existing);
      const currentDistance = extractDistance(event);
      const timeDiff = Math.abs(existing.created_at - event.created_at);
      
      // Same distance within 0.05 miles and within 10 minutes
      if (Math.abs(existingDistance - currentDistance) < 0.05 && timeDiff < 600) return true;
      
      // Check duration matching
      const existingDuration = existing.tags?.find(tag => tag[0] === 'duration')?.[1];
      const currentDuration = event.tags?.find(tag => tag[0] === 'duration')?.[1];
      if (existingDuration && currentDuration && existingDuration === currentDuration && 
          Math.abs(existingDistance - currentDistance) < 0.1) return true;
      
      // Check content similarity
      if (existing.content && event.content && existing.content === event.content && 
          Math.abs(existingDistance - currentDistance) < 0.1 && timeDiff < 3600) return true;
      
      return false;
    });
  }, [extractDistance]);

  /**
   * Fetch fresh leaderboard data from Season Pass participants only
   * Phase 6: Ensure all participants display with proper tie-breaking
   */
  const fetchLeaderboardData = useCallback(async () => {
    if (!ndk) {
      console.log('[useLeagueLeaderboard] NDK not available');
      return;
    }

    try {
      setError(null);
      
      // **Phase 6: Start with Season Pass participants (participant-first approach)**
      const participantsWithDates = seasonPassService.getParticipantsWithDates();
      console.log(`[useLeagueLeaderboard] Season Pass participants: ${participantsWithDates.length}`);
      
      // **Handle empty participants gracefully - no error, just empty leaderboard**
      if (participantsWithDates.length === 0) {
        console.log('[useLeagueLeaderboard] No Season Pass participants found - showing empty leaderboard');
        const emptyLeaderboard = [];
        setLeaderboard(emptyLeaderboard);
        saveCachedData(emptyLeaderboard);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // **Phase 6: Create participant payment date lookup map**
      const participantPaymentDates = new Map();
      participantsWithDates.forEach(participant => {
        const paymentTimestamp = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
        participantPaymentDates.set(participant.pubkey, paymentTimestamp);
      });

      // **Phase 6: Create initial leaderboard structure from ALL participants**
      const initialLeaderboard = participantsWithDates.map(participant => ({
        pubkey: participant.pubkey,
        totalMiles: 0,
        runCount: 0, // Keep as runCount for backward compatibility but it represents activity count
        lastActivity: 0,
        runs: [], // Keep as runs for backward compatibility but it represents activities
        isComplete: false,
        paymentDate: participant.paymentDate
      }));

      console.log(`[useLeagueLeaderboard] Phase 6: Created initial leaderboard with ALL ${initialLeaderboard.length} participants`);

      // **Phase 6: Fetch events from Season Pass participants (broader date range for individual filtering)**
      console.log(`[useLeagueLeaderboard] Fetching events from ${participantsWithDates.length} participants for ${activityMode} mode`);
      
      const participantPubkeys = participantsWithDates.map(p => p.pubkey);
      
      // Use broader date range since we'll filter by individual payment dates
      const earliestPaymentDate = Math.min(...Array.from(participantPaymentDates.values()));
      
      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys, // Only query Season Pass participants
        limit: MAX_EVENTS,
        since: earliestPaymentDate, // Use earliest payment date
        until: COMPETITION_END   // Competition end date
      });

      console.log(`[useLeagueLeaderboard] Fetched ${events.length} events from ${participantsWithDates.length} participants`);

      // **Phase 6: Process events with individual payment date filtering**
      const processedEvents = [];
      const leaderboardMap = new Map();
      
      // Initialize map with ALL participant data
      initialLeaderboard.forEach(participant => {
        leaderboardMap.set(participant.pubkey, participant);
      });

      // Process events and update participant data
      events.forEach(event => {
        if (!event.pubkey || isDuplicateEvent(event, processedEvents)) return;
        
        // **Phase 6: Filter by individual participant payment date**
        const participantPaymentDate = participantPaymentDates.get(event.pubkey);
        if (!participantPaymentDate) {
          // Event from non-participant (shouldn't happen with authors filter, but safety check)
          return;
        }
        
        if (event.created_at < participantPaymentDate) {
          console.log(`[useLeagueLeaderboard] Skipping event before payment date for ${event.pubkey.substring(0, 8)}: ${new Date(event.created_at * 1000).toISOString()}`);
          return; // Skip events before individual payment date
        }
        
        // Filter by global competition end date
        if (event.created_at > COMPETITION_END) {
          console.log(`[useLeagueLeaderboard] Skipping event after competition end: ${new Date(event.created_at * 1000).toISOString()}`);
          return;
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

        // Update participant data (only if participant exists in our list)
        const participant = leaderboardMap.get(event.pubkey);
        if (participant) {
          participant.totalMiles += distance;
          participant.runCount++;
          participant.lastActivity = Math.max(participant.lastActivity, event.created_at);
          participant.runs.push({
            distance,
            timestamp: event.created_at,
            eventId: event.id,
            activityType: eventActivityType
          });
          
          console.log(`[useLeagueLeaderboard] Updated ${event.pubkey.substring(0, 8)}: +${distance.toFixed(2)} miles (total: ${participant.totalMiles.toFixed(2)})`);
        }
      });

      // **Phase 6: Convert to final leaderboard format with ALL participants and proper tie-breaking**
      const leaderboardData = Array.from(leaderboardMap.values())
        .map(participant => ({
          ...participant,
          totalMiles: Math.round(participant.totalMiles * 100) / 100, // Round to 2 decimals
          isComplete: participant.totalMiles >= COURSE_TOTAL_MILES
        }))
        .sort((a, b) => {
          // Primary sort: by distance descending
          if (b.totalMiles !== a.totalMiles) {
            return b.totalMiles - a.totalMiles;
          }
          
          // Tie-breaker 1: by activity count descending (more activities wins)
          if (b.runCount !== a.runCount) {
            return b.runCount - a.runCount;
          }
          
          // Tie-breaker 2: by most recent activity (more recent wins)
          if (b.lastActivity !== a.lastActivity) {
            return b.lastActivity - a.lastActivity;
          }
          
          // Final tie-breaker: by pubkey (alphabetical for consistency)
          return a.pubkey.localeCompare(b.pubkey);
        })
        .map((participant, index) => {
          // **Phase 6: Assign ranks with proper tie handling**
          let rank = index + 1;
          
          // If this participant has the same distance as the previous one, give them the same rank
          if (index > 0 && participant.totalMiles === leaderboardData[index - 1].totalMiles) {
            rank = leaderboardData[index - 1].rank;
          }
          
          return { ...participant, rank };
        });

      console.log(`[useLeagueLeaderboard] Phase 6: Final leaderboard with ALL ${leaderboardData.length} participants`);
      console.log(`[useLeagueLeaderboard] Phase 6: Participants with 0 distance: ${leaderboardData.filter(p => p.totalMiles === 0).length}`);
      console.log(`[useLeagueLeaderboard] Phase 6: Distance summary:`, 
        leaderboardData.map(p => `Rank ${p.rank}: ${p.pubkey.substring(0, 8)} - ${p.totalMiles} miles`));

      // Update state and cache
      setLeaderboard(leaderboardData);
      saveCachedData(leaderboardData);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('[useLeagueLeaderboard] Error fetching leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [ndk, extractDistance, isDuplicateEvent, saveCachedData, activityMode, COMPETITION_END, COURSE_TOTAL_MILES]);

  /**
   * Refresh leaderboard data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Load cached data on mount
  useEffect(() => {
    const hasCachedData = loadCachedData();
    if (!hasCachedData) {
      fetchLeaderboardData();
    }
  }, [loadCachedData, fetchLeaderboardData]);

  // Refresh when activity mode changes
  useEffect(() => {
    console.log(`[useLeagueLeaderboard] Activity mode changed to: ${activityMode}`);
    setIsLoading(true);
    fetchLeaderboardData();
  }, [activityMode, fetchLeaderboardData]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[useLeagueLeaderboard] Auto-refreshing leaderboard...');
      fetchLeaderboardData();
    }, CACHE_DURATION_MS);

    return () => clearInterval(interval);
  }, [fetchLeaderboardData]);

  return {
    leaderboard,
    isLoading,
    error,
    refresh,
    lastUpdated,
    activityMode,
    courseTotal: COURSE_TOTAL_MILES
  };
}; 