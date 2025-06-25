import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNostr } from '../hooks/useNostr';
import { 
  fetchUserMemberTeams, 
  fetchTeamChallenges,
  NostrTeamEvent 
} from '../services/nostr/NostrTeamsService';

interface TeamChallengeContextValue {
  userTeams: NostrTeamEvent[];
  activeChallenges: any[];
  teamChallengeMap: Map<string, any[]>;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const TeamChallengeContext = createContext<TeamChallengeContextValue | undefined>(undefined);

interface TeamChallengeProviderProps {
  children: ReactNode;
}

export const TeamChallengeProvider: React.FC<TeamChallengeProviderProps> = ({ children }) => {
  const { ndk, publicKey, ndkReady } = useNostr();
  const [userTeams, setUserTeams] = useState<NostrTeamEvent[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);
  const [teamChallengeMap, setTeamChallengeMap] = useState<Map<string, any[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!ndkReady || !ndk || !publicKey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch user's teams
      const teams = await fetchUserMemberTeams(ndk, publicKey);
      setUserTeams(teams);

      // Fetch challenges for each team and build a map
      const challengeMap = new Map();
      const allActiveChallenges: any[] = [];

      for (const team of teams) {
        const teamAIdentifier = `33404:${team.pubkey}:${team.tags.find(t => t[0] === 'd')?.[1]}`;
        try {
          const challenges = await fetchTeamChallenges(ndk, teamAIdentifier);
          
          // Filter for active challenges (not completed)
          const activeChallenges = challenges.filter(challenge => {
            const statusTag = challenge.tags.find(t => t[0] === 'status');
            return !statusTag || statusTag[1] !== 'completed';
          });

          challengeMap.set(teamAIdentifier, activeChallenges);
          allActiveChallenges.push(...activeChallenges);
        } catch (err) {
          console.warn(`Failed to fetch challenges for team ${teamAIdentifier}:`, err);
        }
      }

      setTeamChallengeMap(challengeMap);
      setActiveChallenges(allActiveChallenges);
    } catch (err) {
      console.error('Error loading user teams and challenges:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team and challenge data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [ndk, publicKey, ndkReady]);

  const refreshData = async () => {
    await loadUserData();
  };

  const value: TeamChallengeContextValue = {
    userTeams,
    activeChallenges,
    teamChallengeMap,
    isLoading,
    error,
    refreshData
  };

  return (
    <TeamChallengeContext.Provider value={value}>
      {children}
    </TeamChallengeContext.Provider>
  );
};

export const useTeamChallenge = (): TeamChallengeContextValue => {
  const context = useContext(TeamChallengeContext);
  if (context === undefined) {
    throw new Error('useTeamChallenge must be used within a TeamChallengeProvider');
  }
  return context;
}; 