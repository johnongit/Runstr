// NEW FILE: src/hooks/useTeamRoles.ts
import { useEffect, useMemo, useState } from 'react';
import { useNostr } from './useNostr';
import {
  NostrTeamEvent,
  getTeamCaptain,
  getTeamMembers,
  fetchTeamMemberships,
} from '../services/nostr/NostrTeamsService';

/**
 * Combines member tags on the team event with Kind-33406 membership events
 * to derive role information for the current user.
 */
export const useTeamRoles = (
  teamEvent: NostrTeamEvent | null,
  teamAIdentifier: string | null,
) => {
  const { publicKey: currentUserPubkey, ndk, ndkReady } = useNostr() as any;
  const [membershipEventMembers, setMembershipEventMembers] = useState<string[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);

  // Captain & tag-based members from the replaceable team event
  const captainPubkey = teamEvent ? getTeamCaptain(teamEvent) : null;
  const taggedMembers = teamEvent ? getTeamMembers(teamEvent) : [];

  // Fetch membership events (Kind 33406) once NDK is ready
  useEffect(() => {
    const loadMemberships = async () => {
      if (!ndkReady || !ndk || !teamAIdentifier) {
        console.log('useTeamRoles: Not ready to fetch memberships', {
          ndkReady,
          ndk: !!ndk,
          teamAIdentifier
        });
        return;
      }
      
      setIsLoadingMemberships(true);
      try {
        console.log('useTeamRoles: Fetching membership events for team:', teamAIdentifier);
        const members = await fetchTeamMemberships(ndk, teamAIdentifier);
        console.log('useTeamRoles: Fetched membership events, found members:', members);
        setMembershipEventMembers(members);
      } catch (err) {
        console.warn('useTeamRoles: failed to fetch membership events', err);
        setMembershipEventMembers([]);
      } finally {
        setIsLoadingMemberships(false);
      }
    };
    
    loadMemberships();
  }, [ndk, ndkReady, teamAIdentifier]);

  // Combine all members and remove duplicates
  const members = useMemo(() => {
    const allMembers = Array.from(new Set([...taggedMembers, ...membershipEventMembers]));
    console.log('useTeamRoles: Combined members list:', {
      taggedMembers,
      membershipEventMembers,
      allMembers,
      currentUserPubkey
    });
    return allMembers;
  }, [taggedMembers, membershipEventMembers]);

  const isCaptain = !!currentUserPubkey && currentUserPubkey === captainPubkey;
  const isMember = !!currentUserPubkey && members.includes(currentUserPubkey);

  console.log('useTeamRoles: Role determination:', {
    currentUserPubkey,
    captainPubkey,
    isCaptain,
    isMember,
    membersCount: members.length,
    isLoadingMemberships
  });

  return { 
    members, 
    isCaptain, 
    isMember, 
    captainPubkey,
    isLoadingMemberships 
  } as const;
};
