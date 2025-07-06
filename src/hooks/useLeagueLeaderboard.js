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
 * Only counts runs during the competition period (July 1 - October 11, 2025)
 * Uses localStorage caching (30 min expiry) and progressive loading for optimal UX
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
  
  // Enhanced loading states for better UX
  const [loadingProgress, setLoadingProgress] = useState({
    phase: 'initializing',
    participantCount: 0,
    processedEvents: 0,
    totalEvents: 0,
    message: 'Loading participants...'
  });

  // Constants
  const COURSE_TOTAL_MILES = 500;
  const CACHE_DURATION_MS = 0; // TEMPORARILY DISABLED - always fetch fresh data
  const PARTICIPANT_CACHE_DURATION_MS = 0; // TEMPORARILY DISABLED - always fetch fresh data
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}_v6_simplified`; // Force refresh with simplified approach
  const PARTICIPANT_CACHE_KEY = `runstr_participants_cache_v3`; // Incremented for mobile
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries
  const BATCH_SIZE = 100; // Process events in batches
  const UPDATE_DEBOUNCE_MS = 500; // Debounce UI updates
  
  // Competition date range - SIMPLIFIED: Use fixed date range for testing
  const COMPETITION_START = Math.floor(new Date('2025-07-01T00:00:00Z').getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date('2025-07-30T23:59:59Z').getTime() / 1000); // July 30 for testing

  // Memoized participant data for performance
  const participantsWithDates = useMemo(() => {
    try {
      return seasonPassService.getParticipantsWithDates();
    } catch (err) {
      console.error('Error loading participants:', err);
      return [];
    }
  }, []);

  // Separate participant cache management
  const loadCachedParticipants = useCallback(() => {
    try {
      const cached = localStorage.getItem(PARTICIPANT_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < PARTICIPANT_CACHE_DURATION_MS) {
          return data;
        }
      }
    } catch (err) {
      console.error('Error loading participant cache:', err);
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
      console.error('Error saving participant cache:', err);
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
          setLeaderboard(data);
          setLastUpdated(new Date(timestamp));
          setLoadingProgress({ 
            phase: 'complete', 
            participantCount: data.length, 
            processedEvents: 0, 
            totalEvents: 0, 
            message: 'Using cached data' 
          });
          setIsLoading(false);
          return true;
        }
      }
    } catch (err) {
      console.error('Error loading cache:', err);
    }
    return false;
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
      console.error('Error saving cache:', err);
    }
  }, [CACHE_KEY]);

  /**
   * Extract distance from event tags with proper error handling and validation
   * FIXED: Now properly returns miles for leaderboard consistency
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      if (isNaN(value) || value < 0) return 0;
      
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
      // Add reasonable bounds checking to filter out corrupted data
      const MAX_REASONABLE_DISTANCE_KM = 500; // 500km covers ultramarathons
      const MIN_REASONABLE_DISTANCE_KM = 0.01; // 10 meters minimum
      
      // Convert to km first for validation
      let distanceInKm = value;
      switch (unit) {
        case 'mi':
        case 'mile':
        case 'miles':
          distanceInKm = value * 1.609344;
          break;
        case 'm':
        case 'meter':
        case 'meters':
          distanceInKm = value / 1000;
          break;
        case 'km':
        case 'kilometer':
        case 'kilometers':
        default:
          distanceInKm = value;
          break;
      }
      
      // Validate reasonable range
      if (distanceInKm < MIN_REASONABLE_DISTANCE_KM || distanceInKm > MAX_REASONABLE_DISTANCE_KM) {
        console.warn(`Invalid distance detected: ${value} ${unit} (${distanceInKm.toFixed(2)}km) - filtering out event ${event.id}`);
        return 0;
      }
      
      // FIXED: Return in miles for leaderboard consistency (convert km to miles)
      return distanceInKm * 0.621371;
    } catch (err) {
      console.error('Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event is duplicate with comprehensive validation
   */
  const isDuplicateEvent = useCallback((event, processedEvents) => {
    try {
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
    } catch (err) {
      console.error('Error checking duplicate event:', err);
      return false;
    }
  }, [extractDistance]);

  /**
   * Process events in batches to avoid blocking UI
   */
  const processEventsBatch = useCallback((events, leaderboardMap, participantSet, batchStart, batchEnd) => {
    try {
      const batch = events.slice(batchStart, batchEnd);
      const processedEvents = [];
      
      console.log(`[LeagueLeaderboard] Processing batch ${batchStart}-${batchEnd}, ${batch.length} events`);
      
      batch.forEach(event => {
        if (!event.pubkey) {
          console.log(`[LeagueLeaderboard] Skipping event - no pubkey:`, event.id);
          return;
        }
        
        // SIMPLIFIED: Only check if user is a participant (no individual payment dates)
        if (!participantSet.has(event.pubkey)) {
          console.log(`[LeagueLeaderboard] Skipping event - not a participant:`, event.pubkey);
          return;
        }
        
        // SIMPLIFIED: Only filter by competition date range (use event's created_at)
        if (event.created_at < COMPETITION_START) {
          console.log(`[LeagueLeaderboard] Skipping event - before competition start:`, {
            eventDate: new Date(event.created_at * 1000).toISOString(),
            competitionStart: new Date(COMPETITION_START * 1000).toISOString()
          });
          return;
        }
        
        if (event.created_at > COMPETITION_END) {
          console.log(`[LeagueLeaderboard] Skipping event - after competition end:`, {
            eventDate: new Date(event.created_at * 1000).toISOString(),
            competitionEnd: new Date(COMPETITION_END * 1000).toISOString()
          });
          return;
        }
        
        // Filter by current activity mode using exercise tag
        const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        const activityMatches = {
          'run': ['run', 'running', 'jog', 'jogging'],
          'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
          'walk': ['walk', 'walking', 'hike', 'hiking']
        };
        
        const acceptedActivities = activityMatches[activityMode] || [activityMode];
        
        if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
          console.log(`[LeagueLeaderboard] Skipping event - activity mismatch:`, {
            eventType: eventActivityType,
            acceptedTypes: acceptedActivities
          });
          return;
        }
        
        const distance = extractDistance(event);
        if (distance <= 0) {
          console.log(`[LeagueLeaderboard] Skipping event - invalid distance:`, distance);
          return;
        }

        processedEvents.push(event);
        console.log(`[LeagueLeaderboard] ✅ Processing event:`, {
          eventId: event.id,
          pubkey: event.pubkey,
          distance: distance,
          activityType: eventActivityType,
          eventDate: new Date(event.created_at * 1000).toISOString()
        });

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
          
          console.log(`[LeagueLeaderboard] Updated participant:`, {
            pubkey: event.pubkey,
            totalMiles: participant.totalMiles,
            runCount: participant.runCount
          });
        } else {
          console.log(`[LeagueLeaderboard] ⚠️ Participant not found in leaderboard map:`, event.pubkey);
        }
      });
      
      console.log(`[LeagueLeaderboard] Batch complete: ${processedEvents.length}/${batch.length} events processed`);
      return processedEvents;
    } catch (err) {
      console.error('Error processing events batch:', err);
      return [];
    }
  }, [extractDistance, activityMode, COMPETITION_START, COMPETITION_END]);

  /**
   * Fetch fresh leaderboard data from Season Pass participants only
   * Enhanced with progressive loading and performance optimizations
   */
  const fetchLeaderboardData = useCallback(async () => {
    if (!ndk) {
      setError('Nostr connection not available');
      return;
    }

    try {
      setError(null);
      setLoadingProgress({ 
        phase: 'fetching_participants', 
        participantCount: 0, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Loading participants...' 
      });
      
      // Check for cached participants first
      let cachedParticipants = loadCachedParticipants();
      if (!cachedParticipants) {
        cachedParticipants = participantsWithDates;
        if (cachedParticipants.length > 0) {
          saveCachedParticipants(cachedParticipants);
        }
      }
      
      // Handle empty participants gracefully
      if (cachedParticipants.length === 0) {
        const emptyLeaderboard = [];
        setLeaderboard(emptyLeaderboard);
        saveCachedData(emptyLeaderboard);
        setLastUpdated(new Date());
        setLoadingProgress({ 
          phase: 'complete', 
          participantCount: 0, 
          processedEvents: 0, 
          totalEvents: 0, 
          message: 'No participants found' 
        });
        setIsLoading(false);
        return;
      }

      setLoadingProgress({ 
        phase: 'fetching_participants', 
        participantCount: cachedParticipants.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: `Found ${cachedParticipants.length} participants` 
      });

      // SIMPLIFIED: Create simple participant pubkey set (no individual payment dates)
      const participantPubkeys = cachedParticipants.map(p => p.pubkey);
      const participantSet = new Set(participantPubkeys);

      console.log('[LeagueLeaderboard] Using simplified participant filtering:', {
        participantCount: participantPubkeys.length,
        participants: participantPubkeys,
        competitionStart: new Date(COMPETITION_START * 1000).toISOString(),
        competitionEnd: new Date(COMPETITION_END * 1000).toISOString()
      });

      // Create initial leaderboard and show it immediately (progressive loading)
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

      // Show initial participant list immediately
      setLeaderboard(initialLeaderboard);
      setLoadingProgress({ 
        phase: 'fetching_events', 
        participantCount: cachedParticipants.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Fetching activity data...' 
      });

      // SIMPLIFIED: Fetch events using only competition date range
      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys,
        limit: MAX_EVENTS,
        since: COMPETITION_START,  // Use competition start, not individual payment dates
        until: COMPETITION_END
      });
      
      setLoadingProgress({ 
        phase: 'processing_events', 
        participantCount: cachedParticipants.length, 
        processedEvents: 0, 
        totalEvents: events.length, 
        message: `Processing ${events.length} activities...` 
      });

      // Process events in batches
      const leaderboardMap = new Map();
      initialLeaderboard.forEach(participant => {
        leaderboardMap.set(participant.pubkey, { ...participant });
      });

      const allProcessedEvents = [];
      let processedCount = 0;

      // Process events in batches to avoid blocking UI
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, events.length);
        const batchProcessed = processEventsBatch(events, leaderboardMap, participantSet, i, batchEnd);
        
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

      // Final sorting and ranking
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

      // Final update
      setLeaderboard(leaderboardData);
      saveCachedData(leaderboardData);
      setLastUpdated(new Date());
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: leaderboardData.length, 
        processedEvents: events.length, 
        totalEvents: events.length, 
        message: 'Complete' 
      });

    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      const errorMessage = err.message || 'Failed to load leaderboard data';
      setError(errorMessage);
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: 0, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Error loading data' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, participantsWithDates, loadCachedParticipants, saveCachedParticipants, saveCachedData, processEventsBatch, COMPETITION_END, COURSE_TOTAL_MILES]);

  /**
   * Refresh leaderboard data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ 
      phase: 'initializing', 
      participantCount: 0, 
      processedEvents: 0, 
      totalEvents: 0, 
      message: 'Refreshing...' 
    });
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
    setIsLoading(true);
    setLoadingProgress({ 
      phase: 'initializing', 
      participantCount: 0, 
      processedEvents: 0, 
      totalEvents: 0, 
      message: 'Switching activity mode...' 
    });
    fetchLeaderboardData();
  }, [activityMode, fetchLeaderboardData]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
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
    loadingProgress
  };
}; 