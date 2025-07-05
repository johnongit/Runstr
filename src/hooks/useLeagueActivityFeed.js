import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import seasonPassService from '../services/seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeagueActivityFeed
 * Fetches Kind 1301 workout records from Season Pass participants only for feed display
 * Filters by current activity mode (run/walk/cycle) for activity-specific leagues
 * Only shows activities during the competition period (July 11 - September 11, 2025)
 * Uses localStorage caching (15 min expiry) and returns chronological feed data
 * 
 * @returns {Object} { feedEvents, isLoading, error, refresh, lastUpdated, activityMode, loadingProgress }
 */
export const useLeagueActivityFeed = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [feedEvents, setFeedEvents] = useState([]);
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
  const FEED_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes cache for feed
  const PARTICIPANT_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes for participant cache
  const CACHE_KEY = `runstr_league_activity_feed_${activityMode}_v1`;
  const PARTICIPANT_CACHE_KEY = `runstr_participants_cache_v1`;
  const MAX_EVENTS = 2000; // Limit for feed queries
  const FEED_LIMIT = 50; // Maximum number of feed events to return
  const BATCH_SIZE = 100; // Process events in batches
  
  // Competition date range
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

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
   * Load cached feed data
   */
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < FEED_CACHE_DURATION_MS) {
          setFeedEvents(data);
          setLastUpdated(new Date(timestamp));
          setLoadingProgress({ 
            phase: 'complete', 
            participantCount: 0, 
            processedEvents: data.length, 
            totalEvents: data.length, 
            message: 'Using cached feed data' 
          });
          setIsLoading(false);
          return true;
        }
      }
    } catch (err) {
      console.error('Error loading feed cache:', err);
    }
    return false;
  }, [CACHE_KEY]);

  /**
   * Save feed data to cache
   */
  const saveCachedData = useCallback((data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving feed cache:', err);
    }
  }, [CACHE_KEY]);

  /**
   * Extract distance from event tags with proper error handling
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      if (isNaN(value) || value < 0) return 0;
      
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
      // Convert to miles
      switch (unit) {
        case 'mi':
        case 'mile':
        case 'miles':
          return value;
        case 'km':
        case 'kilometer':
        case 'kilometers':
          return value * 0.621371;
        case 'm':
        case 'meter':
        case 'meters':
          return value * 0.000621371;
        default:
          return value; // Default assumption is miles
      }
    } catch (err) {
      console.error('Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Process events for feed display (chronological, not aggregated)
   */
  const processEventsForFeed = useCallback((events, participantPaymentDates) => {
    try {
      const processedEvents = [];
      
      events.forEach(event => {
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

        // Create feed-specific event object
        const feedEvent = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          content: event.content,
          tags: event.tags,
          distance: distance,
          activityType: eventActivityType,
          // Extract common feed display data
          title: event.tags?.find(tag => tag[0] === 'title')?.[1] || '',
          duration: event.tags?.find(tag => tag[0] === 'duration')?.[1] || '',
          // Raw event for compatibility
          rawEvent: event
        };

        processedEvents.push(feedEvent);
      });
      
      // Sort by timestamp (newest first for feed)
      processedEvents.sort((a, b) => b.created_at - a.created_at);
      
      // Limit to feed size
      return processedEvents.slice(0, FEED_LIMIT);
    } catch (err) {
      console.error('Error processing events for feed:', err);
      return [];
    }
  }, [extractDistance, activityMode, COMPETITION_END, FEED_LIMIT]);

  /**
   * Fetch fresh feed data from Season Pass participants only
   * Enhanced with progressive loading and performance optimizations
   */
  const fetchFeedData = useCallback(async () => {
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
        const emptyFeed = [];
        setFeedEvents(emptyFeed);
        saveCachedData(emptyFeed);
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

      // Create participant payment date lookup map
      const participantPaymentDates = new Map();
      cachedParticipants.forEach(participant => {
        try {
          const paymentTimestamp = Math.floor(new Date(participant.paymentDate).getTime() / 1000);
          participantPaymentDates.set(participant.pubkey, paymentTimestamp);
        } catch (err) {
          console.error('Error parsing payment date for participant:', participant.pubkey, err);
        }
      });

      setLoadingProgress({ 
        phase: 'fetching_events', 
        participantCount: cachedParticipants.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Fetching activity feed...' 
      });

      // Fetch events from Season Pass participants
      const participantPubkeys = cachedParticipants.map(p => p.pubkey);
      const earliestPaymentDate = Math.min(...Array.from(participantPaymentDates.values()));
      
      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys,
        limit: MAX_EVENTS,
        since: earliestPaymentDate,
        until: COMPETITION_END
      });
      
      setLoadingProgress({ 
        phase: 'processing_events', 
        participantCount: cachedParticipants.length, 
        processedEvents: 0, 
        totalEvents: events.length, 
        message: `Processing ${events.length} activities for feed...` 
      });

      // Process events for feed display
      const feedData = processEventsForFeed(events, participantPaymentDates);

      // Final update
      setFeedEvents(feedData);
      saveCachedData(feedData);
      setLastUpdated(new Date());
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: cachedParticipants.length, 
        processedEvents: feedData.length, 
        totalEvents: events.length, 
        message: 'Feed loaded successfully' 
      });

    } catch (err) {
      console.error('Error fetching activity feed:', err);
      const errorMessage = err.message || 'Failed to load activity feed';
      setError(errorMessage);
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: 0, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Error loading feed' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, participantsWithDates, loadCachedParticipants, saveCachedParticipants, saveCachedData, processEventsForFeed, COMPETITION_END]);

  /**
   * Refresh feed data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ 
      phase: 'initializing', 
      participantCount: 0, 
      processedEvents: 0, 
      totalEvents: 0, 
      message: 'Refreshing feed...' 
    });
    await fetchFeedData();
  }, [fetchFeedData]);

  // Load cached data on mount
  useEffect(() => {
    const hasCachedData = loadCachedData();
    if (!hasCachedData) {
      fetchFeedData();
    }
  }, [loadCachedData, fetchFeedData]);

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
    fetchFeedData();
  }, [activityMode, fetchFeedData]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[useLeagueActivityFeed] Auto-refreshing feed data');
      refresh();
    }, FEED_CACHE_DURATION_MS);

    return () => clearInterval(interval);
  }, [refresh, FEED_CACHE_DURATION_MS]);

  return {
    feedEvents,
    isLoading,
    error,
    refresh,
    lastUpdated,
    activityMode,
    loadingProgress
  };
}; 