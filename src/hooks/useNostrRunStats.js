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

    events.forEach(ev => {
      // distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
      const distTag = ev.tags?.find(t => t[0] === 'distance');
      if (distTag) {
        const val = parseFloat(distTag[1]);
        const unit = distTag[2] || 'km';
        if (!isNaN(val)) {
          totalDistance += unit === 'km' ? val : (val * 1.609344);
        }
      }
      const durTag = ev.tags?.find(t => t[0] === 'duration');
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
    });

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