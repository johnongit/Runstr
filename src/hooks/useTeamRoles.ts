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

  // Captain & tag-based members from the replaceable team event
  const captainPubkey = teamEvent ? getTeamCaptain(teamEvent) : null;
  const taggedMembers = teamEvent ? getTeamMembers(teamEvent) : [];

  // Fetch membership events (Kind 33406) once NDK is ready
  useEffect(() => {
    const loadMemberships = async () => {
      if (!ndkReady || !ndk || !teamAIdentifier) return;
      try {
        const members = await fetchTeamMemberships(ndk, teamAIdentifier);
        setMembershipEventMembers(members);
      } catch (err) {
        console.warn('useTeamRoles: failed to fetch membership events', err);
      }
    };
    loadMemberships();
  }, [ndk, ndkReady, teamAIdentifier]);

  const members = useMemo(() => {
    return Array.from(new Set([...taggedMembers, ...membershipEventMembers]));
  }, [taggedMembers, membershipEventMembers]);

  const isCaptain = !!currentUserPubkey && currentUserPubkey === captainPubkey;
  const isMember = !!currentUserPubkey && members.includes(currentUserPubkey);

  return { members, isCaptain, isMember, captainPubkey } as const;
};
