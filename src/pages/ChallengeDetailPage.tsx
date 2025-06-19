import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr';
import { 
  subscribeToTeamChallenges,
  subscribeToTeamActivities,
  fetchChallengeActivityFeed,
  NostrWorkoutEvent 
} from '../services/nostr/NostrTeamsService';
import { NDKSubscription } from '@nostr-dev-kit/ndk';
import { Event as NostrEvent } from 'nostr-tools';
import toast from 'react-hot-toast';
import { DisplayName } from '../components/shared/DisplayName';
import { useProfiles } from '../hooks/useProfiles';

interface ChallengeDetailParams {
  captainPubkey: string;
  challengeUUID: string;
}

interface ParsedChallenge {
  id: string;
  uuid: string;
  name: string;
  description: string;
  goalValue?: string;
  goalUnit?: string;
  start?: number;
  end?: number;
  raw: NostrEvent;
}

interface ChallengeParticipant {
  pubkey: string;
  workouts: NostrWorkoutEvent[];
  totalDistance: number;
  totalRuns: number;
  progress: number; // percentage towards goal
}

const ChallengeDetailPage: React.FC = () => {
  const { captainPubkey, challengeUUID } = useParams<ChallengeDetailParams>();
  const navigate = useNavigate();
  const { ndk, ndkReady } = useNostr();
  
  const [challenge, setChallenge] = useState<ParsedChallenge | null>(null);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [challengeWorkouts, setChallengeWorkouts] = useState<NostrWorkoutEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const participantPubkeys = participants.map(p => p.pubkey);
  const { profiles } = useProfiles(participantPubkeys);

  // Parse challenge from Nostr event
  const parseChallenge = (evt: NostrEvent): ParsedChallenge => {
    const tag = (k: string) => evt.tags.find(t => t[0] === k)?.[1];
    const name = tag('name') || 'Unnamed Challenge';
    const description = tag('description') || evt.content;
    const goalValTag = evt.tags.find(t => t[0] === 'goal_value');
    const goalValue = goalValTag ? goalValTag[1] : undefined;
    const goalUnit = goalValTag ? goalValTag[2] : undefined;
    const uuid = tag('d') || '';
    const start = Number(tag('start')) || undefined;
    const end = Number(tag('end')) || undefined;
    return { id: evt.id, uuid, name, description, goalValue, goalUnit, start, end, raw: evt };
  };

  // Subscribe to challenge data
  useEffect(() => {
    if (!ndkReady || !captainPubkey || !challengeUUID) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    let challengeSub: NDKSubscription | null = null;

    const loadChallengeData = async () => {
      try {
        const teamAIdentifier = `33404:${captainPubkey}:*`; // We need the actual team UUID, but this is a start

        // Subscribe to challenges to find this specific challenge
        challengeSub = subscribeToTeamChallenges(ndk, teamAIdentifier, (evt: NostrEvent) => {
          const parsedChallenge = parseChallenge(evt);
          if (parsedChallenge.uuid === challengeUUID) {
            setChallenge(parsedChallenge);
          }
        });

        // Use the new enhanced fetchChallengeActivityFeed function
        console.log('Loading challenge workouts using enhanced query...');
        const workouts = await fetchChallengeActivityFeed(ndk, challengeUUID, 100);
        
        console.log(`Loaded ${workouts.length} challenge workouts`);
        setChallengeWorkouts(workouts);

      } catch (err) {
        console.error('Error setting up challenge subscriptions:', err);
        setError('Failed to load challenge data');
      }
    };

    loadChallengeData();
    setLoading(false);

    return () => {
      if (challengeSub) challengeSub.stop();
    };
  }, [ndk, ndkReady, captainPubkey, challengeUUID]);

  // Process workouts to calculate participant statistics
  useEffect(() => {
    if (!challengeWorkouts.length) {
      setParticipants([]);
      return;
    }

    const participantMap = new Map<string, {
      workouts: NostrWorkoutEvent[];
      totalDistance: number;
      totalRuns: number;
    }>();

    challengeWorkouts.forEach(workout => {
      if (!participantMap.has(workout.pubkey)) {
        participantMap.set(workout.pubkey, {
          workouts: [],
          totalDistance: 0,
          totalRuns: 0
        });
      }

      const participant = participantMap.get(workout.pubkey)!;
      participant.workouts.push(workout);
      participant.totalRuns++;

      // Extract distance from tags
      const distanceTag = workout.tags?.find(tag => tag[0] === 'distance');
      if (distanceTag && distanceTag[1]) {
        const distance = parseFloat(distanceTag[1]);
        if (!isNaN(distance)) {
          participant.totalDistance += distance;
        }
      }
    });

    // Convert to array and calculate progress
    const challengeGoal = challenge?.goalValue ? parseFloat(challenge.goalValue) : 0;
    const participantList: ChallengeParticipant[] = Array.from(participantMap.entries()).map(([pubkey, data]) => ({
      pubkey,
      workouts: data.workouts,
      totalDistance: data.totalDistance,
      totalRuns: data.totalRuns,
      progress: challengeGoal > 0 ? Math.min((data.totalDistance / challengeGoal) * 100, 100) : 0
    }));

    // Sort by total distance (highest first)
    participantList.sort((a, b) => b.totalDistance - a.totalDistance);

    setParticipants(participantList);
  }, [challengeWorkouts, challenge]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatDistance = (distance: number, unit?: string) => {
    return `${distance.toFixed(2)} ${unit || 'km'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <p className="text-text-muted">Loading challenge details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-bg-primary p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 text-primary hover:text-primary-hover transition-colors"
          >
            ← Back
          </button>
          <div className="text-center py-8">
            <p className="text-error">{error || 'Challenge not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 text-primary hover:text-primary-hover transition-colors"
          >
            ← Back to Team
          </button>
          
          <div className="bg-bg-secondary border border-border-secondary rounded-lg p-6">
            <h1 className="text-2xl font-bold text-text-primary mb-3">{challenge.name}</h1>
            <p className="text-text-secondary mb-4">{challenge.description}</p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              {challenge.goalValue && challenge.goalUnit && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Goal:</span>
                  <span className="px-3 py-1 bg-primary text-white rounded-full">
                    {challenge.goalValue} {challenge.goalUnit}
                  </span>
                </div>
              )}
              
              {challenge.start && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Start:</span>
                  <span className="text-text-primary">{formatDate(challenge.start)}</span>
                </div>
              )}
              
              {challenge.end && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">End:</span>
                  <span className="text-text-primary">{formatDate(challenge.end)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-bg-secondary border border-border-secondary rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Participants ({participants.length})
          </h2>
          
          {participants.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted">No participants yet.</p>
              <p className="text-text-muted text-sm mt-2">Be the first to complete a workout for this challenge!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant, index) => {
                const profile = profiles?.[participant.pubkey];
                return (
                  <div key={participant.pubkey} className="border border-border-secondary rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <DisplayName pubkey={participant.pubkey} />
                          <div className="text-sm text-text-muted">
                            {participant.totalRuns} workout{participant.totalRuns !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold text-success">
                          {formatDistance(participant.totalDistance, challenge.goalUnit)}
                        </div>
                        {challenge.goalValue && (
                          <div className="text-sm text-text-muted">
                            {participant.progress.toFixed(1)}% of goal
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    {challenge.goalValue && (
                      <div className="w-full bg-bg-tertiary rounded-full h-2 mb-3">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(participant.progress, 100)}%` }}
                        />
                      </div>
                    )}
                    
                    {/* Recent workouts */}
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-text-primary mb-2">Recent Workouts:</h4>
                      <div className="space-y-1">
                        {participant.workouts.slice(0, 3).map(workout => {
                          const workoutDistance = workout.tags?.find(tag => tag[0] === 'distance');
                          const workoutDate = new Date((workout.created_at || 0) * 1000);
                          
                          return (
                            <div key={workout.id} className="text-xs text-text-muted flex justify-between">
                              <span>{workoutDate.toLocaleDateString()}</span>
                              {workoutDistance && (
                                <span>{workoutDistance[1]} {workoutDistance[2] || 'km'}</span>
                              )}
                            </div>
                          );
                        })}
                        {participant.workouts.length > 3 && (
                          <div className="text-xs text-text-muted">
                            +{participant.workouts.length - 3} more workout{participant.workouts.length - 3 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-bg-secondary border border-border-secondary rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Recent Challenge Activity
          </h2>
          
          {challengeWorkouts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted">No workouts recorded for this challenge yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {challengeWorkouts.slice(0, 10).map(workout => {
                const profile = profiles?.[workout.pubkey];
                const distanceTag = workout.tags?.find(tag => tag[0] === 'distance');
                const workoutDate = new Date((workout.created_at || 0) * 1000);
                
                return (
                  <div key={workout.id} className="border border-border-secondary rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <DisplayName pubkey={workout.pubkey} />
                        <div className="text-sm text-text-muted">
                          {workoutDate.toLocaleDateString()} at {workoutDate.toLocaleTimeString()}
                        </div>
                      </div>
                      {distanceTag && (
                        <div className="text-success font-semibold">
                          {distanceTag[1]} {distanceTag[2] || 'km'}
                        </div>
                      )}
                    </div>
                    {workout.content && (
                      <div className="text-sm text-text-secondary mt-2">
                        {workout.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailPage; 