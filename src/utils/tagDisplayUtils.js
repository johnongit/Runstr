/**
 * Enhanced utilities for parsing and displaying team/challenge tags from 1301 workout events
 * Supports the updated implementation plan with comprehensive tag extraction and formatting
 */

/**
 * Parse team tags from workout event tags
 * @param {Array} tags - Event tags array
 * @returns {Array} Array of parsed team objects
 */
export const parseTeamTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .filter((tag) => tag[0] === 'team' && tag[1])
    .map((tag) => {
      // Team tag format: ["team", "33404:captain:uuid", "relayHint", "teamName"]
      const aTag = tag[1];
      const relayHint = tag[2] || '';
      const teamName = tag[3] || '';
      
      // Parse the a-tag: "33404:captain:uuid"
      const parts = aTag.split(':');
      if (parts.length === 3 && parts[0] === '33404') {
        return {
          aTag,
          captain: parts[1],
          uuid: parts[2],
          relayHint,
          teamName,
          identifier: `${parts[1]}:${parts[2]}`, // captain:uuid format
          displayName: teamName || `Team ${parts[2].slice(0, 8)}` // Fallback display name
        };
      }
      return null;
    })
    .filter((item) => item !== null);
};

/**
 * Parse challenge tags from workout event tags  
 * @param {Array} tags - Event tags array
 * @returns {Array} Array of parsed challenge objects
 */
export const parseChallengeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  
  // First, collect all challenge UUIDs from "t" tags
  const challengeFromTTags = tags
    .filter(tag => tag[0] === 't' && tag[1] && tag[1].startsWith('challenge:'))
    .map(tag => {
      const challengeValue = tag[1];
      const uuid = challengeValue.replace('challenge:', '');
      return uuid ? { uuid, challengeValue } : null;
    })
    .filter(Boolean);

  // Also collect from direct challenge_uuid tags
  const challengeFromUuidTags = tags
    .filter(tag => tag[0] === 'challenge_uuid' && tag[1])
    .map(tag => ({
      uuid: tag[1],
      challengeValue: `challenge:${tag[1]}`
    }));

  // Merge both sources and deduplicate by UUID
  const allChallengeUuids = new Map();
  [...challengeFromTTags, ...challengeFromUuidTags].forEach(challenge => {
    if (challenge && challenge.uuid) {
      allChallengeUuids.set(challenge.uuid, challenge);
    }
  });

  // Then, enhance with names from "challenge_name" tags
  const challengeNameTags = tags.filter(tag => tag[0] === 'challenge_name' && tag[1] && tag[2]);
  
  return Array.from(allChallengeUuids.values()).map(challenge => {
    // Look for a corresponding challenge_name tag
    const nameTag = challengeNameTags.find(tag => tag[1] === challenge.uuid);
    return {
      ...challenge,
      name: nameTag ? nameTag[2] : undefined,
      displayName: nameTag ? nameTag[2] : `Challenge ${challenge.uuid.slice(0, 8)}` // Fallback display name
    };
  });
};

/**
 * Extract team information from various tag formats for enhanced querying
 * @param {Array} tags - Event tags array  
 * @returns {Object} Extracted team data for queries and display
 */
export const extractTeamInfo = (tags) => {
  if (!Array.isArray(tags)) return { teams: [], teamUuids: [], teamMembers: [] };

  const teams = parseTeamTags(tags);
  
  // Extract direct team_uuid tags for efficient querying
  const teamUuidTags = tags
    .filter(tag => tag[0] === 'team_uuid' && tag[1])
    .map(tag => tag[1]);
  
  // Extract team_member tags for membership verification
  const teamMemberTags = tags
    .filter(tag => tag[0] === 'team_member' && tag[1])
    .map(tag => tag[1]);

  // Combine UUIDs from parsed teams and direct tags
  const allTeamUuids = [...new Set([
    ...teams.map(team => team.uuid),
    ...teamUuidTags
  ])];

  return {
    teams,
    teamUuids: allTeamUuids,
    teamMembers: teamMemberTags
  };
};

/**
 * Extract challenge information from various tag formats for enhanced querying
 * @param {Array} tags - Event tags array
 * @returns {Object} Extracted challenge data for queries and display  
 */
export const extractChallengeInfo = (tags) => {
  if (!Array.isArray(tags)) return { challenges: [], challengeUuids: [] };

  const challenges = parseChallengeTags(tags);
  
  // Extract direct challenge_uuid tags for efficient querying
  const challengeUuidTags = tags
    .filter(tag => tag[0] === 'challenge_uuid' && tag[1])
    .map(tag => tag[1]);

  // Combine UUIDs from parsed challenges and direct tags
  const allChallengeUuids = [...new Set([
    ...challenges.map(challenge => challenge.uuid),
    ...challengeUuidTags
  ])];

  return {
    challenges,
    challengeUuids: allChallengeUuids
  };
};

/**
 * Format team data for consistent UI display
 * @param {Array} teams - Array of team objects
 * @returns {Array} Formatted team display objects
 */
export const formatTeamsForDisplay = (teams) => {
  if (!Array.isArray(teams)) return [];
  
  return teams.map(team => ({
    id: team.identifier || `${team.captain}:${team.uuid}`,
    uuid: team.uuid,
    captain: team.captain,
    name: team.displayName || team.teamName || `Team ${team.uuid.slice(0, 8)}`,
    badge: {
      text: team.displayName || team.teamName || `Team ${team.uuid.slice(0, 8)}`,
      variant: 'team',
      color: 'success'
    }
  }));
};

/**
 * Format challenge data for consistent UI display
 * @param {Array} challenges - Array of challenge objects
 * @returns {Array} Formatted challenge display objects
 */
export const formatChallengesForDisplay = (challenges) => {
  if (!Array.isArray(challenges)) return [];
  
  return challenges.map(challenge => ({
    id: challenge.uuid,
    uuid: challenge.uuid,
    name: challenge.displayName || challenge.name || `Challenge ${challenge.uuid.slice(0, 8)}`,
    badge: {
      text: challenge.displayName || challenge.name || `Challenge ${challenge.uuid.slice(0, 8)}`,
      variant: 'challenge', 
      color: 'warning'
    }
  }));
};

/**
 * Get comprehensive tag data for workout cards and displays
 * @param {Array} tags - Event tags array
 * @returns {Object} Complete tag data for display
 */
export const getWorkoutTagData = (tags) => {
  const teamInfo = extractTeamInfo(tags);
  const challengeInfo = extractChallengeInfo(tags);
  
  return {
    // Raw parsed data
    teams: teamInfo.teams,
    challenges: challengeInfo.challenges,
    
    // Formatted for display
    formattedTeams: formatTeamsForDisplay(teamInfo.teams),
    formattedChallenges: formatChallengesForDisplay(challengeInfo.challenges),
    
    // For efficient querying
    teamUuids: teamInfo.teamUuids,
    challengeUuids: challengeInfo.challengeUuids,
    teamMembers: teamInfo.teamMembers,
    
    // Helper flags
    hasTeams: teamInfo.teams.length > 0,
    hasChallenges: challengeInfo.challenges.length > 0,
    hasAnyAffiliations: teamInfo.teams.length > 0 || challengeInfo.challenges.length > 0
  };
}; 