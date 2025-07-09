import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import enhancedSeasonPassService from '../services/enhancedSeasonPassService';
import { REWARDS } from '../config/rewardsConfig';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useHistoricalTotals
 * Fetches complete historical totals for all Season Pass participants
 * Uses GLOBAL competition date range for all participants (no individual payment date filtering)
 * Heavily cached (30 min) since historical data doesn't change frequently
 * 
 * @returns {Object} { totals, isLoading, error, refresh, lastUpdated }
 */
export const useHistoricalTotals = () => {
  const { ndk } = useContext(NostrContext);
  const [totals, setTotals] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Cache configuration
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  const CACHE_KEY = 'runstr_historical_totals_v4_global_dates'; // Updated for global dates
  const MAX_EVENTS = 5000;

  // Global competition date range from rewardsConfig (no individual payment filtering)
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

  // Get participants from enhanced service
  const [participants, setParticipants] = useState([]);
  
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const mergedParticipants = await enhancedSeasonPassService.getParticipants();
        setParticipants(mergedParticipants);
        console.log('[HistoricalTotals] Loaded participants:', {
          count: mergedParticipants.length,
          competitionStart: new Date(COMPETITION_START * 1000).toISOString(),
          competitionEnd: new Date(COMPETITION_END * 1000).toISOString()
        });
      } catch (error) {
        console.error('[HistoricalTotals] Error loading participants:', error);
        setParticipants([]);
      }
    };

    loadParticipants();
  }, [COMPETITION_START, COMPETITION_END]);

  /**
   * Extract and validate distance from workout event
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      if (isNaN(value) || value < 0) return 0;
      
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
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
      if (distanceInKm < 0.01 || distanceInKm > 500) {
        console.warn(`[useHistoricalTotals] Invalid distance: ${value} ${unit} - filtering out`);
        return 0;
      }
      
      // Return in miles for consistency
      return distanceInKm * 0.621371;
    } catch (err) {
      console.error('[useHistoricalTotals] Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event matches current activity mode
   */
  const matchesActivityMode = useCallback((event) => {
    const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
    const eventActivityType = exerciseTag?.[1]?.toLowerCase();
    
    const activityMatches = {
      'run': ['run', 'running', 'jog', 'jogging'],
      'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
      'walk': ['walk', 'walking', 'hike', 'hiking']
    };
    
    const acceptedActivities = activityMatches[activityMode] || ['run', 'running', 'jog', 'jogging'];
    
    return !eventActivityType || acceptedActivities.includes(eventActivityType);
  }, [activityMode]);

  /**
   * Load cached historical totals
   */
  const loadCachedTotals = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION_MS) {
          console.log('[useHistoricalTotals] Using cached data');
          setHistoricalTotals(data);
          setLastUpdated(new Date(timestamp));
          setIsLoading(false);
          return true;
        }
      }
    } catch (err) {
      console.error('[useHistoricalTotals] Error loading cache:', err);
    }
    return false;
  }, [CACHE_KEY]);

  /**
   * Save historical totals to cache
   */
  const saveCachedTotals = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('[useHistoricalTotals] Error saving cache:', err);
    }
  }, [CACHE_KEY]);

  /**
   * Fetch historical totals for all participants
   */
  const fetchHistoricalTotals = useCallback(async () => {
    if (participantsWithDates.length === 0) {
      console.log('[useHistoricalTotals] No participants found');
      setHistoricalTotals([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log(`[useHistoricalTotals] Fetching historical data for ${participantsWithDates.length} participants`);

      // Create participant map with signup dates
      const participantMap = new Map();
      participantsWithDates.forEach(participant => {
        participantMap.set(participant.pubkey, {
          pubkey: participant.pubkey,
          signupDate: Math.floor(new Date(participant.paymentDate).getTime() / 1000),
          totalMiles: 0,
          runCount: 0,
          lastActivity: 0,
          runs: []
        });
      });

      // Fetch all events for all participants (since their individual signup dates)
      const participantPubkeys = participantsWithDates.map(p => p.pubkey);
      const earliestSignupDate = Math.min(...participantsWithDates.map(p => 
        Math.floor(new Date(p.paymentDate).getTime() / 1000)
      ));

      console.log(`[useHistoricalTotals] Fetching events since ${new Date(earliestSignupDate * 1000).toISOString()}`);

      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys,
        since: earliestSignupDate,
        limit: 5000 // Should be enough for 3-month competition
      });

      console.log(`[useHistoricalTotals] Fetched ${events.size} total events`);

      // Process events for each participant
      let processedCount = 0;
      Array.from(events).forEach(event => {
        const participant = participantMap.get(event.pubkey);
        if (!participant) return;

        // Only count events after participant's signup date
        if (event.created_at < participant.signupDate) {
          return;
        }

        // Filter by activity mode
        if (!matchesActivityMode(event)) {
          return;
        }

        const distance = extractDistance(event);
        if (distance <= 0) return;

        // Add to participant totals
        participant.totalMiles += distance;
        participant.runCount++;
        participant.lastActivity = Math.max(participant.lastActivity, event.created_at);
        participant.runs.push({
          distance,
          timestamp: event.created_at,
          eventId: event.id,
          activityType: event.tags?.find(tag => tag[0] === 'exercise')?.[1]?.toLowerCase()
        });

        processedCount++;
      });

      // Convert to sorted array
      const sortedTotals = Array.from(participantMap.values())
        .map(participant => ({
          ...participant,
          totalMiles: Math.round(participant.totalMiles * 100) / 100
        }))
        .sort((a, b) => {
          if (b.totalMiles !== a.totalMiles) return b.totalMiles - a.totalMiles;
          if (b.runCount !== a.runCount) return b.runCount - a.runCount;
          return b.lastActivity - a.lastActivity;
        });

      // Add ranks
      const rankedTotals = sortedTotals.map((participant, index) => ({
        ...participant,
        rank: index + 1
      }));

      console.log(`[useHistoricalTotals] Processed ${processedCount} events for ${rankedTotals.length} participants`);
      rankedTotals.forEach(p => {
        console.log(`  ${p.pubkey.slice(0, 8)}: ${p.totalMiles} mi, ${p.runCount} runs (since ${new Date(p.signupDate * 1000).toLocaleDateString()})`);
      });

      setHistoricalTotals(rankedTotals);
      saveCachedTotals(rankedTotals);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('[useHistoricalTotals] Error fetching historical totals:', err);
      setError(err.message || 'Failed to fetch historical totals');
    } finally {
      setIsLoading(false);
    }
  }, [participantsWithDates, extractDistance, matchesActivityMode, saveCachedTotals]);

  /**
   * Force refresh (bypass cache)
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchHistoricalTotals();
  }, [fetchHistoricalTotals]);

  // Initial load - check cache first, then fetch if needed
  useEffect(() => {
    const hasCached = loadCachedTotals();
    if (!hasCached) {
      fetchHistoricalTotals();
    }
  }, [loadCachedTotals, fetchHistoricalTotals]);

  return {
    historicalTotals,
    isLoading,
    error,
    refresh,
    lastUpdated
  };
}; 