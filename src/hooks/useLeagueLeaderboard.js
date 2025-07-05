import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
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
 * Phase 9: Enhanced with performance optimizations and progressive loading
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, activityMode, courseTotal, loadingProgress }
 */
export const useLeagueLeaderboard = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // **Phase 9: Enhanced loading states for better UX**
  const [loadingProgress, setLoadingProgress] = useState({
    phase: 'initializing', // 'initializing', 'fetching_participants', 'fetching_events', 'processing_events', 'complete'
    participantCount: 0,
    processedEvents: 0,
    totalEvents: 0,
    message: 'Loading participants...'
  });

  // Constants
  const COURSE_TOTAL_MILES = 500; // Updated to 500 miles
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const PARTICIPANT_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes for participant cache
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}_v3`; // Activity-specific cache with participant-first logic
  const PARTICIPANT_CACHE_KEY = `runstr_participants_cache_v1`; // **Phase 9: Separate participant cache**
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries
  const BATCH_SIZE = 100; // **Phase 9: Process events in batches**
  const UPDATE_DEBOUNCE_MS = 500; // **Phase 9: Debounce UI updates**
  
  // Competition date range
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

  // **Phase 9: Memoized participant data for performance**
  const participantsWithDates = useMemo(() => {
    return seasonPassService.getParticipantsWithDates();
  }, []);

  // **Phase 9: Separate participant cache management**
  const loadCachedParticipants = useCallback(() => {
    try {
      const cached = localStorage.getItem(PARTICIPANT_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < PARTICIPANT_CACHE_DURATION_MS) {
          console.log('[useLeagueLeaderboard] Using cached participant data');
          return data;
        }
      }
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error loading participant cache:', err);
    }
    return null;
  }, []);

  const saveCachedParticipants = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(PARTICIPANT_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error saving participant cache:', err);
    }
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
          console.log('[useLeagueLeaderboard] Using cached leaderboard data');
          setLeaderboard(data);
          setLastUpdated(new Date(timestamp));
          setLoadingProgress({ phase: 'complete', participantCount: data.length, processedEvents: 0, totalEvents: 0, message: 'Using cached data' });
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

  // **Phase 9: Debounced leaderboard updates for better performance**
  const debouncedUpdateLeaderboard = useCallback(() => {
    let timeoutId;
    
    return (leaderboardData) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setLeaderboard(leaderboardData);
      }, UPDATE_DEBOUNCE_MS);
    };
  }, []);

  // **Phase 9: Process events in batches to avoid blocking UI**
  const processEventsBatch = useCallback((events, leaderboardMap, participantPaymentDates, batchStart, batchEnd) => {
    const batch = events.slice(batchStart, batchEnd);
    const processedEvents = [];
    
    batch.forEach(event => {
      if (!event.pubkey) return;
      
      // Filter by individual participant payment date
      const participantPaymentDate = participantPaymentDates.get(event.pubkey);
      if (!participantPaymentDate) return;
      
      if (event.created_at < participantPaymentDate) return;
      
      // Filter by global competition end date
      if (event.created_at > COMPETITION_END) return;
      
      // Filter by current activity mode using exercise tag
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const eventActivityType = exerciseTag?.[1]?.toLowerCase();
      
      const activityMatches = {
        'run': ['run', 'running', 'jog', 'jogging'],
        'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
        'walk': ['walk', 'walking', 'hike', 'hiking']
      };
      
      const acceptedActivities = activityMatches[activityMode] || [activityMode];
      
      if (eventActivityType && !acceptedActivities.includes(eventActivityType)) return;
      
      const distance = extractDistance(event);
      if (distance <= 0) return;

      processedEvents.push(event);

      // Update participant data
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
      }
    });
    
    return processedEvents;
  }, [extractDistance, activityMode, COMPETITION_END]);

  /**
   * Fetch fresh leaderboard data from Season Pass participants only
   * Phase 9: Enhanced with progressive loading and performance optimizations
   */
  const fetchLeaderboardData = useCallback(async () => {
    if (!ndk) {
      console.log('[useLeagueLeaderboard] NDK not available');
      return;
    }

    try {
      setError(null);
      setLoadingProgress({ phase: 'fetching_participants', participantCount: 0, processedEvents: 0, totalEvents: 0, message: 'Loading participants...' });
      
      // **Phase 9: Check for cached participants first**
      let cachedParticipants = loadCachedParticipants();
      if (!cachedParticipants) {
        cachedParticipants = participantsWithDates;
        saveCachedParticipants(cachedParticipants);
      }
      
      console.log(`[useLeagueLeaderboard] Season Pass participants: ${cachedParticipants.length}`);
      
      // **Handle empty participants gracefully**
      if (cachedParticipants.length === 0) {
        console.log('[useLeagueLeaderboard] No Season Pass participants found - showing empty leaderboard');
        const emptyLeaderboard = [];
        setLeaderboard(emptyLeaderboard);
        saveCachedData(emptyLeaderboard);
        setLastUpdated(new Date());
        setLoadingProgress({ phase: 'complete', participantCount: 0, processedEvents: 0, totalEvents: 0, message: 'No participants found' });
        setIsLoading(false);
        return;
      }

      setLoadingProgress({ phase: 'fetching_participants', participantCount: cachedParticipants.length, processedEvents: 0, totalEvents: 0, message: `Found ${cachedParticipants.length} participants` });

      // **Phase 9: Create participant payment date lookup map**
      const participantPaymentDates = new Map();
      cachedParticipants.forEach(participant => {
        const paymentTimestamp = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
        participantPaymentDates.set(participant.pubkey, paymentTimestamp);
      });

      // **Phase 9: Create initial leaderboard and show it immediately (progressive loading)**
      const initialLeaderboard = cachedParticipants.map((participant, index) => ({
        pubkey: participant.pubkey,
        totalMiles: 0,
        runCount: 0,
        lastActivity: 0,
        runs: [],
        isComplete: false,
        paymentDate: participant.paymentDate,
        rank: index + 1
      }));

      // **Phase 9: Show initial participant list immediately**
      setLeaderboard(initialLeaderboard);
      setLoadingProgress({ phase: 'fetching_events', participantCount: cachedParticipants.length, processedEvents: 0, totalEvents: 0, message: 'Fetching activity data...' });

      // **Fetch events from Season Pass participants**
      const participantPubkeys = cachedParticipants.map(p => p.pubkey);
      const earliestPaymentDate = Math.min(...Array.from(participantPaymentDates.values()));
      
      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys,
        limit: MAX_EVENTS,
        since: earliestPaymentDate,
        until: COMPETITION_END
      });

      console.log(`[useLeagueLeaderboard] Fetched ${events.length} events from ${cachedParticipants.length} participants`);
      
      setLoadingProgress({ phase: 'processing_events', participantCount: cachedParticipants.length, processedEvents: 0, totalEvents: events.length, message: `Processing ${events.length} activities...` });

      // **Phase 9: Process events in batches**
      const leaderboardMap = new Map();
      initialLeaderboard.forEach(participant => {
        leaderboardMap.set(participant.pubkey, { ...participant });
      });

      const allProcessedEvents = [];
      let processedCount = 0;

      // Process events in batches to avoid blocking UI
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, events.length);
        const batchProcessed = processEventsBatch(events, leaderboardMap, participantPaymentDates, i, batchEnd);
        
        allProcessedEvents.push(...batchProcessed);
        processedCount += (batchEnd - i);
        
        // Update progress
        setLoadingProgress({ 
          phase: 'processing_events', 
          participantCount: cachedParticipants.length, 
          processedEvents: processedCount, 
          totalEvents: events.length, 
          message: `Processing activities... ${processedCount}/${events.length}` 
        });
        
        // Allow UI to update between batches
        if (i + BATCH_SIZE < events.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // **Final sorting and ranking**
      const sortedParticipants = Array.from(leaderboardMap.values())
        .map(participant => ({
          ...participant,
          totalMiles: Math.round(participant.totalMiles * 100) / 100,
          isComplete: participant.totalMiles >= COURSE_TOTAL_MILES
        }))
        .sort((a, b) => {
          if (b.totalMiles !== a.totalMiles) {
            return b.totalMiles - a.totalMiles;
          }
          if (b.runCount !== a.runCount) {
            return b.runCount - a.runCount;
          }
          if (b.lastActivity !== a.lastActivity) {
            return b.lastActivity - a.lastActivity;
          }
          return a.pubkey.localeCompare(b.pubkey);
        });

      const leaderboardData = sortedParticipants.map((participant, index) => {
        let rank = index + 1;
        if (index > 0 && participant.totalMiles === sortedParticipants[index - 1].totalMiles) {
          rank = sortedParticipants[index - 1].rank;
        }
        return { ...participant, rank };
      });

      console.log(`[useLeagueLeaderboard] Final leaderboard with ALL ${leaderboardData.length} participants`);

      // **Phase 9: Final update**
      setLeaderboard(leaderboardData);
      saveCachedData(leaderboardData);
      setLastUpdated(new Date());
      setLoadingProgress({ phase: 'complete', participantCount: leaderboardData.length, processedEvents: events.length, totalEvents: events.length, message: 'Complete' });

    } catch (err) {
      console.error('[useLeagueLeaderboard] Error fetching leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
      setLoadingProgress({ phase: 'complete', participantCount: 0, processedEvents: 0, totalEvents: 0, message: 'Error loading data' });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, participantsWithDates, loadCachedParticipants, saveCachedParticipants, saveCachedData, processEventsBatch, COMPETITION_END, COURSE_TOTAL_MILES]);

  /**
   * Refresh leaderboard data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ phase: 'initializing', participantCount: 0, processedEvents: 0, totalEvents: 0, message: 'Refreshing...' });
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
    setLoadingProgress({ phase: 'initializing', participantCount: 0, processedEvents: 0, totalEvents: 0, message: 'Switching activity mode...' });
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
    courseTotal: COURSE_TOTAL_MILES,
    loadingProgress // **Phase 9: Expose loading progress for better UX**
  };
}; 