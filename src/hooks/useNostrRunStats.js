import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useNostrRunStats
 * Fetches all Kind 1301 workout records for the logged-in user and returns
 * aggregated statistics plus the raw events for further UI needs.
 */
export const useNostrRunStats = () => {
  const { publicKey: userPubkey } = useContext(NostrContext);
  const [workoutEvents, setWorkoutEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const aggregateStats = useCallback((events) => {
    if (!events || events.length === 0) return null;
    let totalDistance = 0; // metres or converted unit value based on unit tag
    let totalDuration = 0; // seconds
    let elevationGain = 0;
    let firstTimestamp = null;
    let latestTimestamp = null;

    // Personal bests tracking
    const personalBests = {
      '1k': null,    // fastest 1k time
      '5k': null,    // fastest 5k time  
      '10k': null    // fastest 10k time
    };

    // For streak calculation
    const workoutDates = new Set();

    events.forEach(ev => {
      // distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
      const distTag = ev.tags?.find(t => t[0] === 'distance');
      const durTag = ev.tags?.find(t => t[0] === 'duration');
      
      if (distTag) {
        const val = parseFloat(distTag[1]);
        const unit = distTag[2] || 'km';
        if (!isNaN(val)) {
          totalDistance += unit === 'km' ? val : (val * 1.609344);
        }

        // Calculate personal bests for specific distances
        if (durTag && !isNaN(val)) {
          const parts = durTag[1].split(':').map(Number);
          if (parts.length === 3) {
            const durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            const distanceKm = unit === 'km' ? val : (val * 1.609344);
            
            // Check for personal bests (allowing some tolerance for GPS variations)
            const checkPB = (targetDistance, tolerance = 0.1) => {
              if (Math.abs(distanceKm - targetDistance) <= tolerance) {
                const pacePerKm = durationSeconds / distanceKm; // seconds per km
                const currentPB = personalBests[`${targetDistance}k`];
                if (!currentPB || pacePerKm < currentPB.pacePerKm) {
                  personalBests[`${targetDistance}k`] = {
                    time: durationSeconds,
                    pacePerKm: pacePerKm,
                    date: ev.created_at
                  };
                }
              }
            };

            checkPB(1);   // 1k
            checkPB(5);   // 5k  
            checkPB(10);  // 10k
          }
        }
      }

      if (durTag) {
        // duration formatted HH:MM:SS
        const parts = durTag[1].split(':').map(Number);
        if (parts.length === 3) {
          const secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          totalDuration += secs;
        }
      }

      const elevTag = ev.tags?.find(t => t[0] === 'elevation_gain');
      if (elevTag) {
        const val = parseFloat(elevTag[1]);
        if (!isNaN(val)) {
          elevationGain += val; // unit agnostic, UI can decide
        }
      }

      const ts = ev.created_at || 0;
      if (firstTimestamp === null || ts < firstTimestamp) firstTimestamp = ts;
      if (latestTimestamp === null || ts > latestTimestamp) latestTimestamp = ts;

      // Add workout date for streak calculation (using date string to avoid timezone issues)
      const workoutDate = new Date(ts * 1000).toDateString();
      workoutDates.add(workoutDate);
    });

    // Calculate longest streak
    const calculateLongestStreak = () => {
      if (workoutDates.size === 0) return 0;
      
      const dates = Array.from(workoutDates)
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => a - b);
      
      let longestStreak = 1;
      let currentStreak = 1;
      
      for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // Consecutive day
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (diffDays > 1) {
          // Gap in streak
          currentStreak = 1;
        }
        // If diffDays === 0, it's the same day, so don't change streak
      }
      
      return longestStreak;
    };

    const totalRuns = events.length;
    const avgDistance = totalRuns > 0 ? totalDistance / totalRuns : 0;
    const avgDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

    return {
      totalRuns,
      totalDistanceKm: totalDistance, // always km for consistency
      totalDurationSeconds: totalDuration,
      elevationGain,
      avgDistanceKm: avgDistance,
      avgDurationSeconds: avgDuration,
      firstWorkout: firstTimestamp,
      lastWorkout: latestTimestamp,
      personalBests,
      longestStreak: calculateLongestStreak(),
    };
  }, []);

  const loadEvents = useCallback(async () => {
    if (!userPubkey) {
      setError('No user pubkey');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const evSet = await fetchEvents({ kinds: [1301], authors: [userPubkey], limit: 1000 });
      const evArr = Array.from(evSet).map(e => e.rawEvent ? e.rawEvent() : e);
      setWorkoutEvents(evArr);
      setStats(aggregateStats(evArr));
    } catch (err) {
      console.error('useNostrRunStats fetch error', err);
      setError(err.message || 'Fetch error');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, aggregateStats]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { workoutEvents, stats, isLoading, error, reload: loadEvents };
}; 