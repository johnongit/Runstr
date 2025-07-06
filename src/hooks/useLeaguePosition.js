import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useLeaguePosition
 * Fetches user's Kind 1301 workout records and calculates their position
 * on the League course (~805 km total). ALL runs count toward progress.
 * 
 * @returns {Object} { totalDistance, mapPosition, qualifyingRuns, isLoading, error }
 */
export const useLeaguePosition = () => {
  const { publicKey: userPubkey } = useContext(NostrContext);
  const [totalDistance, setTotalDistance] = useState(0); // in km
  const [mapPosition, setMapPosition] = useState(0); // percentage (0-100)
  const [qualifyingRuns, setQualifyingRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Constants
  const COURSE_TOTAL_KM = 500 * 1.609344; // 500 miles converted to km (~804.7 km)
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Calculate total distance from 1301 workout events
   * ALL runs count - no minimum distance threshold
   */
  const calculateDistanceFromEvents = useCallback((events) => {
    if (!events || events.length === 0) {
      return { totalKm: 0, runs: [] };
    }

    let totalKm = 0;
    const runs = [];

    events.forEach(event => {
      // Extract distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      
      if (distanceTag && distanceTag[1]) {
        const distanceValue = parseFloat(distanceTag[1]);
        const unit = distanceTag[2] || 'km'; // default to km if no unit specified
        
        if (!isNaN(distanceValue) && distanceValue > 0) {
          // Add reasonable bounds checking to filter out corrupted data
          const MAX_REASONABLE_DISTANCE_KM = 500; // 500km covers ultramarathons
          const MIN_REASONABLE_DISTANCE_KM = 0.01; // 10 meters minimum
          
          // Convert to km first for validation
          let distanceInKm = distanceValue;
          if (unit === 'mi' || unit === 'mile' || unit === 'miles') {
            distanceInKm = distanceValue * 1.609344;
          } else if (unit === 'm' || unit === 'meter' || unit === 'meters') {
            distanceInKm = distanceValue / 1000;
          }
          
          // Validate reasonable range
          if (distanceInKm < MIN_REASONABLE_DISTANCE_KM || distanceInKm > MAX_REASONABLE_DISTANCE_KM) {
            console.warn(`Invalid distance detected: ${distanceValue} ${unit} (${distanceInKm.toFixed(2)}km) - filtering out event ${event.id}`);
            return; // Skip this event
          }
          
          // Keep in km for consistent calculation (like Profile/Stats)
          totalKm += distanceInKm;
          
          // Store run data for reference
          runs.push({
            id: event.id,
            distance: distanceInKm,
            originalDistance: distanceValue,
            unit: unit,
            timestamp: event.created_at,
            event: event
          });
        }
      }
    });

    return {
      totalKm: Math.round(totalKm * 100) / 100, // Round to 2 decimal places (now in km)
      runs: runs.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    };
  }, []);

  /**
   * Convert total distance to map position percentage
   */
  const calculateMapPosition = useCallback((totalKm) => {
    const percentage = (totalKm / COURSE_TOTAL_KM) * 100;
    return Math.min(100, Math.max(0, percentage)); // Clamp between 0-100
  }, []);

  /**
   * Fetch and process 1301 workout events
   */
  const fetchLeaguePosition = useCallback(async () => {
    if (!userPubkey) {
      setError('No user public key available');
      return;
    }

    // Check cache validity
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION_MS && totalDistance > 0) {
      return; // Use cached data
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all 1301 workout events for the user
      const eventSet = await fetchEvents({ 
        kinds: [1301], 
        authors: [userPubkey], 
        limit: 1000 
      });
      
      // Convert Set to Array and extract raw events
      const events = Array.from(eventSet).map(e => e.rawEvent ? e.rawEvent() : e);
      
      // Calculate distance and position
      const { totalKm, runs } = calculateDistanceFromEvents(events);
      const position = calculateMapPosition(totalKm);
      
      // Update state
      setTotalDistance(totalKm);
      setMapPosition(position);
      setQualifyingRuns(runs);
      setLastFetchTime(now);
      
      console.log(`[useLeaguePosition] Total distance: ${totalKm} km, Position: ${position.toFixed(1)}%`);
      
    } catch (err) {
      console.error('[useLeaguePosition] Error fetching position:', err);
      setError(err.message || 'Failed to fetch league position');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, calculateDistanceFromEvents, calculateMapPosition, lastFetchTime, totalDistance]);

  /**
   * Force refresh position data (bypass cache)
   */
  const refreshPosition = useCallback(async () => {
    setLastFetchTime(0); // Clear cache
    await fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  // Initial fetch when component mounts or pubkey changes
  useEffect(() => {
    fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  // Calculate additional derived values
  const kmRemaining = Math.max(0, COURSE_TOTAL_KM - totalDistance);
  const isComplete = totalDistance >= COURSE_TOTAL_KM;
  const progressPercentage = mapPosition;

  return {
    // Core data
    totalDistance,        // Total km accumulated from ALL runs
    mapPosition,         // Position percentage on course (0-100)
    qualifyingRuns,      // Array of run data that contributed to position
    
    // Derived values
    kmRemaining,         // Km left to complete the course
    isComplete,          // Whether user has completed the course
    progressPercentage,  // Same as mapPosition, for convenience
    
    // Meta
    isLoading,
    error,
    lastFetchTime,
    
    // Actions
    refresh: refreshPosition,
    refetch: fetchLeaguePosition
  };
}; 