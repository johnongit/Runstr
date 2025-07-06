import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { useProfiles } from './useProfiles';
import { useNostr } from './useNostr';
import seasonPassService from '../services/seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeagueActivityFeed
 * Fetches Kind 1301 workout records from Season Pass participants only for feed display
 * Filters by current activity mode (run/walk/cycle) for activity-specific leagues
 * Only shows activities during the competition period (July 11 - September 11, 2025)
 * Uses localStorage caching (15 min expiry) and returns chronological feed data with profile metadata
 * 
 * @returns {Object} { feedEvents, enhancedFeedEvents, isLoading, error, refresh, lastUpdated, activityMode, loadingProgress, profilesLoading }
 */
export const useLeagueActivityFeed = () => {
  const { ndk } = useContext(NostrContext);
  const { publicKey } = useNostr();
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

  // Extract pubkeys for profile loading (Phase 4)
  const feedEventPubkeys = useMemo(() => {
    return Array.from(new Set(feedEvents.map(event => event.pubkey).filter(Boolean)));
  }, [feedEvents]);

  // Get profiles for feed events (Phase 4)
  const { profiles, isLoading: profilesLoading } = useProfiles(feedEventPubkeys);

  // Enhanced feed events with profile data (Phase 4)
  const enhancedFeedEvents = useMemo(() => {
    if (!feedEvents.length) return [];
    
    return feedEvents.map(event => {
      const profile = profiles?.[event.pubkey] || {};
      return {
        ...event,
        // Add profile metadata
        displayName: profile.display_name || profile.name || `Runner ${event.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        about: profile.about,
        isCurrentUser: event.pubkey === publicKey,
        // Keep original profile data for advanced use cases
        profile
      };
    });
  }, [feedEvents, profiles, publicKey]);

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
   * Extract distance from event tags with proper error handling and validation
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
      
      // Return in km for internal consistency (like Profile/Stats)
      return distanceInKm;
    } catch (err) {
      console.error('Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event is duplicate with comprehensive validation (reused from leaderboard)
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
        
        // Same distance within 0.05 km and within 10 minutes
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
   * Process events for feed display (chronological, not aggregated)
   * Enhanced with deduplication and robust error handling
   */
  const processEventsForFeed = useCallback((events, participantPaymentDates) => {
    try {
      const processedEvents = [];
      let duplicateCount = 0;
      let filteredCount = 0;
      
      events.forEach(event => {
        if (!event.pubkey) {
          filteredCount++;
          return;
        }
        
        // Filter by individual participant payment date
        const participantPaymentDate = participantPaymentDates.get(event.pubkey);
        if (!participantPaymentDate) {
          filteredCount++;
          return;
        }
        
        if (event.created_at < participantPaymentDate) {
          filteredCount++;
          return;
        }
        
        // Filter by global competition end date
        if (event.created_at > COMPETITION_END) {
          filteredCount++;
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
          filteredCount++;
          return;
        }
        
        const distance = extractDistance(event);
        if (distance <= 0) {
          filteredCount++;
          return;
        }

        // Check for duplicates using comprehensive validation
        if (isDuplicateEvent(event, processedEvents)) {
          duplicateCount++;
          return;
        }

        // Create feed-specific event object
        const feedEvent = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          content: event.content,
          tags: event.tags,
          distance: distance,
          activityType: eventActivityType,
          // Extract common feed display data for better UX
          title: event.tags?.find(tag => tag[0] === 'title')?.[1] || '',
          duration: event.tags?.find(tag => tag[0] === 'duration')?.[1] || '',
          // Add feed-specific metadata
          displayDistance: `${distance.toFixed(1)} km`,
          displayActivity: eventActivityType || 'activity',
          // Raw event for compatibility with existing PostList
          rawEvent: event
        };

        processedEvents.push(feedEvent);
      });
      
      // Log processing statistics for debugging
      console.log(`[useLeagueActivityFeed] Event processing complete:`, {
        total: events.length,
        processed: processedEvents.length,
        duplicates: duplicateCount,
        filtered: filteredCount,
        activityMode
      });
      
      // Sort by timestamp (newest first for feed)
      processedEvents.sort((a, b) => b.created_at - a.created_at);
      
      // Limit to feed size for optimal performance
      const limitedEvents = processedEvents.slice(0, FEED_LIMIT);
      
      console.log(`[useLeagueActivityFeed] Returning ${limitedEvents.length} feed events (${activityMode} mode)`);
      
      return limitedEvents;
    } catch (err) {
      console.error('Error processing events for feed:', err);
      return [];
    }
  }, [extractDistance, activityMode, COMPETITION_END, FEED_LIMIT, isDuplicateEvent]);

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
    feedEvents, // Raw feed events without profile data
    enhancedFeedEvents, // Feed events with profile metadata attached (Phase 4)
    isLoading,
    profilesLoading, // Separate loading state for profiles (Phase 4)
    error,
    refresh,
    lastUpdated,
    activityMode,
    loadingProgress
  };
}; 