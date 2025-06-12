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
  const { rankedMembers } = useTeamActivity(workoutEvents);
  const { profiles } = useProfiles(rankedMembers.map(m => m.pubkey));

  if (rankedMembers.length === 0) {
    return <p className="text-gray-400">No activity recorded for this month's leaderboard yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 p-2 font-bold text-gray-400 text-sm">
        <div className="col-span-1">#</div>
        <div className="col-span-6">Member</div>
        <div className="col-span-3 text-right">Distance</div>
        <div className="col-span-2 text-right">Runs</div>
      </div>
      {rankedMembers.map((member, index) => {
        const profile = profiles[member.pubkey];
        return (
          <div key={member.pubkey} className="grid grid-cols-12 gap-2 items-center bg-gray-800 p-2 rounded-md">
            <div className="col-span-1 text-lg font-bold">{index + 1}</div>
            <div className="col-span-6 flex items-center space-x-3">
              <Avatar src={profile?.image} name={profile?.displayName || profile?.name} />
              <DisplayName pubkey={member.pubkey} profile={profile} />
            </div>
            <div className="col-span-3 text-right font-semibold">{member.totalDistance.toFixed(2)} km</div>
            <div className="col-span-2 text-right">{member.runCount}</div>
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardTab; 