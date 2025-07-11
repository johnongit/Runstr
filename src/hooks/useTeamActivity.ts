import { useMemo } from 'react';
import { NostrWorkoutEvent } from '../services/nostr/NostrTeamsService';

export interface RankedMember {
  pubkey: string;
  totalDistance: number;
  runCount: number;
}

// Helper to extract a tag value by key
const getTagValue = (event: NostrWorkoutEvent, key: string): string | undefined => {
  const tag = event.tags.find(t => t[0] === key);
  return tag ? tag[1] : undefined;
};

const getDistance = (event: NostrWorkoutEvent): number => {
  const distanceTag = event.tags.find(t => t[0] === 'distance');
  if (!distanceTag) return 0;
  const raw = parseFloat(distanceTag[1]);
  const unit = distanceTag[2] || 'km'; // default km
  if (isNaN(raw)) return 0;
  
  // Add reasonable bounds checking to filter out corrupted data
  const MAX_REASONABLE_DISTANCE_KM = 500; // 500km covers ultramarathons
  const MIN_REASONABLE_DISTANCE_KM = 0.01; // 10 meters minimum
  
  // Convert to km first for validation
  let distanceInKm = raw;
  if (unit === 'mi' || unit === 'mile' || unit === 'miles') {
    distanceInKm = raw * 1.609344;
  } else if (unit === 'm' || unit === 'meter' || unit === 'meters') {
    distanceInKm = raw / 1000;
  }
  
  // Validate reasonable range
  if (distanceInKm < MIN_REASONABLE_DISTANCE_KM || distanceInKm > MAX_REASONABLE_DISTANCE_KM) {
    console.warn(`Invalid distance detected: ${raw} ${unit} (${distanceInKm.toFixed(2)}km) - filtering out event ${event.id}`);
    return 0;
  }
  
  return distanceInKm; // return in km for unified leaderboard
};

export const useTeamActivity = (workoutEvents: NostrWorkoutEvent[]) => {
  const teamStats = useMemo(() => {
    if (!workoutEvents || workoutEvents.length === 0) {
      return {
        totalTeamDistance: 0,
        rankedMembers: [],
      };
    }

    const memberStats: Record<string, { totalDistance: number; runCount: number }> = {};
    let totalTeamDistance = 0;

    for (const event of workoutEvents) {
      const distance = getDistance(event);
      totalTeamDistance += distance;

      if (!memberStats[event.pubkey]) {
        memberStats[event.pubkey] = { totalDistance: 0, runCount: 0 };
      }
      memberStats[event.pubkey].totalDistance += distance;
      memberStats[event.pubkey].runCount += 1;
    }

    const rankedMembers: RankedMember[] = Object.entries(memberStats)
      .map(([pubkey, stats]) => ({
        pubkey,
        ...stats,
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance);

    return { totalTeamDistance, rankedMembers };
  }, [workoutEvents]);

  return teamStats;
}; 