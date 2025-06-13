import React from 'react';
import { useTeamActivity } from '../../hooks/useTeamActivity';
import { NostrWorkoutEvent } from '../../services/nostr/NostrTeamsService';
import { useProfiles } from '../../hooks/useProfiles';
import { DisplayName } from '../shared/DisplayName';

const Avatar: React.FC<{ src?: string; name?: string }> = ({ src, name }) => {
  if (src) return <img src={src} alt={name || 'avatar'} className="w-10 h-10 rounded-full" />;
  return (
    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  );
};

interface LeaderboardTabProps {
  workoutEvents: NostrWorkoutEvent[];
}

const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ workoutEvents }) => {
  try {
    const { rankedMembers } = useTeamActivity(workoutEvents || []);
    const pubkeys = rankedMembers?.map(m => m.pubkey) || [];
    const { profiles } = useProfiles(pubkeys);

    if (!rankedMembers || rankedMembers.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No activity recorded for this month's leaderboard yet.</p>
          <p className="text-gray-500 text-sm mt-2">Team members' workouts will appear here once they start logging runs.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">Monthly Leaderboard</h3>
        <div className="grid grid-cols-12 gap-3 p-3 font-bold text-gray-400 text-sm border-b border-gray-700">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Member</div>
          <div className="col-span-3 text-right">Distance</div>
          <div className="col-span-2 text-right">Runs</div>
        </div>
        {rankedMembers.map((member, index) => {
          const profile = profiles?.[member.pubkey];
          return (
            <div key={member.pubkey} className="grid grid-cols-12 gap-3 items-center bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
              <div className="col-span-1 text-lg font-bold text-blue-400">{index + 1}</div>
              <div className="col-span-6 flex items-center space-x-3">
                <Avatar src={profile?.image} name={profile?.displayName || profile?.name} />
                <DisplayName pubkey={member.pubkey} />
              </div>
              <div className="col-span-3 text-right font-semibold text-green-400">{member.totalDistance.toFixed(2)} km</div>
              <div className="col-span-2 text-right text-gray-300">{member.runCount}</div>
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    console.error('Error rendering leaderboard:', error);
    return (
      <div className="text-center py-8">
        <p className="text-red-400">Error loading leaderboard</p>
        <p className="text-gray-500 text-sm mt-2">Please try refreshing the page</p>
      </div>
    );
  }
};

export default LeaderboardTab; 