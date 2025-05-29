// Fitness Teams Hook - Hybrid NIP-29 + NIP-101e Implementation
import { useState, useEffect, useCallback, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { ndk, awaitNDKReady } from '../lib/ndkSingleton';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import { ensureRelays } from '../utils/relays';
import { useProfileCache } from './useProfileCache';

// Extended NIP-101e kinds (from TheWildHustle's suggestion)
const FITNESS_KINDS = {
  EXERCISE_TEMPLATE: 33401,
  WORKOUT_TEMPLATE: 33402,
  FITNESS_TEAM: 33404,      // Extended NIP-101e
  FITNESS_CHALLENGE: 33403, // Extended NIP-101e
  FITNESS_EVENT: 33405,     // Extended NIP-101e
  WORKOUT_RECORD: 1301,
  NIP29_GROUP: 39000,
  NIP29_MESSAGE: 9
};

export const useFitnessTeams = () => {
  const { pubkey, isInitialized } = useContext(NostrContext);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { fetchProfiles } = useProfileCache();
  
  // Fetch user's teams
  const fetchMyTeams = useCallback(async () => {
    if (!isInitialized || !pubkey) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await awaitNDKReady();
      await ensureRelays([]);
      
      // Fetch NIP-101e fitness teams
      const fitnessTeamFilter = {
        kinds: [FITNESS_KINDS.FITNESS_TEAM],
        '#member': [pubkey]
      };
      
      // Also fetch teams where user is creator
      const createdTeamsFilter = {
        kinds: [FITNESS_KINDS.FITNESS_TEAM],
        authors: [pubkey]
      };
      
      // Fetch NIP-29 groups for compatibility
      const nip29Filter = {
        kinds: [FITNESS_KINDS.NIP29_GROUP],
        '#p': [pubkey]
      };
      
      const [fitnessTeams, createdTeams, nip29Groups] = await Promise.all([
        ndk.fetchEvents(fitnessTeamFilter),
        ndk.fetchEvents(createdTeamsFilter),
        ndk.fetchEvents(nip29Filter)
      ]);
      
      // Process all teams
      const allTeams = new Map();
      
      // Process fitness teams
      [...fitnessTeams, ...createdTeams].forEach(event => {
        const team = processFitnessTeam(event);
        if (team) allTeams.set(team.id, team);
      });
      
      // Process NIP-29 groups
      nip29Groups.forEach(event => {
        const group = processNip29Group(event);
        if (group && !allTeams.has(group.id)) {
          allTeams.set(group.id, group);
        }
      });
      
      // Fetch profiles for team creators
      const creatorPubkeys = Array.from(allTeams.values()).map(team => team.creatorPubkey);
      const profiles = await fetchProfiles(creatorPubkeys);
      
      // Enrich teams with creator profiles
      const enrichedTeams = Array.from(allTeams.values()).map(team => ({
        ...team,
        creatorProfile: profiles.get(team.creatorPubkey) || {}
      }));
      
      setTeams(enrichedTeams);
      
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, pubkey, fetchProfiles]);
  
  // Process NIP-101e fitness team
  const processFitnessTeam = (event) => {
    try {
      const metadata = JSON.parse(event.content);
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      
      if (!dTag) return null;
      
      return {
        id: `${event.kind}:${event.pubkey}:${dTag}`,
        type: 'fitness',
        name: metadata.name || 'Unnamed Team',
        description: metadata.about || '',
        picture: metadata.picture || '',
        location: metadata.location || '',
        teamType: metadata.type || 'running_club',
        creatorPubkey: event.pubkey,
        created_at: event.created_at,
        memberCount: event.tags.filter(t => t[0] === 'member').length,
        isPublic: metadata.public !== false,
        nip29GroupId: null, // Will be linked if exists
        raw: event
      };
    } catch (err) {
      console.error('Error processing fitness team:', err);
      return null;
    }
  };
  
  // Process NIP-29 group
  const processNip29Group = (event) => {
    try {
      const metadata = JSON.parse(event.content);
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      
      if (!dTag) return null;
      
      return {
        id: `${event.kind}:${event.pubkey}:${dTag}`,
        type: 'nip29',
        name: metadata.name || 'Unnamed Group',
        description: metadata.about || '',
        picture: metadata.picture || '',
        creatorPubkey: event.pubkey,
        created_at: event.created_at,
        naddr: nip19.naddrEncode({
          identifier: dTag,
          pubkey: event.pubkey,
          kind: event.kind,
          relays: ['wss://groups.0xchat.com']
        }),
        raw: event
      };
    } catch (err) {
      console.error('Error processing NIP-29 group:', err);
      return null;
    }
  };
  
  // Create a new team with both NIP-101e and NIP-29 support
  const createTeam = useCallback(async (teamData) => {
    if (!isInitialized || !pubkey) {
      throw new Error('Not connected to Nostr');
    }
    
    try {
      const teamId = generateSecretKey().toString('hex').slice(0, 16);
      
      // Create NIP-101e fitness team
      const fitnessTeamEvent = new NDKEvent(ndk);
      fitnessTeamEvent.kind = FITNESS_KINDS.FITNESS_TEAM;
      fitnessTeamEvent.content = JSON.stringify({
        name: teamData.name,
        about: teamData.description || '',
        picture: teamData.picture || '',
        type: teamData.teamType || 'running_club',
        location: teamData.location || '',
        public: teamData.isPublic !== false
      });
      
      fitnessTeamEvent.tags = [
        ['d', teamId],
        ['name', teamData.name],
        ['type', teamData.teamType || 'running_club'],
        ['captain', pubkey],
        ['member', pubkey],
        ['public', teamData.isPublic ? 'true' : 'false'],
        ['t', 'team'],
        ['t', 'running']
      ];
      
      await fitnessTeamEvent.publish();
      
      // Create linked NIP-29 group if requested
      if (teamData.createNip29Group) {
        const nip29Event = new NDKEvent(ndk);
        nip29Event.kind = FITNESS_KINDS.NIP29_GROUP;
        nip29Event.content = JSON.stringify({
          name: teamData.name,
          about: teamData.description || '',
          picture: teamData.picture || ''
        });
        
        nip29Event.tags = [
          ['d', teamId + '_chat'], // Link to fitness team
          ['p', pubkey, 'admin'],
          ['fitness_team', `${FITNESS_KINDS.FITNESS_TEAM}:${pubkey}:${teamId}`]
        ];
        
        await nip29Event.publish();
      }
      
      // Refresh teams list
      await fetchMyTeams();
      
      return teamId;
      
    } catch (err) {
      console.error('Error creating team:', err);
      throw err;
    }
  }, [isInitialized, pubkey, fetchMyTeams]);
  
  // Join a team
  const joinTeam = useCallback(async (teamId) => {
    if (!isInitialized || !pubkey) {
      throw new Error('Not connected to Nostr');
    }
    
    try {
      // Parse team ID (format: kind:pubkey:identifier)
      const [kind, teamPubkey, identifier] = teamId.split(':');
      
      if (parseInt(kind) === FITNESS_KINDS.FITNESS_TEAM) {
        // Join fitness team by publishing an update event
        const joinEvent = new NDKEvent(ndk);
        joinEvent.kind = FITNESS_KINDS.FITNESS_TEAM;
        joinEvent.content = JSON.stringify({
          action: 'join',
          team: teamId
        });
        joinEvent.tags = [
          ['d', `join_${identifier}_${Date.now()}`],
          ['a', teamId],
          ['p', pubkey]
        ];
        
        await joinEvent.publish();
      }
      
      // Refresh teams
      await fetchMyTeams();
      
    } catch (err) {
      console.error('Error joining team:', err);
      throw err;
    }
  }, [isInitialized, pubkey, fetchMyTeams]);
  
  // Search for teams
  const searchTeams = useCallback(async (query) => {
    if (!isInitialized) return [];
    
    try {
      await awaitNDKReady();
      
      const filter = {
        kinds: [FITNESS_KINDS.FITNESS_TEAM],
        search: query,
        limit: 20
      };
      
      const events = await ndk.fetchEvents(filter);
      
      const teams = [];
      const creatorPubkeys = new Set();
      
      events.forEach(event => {
        const team = processFitnessTeam(event);
        if (team) {
          teams.push(team);
          creatorPubkeys.add(team.creatorPubkey);
        }
      });
      
      // Fetch profiles
      const profiles = await fetchProfiles(Array.from(creatorPubkeys));
      
      // Enrich with profiles
      return teams.map(team => ({
        ...team,
        creatorProfile: profiles.get(team.creatorPubkey) || {}
      }));
      
    } catch (err) {
      console.error('Error searching teams:', err);
      return [];
    }
  }, [isInitialized, fetchProfiles]);
  
  // Get team details including members and activities
  const getTeamDetails = useCallback(async (teamId) => {
    if (!isInitialized) return null;
    
    try {
      await awaitNDKReady();
      
      // Parse team ID
      const [kind, teamPubkey, identifier] = teamId.split(':');
      
      // Fetch team metadata
      const metadataFilter = {
        kinds: [parseInt(kind)],
        authors: [teamPubkey],
        '#d': [identifier]
      };
      
      const metadataEvent = await ndk.fetchEvent(metadataFilter);
      if (!metadataEvent) return null;
      
      const team = processFitnessTeam(metadataEvent);
      if (!team) return null;
      
      // Fetch recent team activities
      const activitiesFilter = {
        kinds: [FITNESS_KINDS.WORKOUT_RECORD],
        '#a': [teamId],
        limit: 20
      };
      
      const activities = await ndk.fetchEvents(activitiesFilter);
      
      // Fetch team challenges
      const challengesFilter = {
        kinds: [FITNESS_KINDS.FITNESS_CHALLENGE],
        '#team': [teamId]
      };
      
      const challenges = await ndk.fetchEvents(challengesFilter);
      
      // Fetch team events
      const eventsFilter = {
        kinds: [FITNESS_KINDS.FITNESS_EVENT],
        '#team': [teamId]
      };
      
      const teamEvents = await ndk.fetchEvents(eventsFilter);
      
      return {
        ...team,
        activities: Array.from(activities),
        challenges: Array.from(challenges),
        events: Array.from(teamEvents)
      };
      
    } catch (err) {
      console.error('Error fetching team details:', err);
      return null;
    }
  }, [isInitialized]);
  
  // Initialize
  useEffect(() => {
    fetchMyTeams();
  }, [fetchMyTeams]);
  
  return {
    teams,
    loading,
    error,
    createTeam,
    joinTeam,
    searchTeams,
    getTeamDetails,
    refreshTeams: fetchMyTeams
  };
}; 