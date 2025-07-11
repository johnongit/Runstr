import { useMemo, useState, useEffect } from 'react';
import enhancedSeasonPassService from '../services/enhancedSeasonPassService';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useRecentActivity
 * Processes recent feed events to provide real-time activity deltas
 * Works with existing feedPosts to avoid additional network calls
 * Returns activity since a given cutoff timestamp
 * 
 * @param {Array} feedPosts - Recent feed posts from useLeagueActivityFeed
 * @param {number} cutoffTimestamp - Only count events after this timestamp
 * @returns {Object} { recentActivity, totalRecentEvents }
 */
export const useRecentActivity = (feedPosts = [], cutoffTimestamp = null) => {
  const { mode: activityMode } = useActivityMode();
  const [participants, setParticipants] = useState([]);

  // Global competition date range from rewardsConfig
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

  // Load participants from enhanced service
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const mergedParticipants = await enhancedSeasonPassService.getParticipants();
        setParticipants(mergedParticipants);
      } catch (error) {
        console.error('[RecentActivity] Error loading participants:', error);
        setParticipants([]);
      }
    };

    loadParticipants();
  }, []);

  /**
   * Extract and validate distance from workout event
   */
  const extractDistance = (event) => {
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
        console.warn(`[useRecentActivity] Invalid distance: ${value} ${unit} - filtering out`);
        return 0;
      }
      
      // Return in miles for consistency
      return distanceInKm * 0.621371;
    } catch (err) {
      console.error('[useRecentActivity] Error extracting distance:', err);
      return 0;
    }
  };

  /**
   * Check if event matches current activity mode
   */
  const matchesActivityMode = (event) => {
    const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
    const eventActivityType = exerciseTag?.[1]?.toLowerCase();
    
    const activityMatches = {
      'run': ['run', 'running', 'jog', 'jogging'],
      'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
      'walk': ['walk', 'walking', 'hike', 'hiking']
    };
    
    const acceptedActivities = activityMatches[activityMode] || ['run', 'running', 'jog', 'jogging'];
    
    return !eventActivityType || acceptedActivities.includes(eventActivityType);
  };

  /**
   * Process recent feed events into activity deltas
   */
  const recentActivity = useMemo(() => {
    if (!feedPosts || feedPosts.length === 0) {
      console.log('[useRecentActivity] No feed posts to process');
      return [];
    }

    if (participants.length === 0) {
      console.log('[useRecentActivity] No participants loaded yet');
      return [];
    }

    console.log(`[useRecentActivity] Processing ${feedPosts.length} recent feed events`);
    console.log(`[useRecentActivity] Cutoff timestamp: ${cutoffTimestamp ? new Date(cutoffTimestamp * 1000).toISOString() : 'none'}`);

    // Use enhanced service participants (from both localStorage and Nostr)
    const participantSet = new Set(participants);

    // Aggregate recent activity by participant
    const activityMap = new Map();

    let processedCount = 0;
    feedPosts.forEach(event => {
      // Only process events from season pass participants
      if (!participantSet.has(event.pubkey)) {
        return;
      }

      // Validate event is within global competition dates
      if (event.created_at < COMPETITION_START || event.created_at > COMPETITION_END) {
        return;
      }

      // Only count events after cutoff timestamp (if provided)
      if (cutoffTimestamp && event.created_at <= cutoffTimestamp) {
        return;
      }

      // Filter by activity mode
      if (!matchesActivityMode(event)) {
        return;
      }

      const distance = extractDistance(event);
      if (distance <= 0) return;

      // Add to activity map
      if (!activityMap.has(event.pubkey)) {
        activityMap.set(event.pubkey, {
          pubkey: event.pubkey,
          recentMiles: 0,
          recentRunCount: 0,
          recentRuns: []
        });
      }

      const activity = activityMap.get(event.pubkey);
      activity.recentMiles += distance;
      activity.recentRunCount++;
      activity.recentRuns.push({
        distance,
        timestamp: event.created_at,
        eventId: event.id,
        activityType: event.tags?.find(tag => tag[0] === 'exercise')?.[1]?.toLowerCase()
      });

      processedCount++;
    });

    // Convert to array
    const recentActivityArray = Array.from(activityMap.values())
      .map(activity => ({
        ...activity,
        recentMiles: Math.round(activity.recentMiles * 100) / 100
      }));

    console.log(`[useRecentActivity] Processed ${processedCount} recent events for ${recentActivityArray.length} participants`);
    recentActivityArray.forEach(a => {
      console.log(`  ${a.pubkey.slice(0, 8)}: +${a.recentMiles} mi, +${a.recentRunCount} runs (recent)`);
    });

    return recentActivityArray;
  }, [feedPosts, cutoffTimestamp, activityMode, participants, COMPETITION_START, COMPETITION_END]);

  return {
    recentActivity,
    totalRecentEvents: recentActivity.reduce((sum, a) => sum + a.recentRunCount, 0)
  };
}; 