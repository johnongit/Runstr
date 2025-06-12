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
  const distanceStr = getTagValue(event, 'distance');
  return distanceStr ? parseFloat(distanceStr) / 1000 : 0; // Assuming meters, convert to km
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