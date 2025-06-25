/**
 * Service for resolving team and challenge names from stored data
 * Provides caching and fallback mechanisms for performance
 */

/**
 * Cache for team names to avoid repeated lookups
 */
const teamNameCache = new Map();
const challengeNameCache = new Map();

/**
 * Get team name from localStorage cache or team events
 * @param {string} teamUUID - The team UUID to resolve
 * @param {string} captainPubkey - The captain's pubkey
 * @returns {string|null} Team name or null if not found
 */
export const resolveTeamName = (teamUUID, captainPubkey) => {
  if (!teamUUID) return null;
  
  const cacheKey = `${captainPubkey}:${teamUUID}`;
  
  // Check cache first
  if (teamNameCache.has(cacheKey)) {
    return teamNameCache.get(cacheKey);
  }
  
  try {
    // Try to get from localStorage team cache
    const teamCacheKey = `runstr:teamCache:${cacheKey}`;
    const cachedTeam = localStorage.getItem(teamCacheKey);
    if (cachedTeam) {
      const teamData = JSON.parse(cachedTeam);
      if (teamData.name && teamData.timestamp > Date.now() - 24 * 60 * 60 * 1000) { // 24h cache
        teamNameCache.set(cacheKey, teamData.name);
        return teamData.name;
      }
    }
    
    // Fallback: try to get from current teams context if available
    // This would be populated by the teams context/hook
    const allTeamsKey = 'runstr:userTeams';
    const userTeams = localStorage.getItem(allTeamsKey);
    if (userTeams) {
      const teams = JSON.parse(userTeams);
      const matchingTeam = teams.find(team => 
        team.uuid === teamUUID || team.teamUUID === teamUUID
      );
      if (matchingTeam && matchingTeam.name) {
        // Cache for future use
        const cacheData = { name: matchingTeam.name, timestamp: Date.now() };
        localStorage.setItem(teamCacheKey, JSON.stringify(cacheData));
        teamNameCache.set(cacheKey, matchingTeam.name);
        return matchingTeam.name;
      }
    }
  } catch (error) {
    console.warn('Error resolving team name:', error);
  }
  
  return null;
};

/**
 * Get challenge name from stored challenge events
 * @param {string} challengeUUID - The challenge UUID to resolve
 * @param {string} teamUUID - The team UUID the challenge belongs to
 * @returns {string|null} Challenge name or null if not found
 */
export const resolveChallengeName = (challengeUUID, teamUUID) => {
  if (!challengeUUID) return null;
  
  const cacheKey = `${teamUUID}:${challengeUUID}`;
  
  // Check cache first
  if (challengeNameCache.has(cacheKey)) {
    return challengeNameCache.get(cacheKey);
  }
  
  try {
    // Try to get from localStorage challenge cache
    const challengeCacheKey = `runstr:challengeCache:${cacheKey}`;
    const cachedChallenge = localStorage.getItem(challengeCacheKey);
    if (cachedChallenge) {
      const challengeData = JSON.parse(cachedChallenge);
      if (challengeData.name && challengeData.timestamp > Date.now() - 60 * 60 * 1000) { // 1h cache
        challengeNameCache.set(cacheKey, challengeData.name);
        return challengeData.name;
      }
    }
    
    // Fallback: try to get from team challenges in localStorage
    const teamChallengesKey = `runstr:teamChallenges:${teamUUID}`;
    const teamChallenges = localStorage.getItem(teamChallengesKey);
    if (teamChallenges) {
      const challenges = JSON.parse(teamChallenges);
      const matchingChallenge = challenges.find(challenge => 
        challenge.uuid === challengeUUID || challenge.id === challengeUUID
      );
      if (matchingChallenge && matchingChallenge.name) {
        // Cache for future use
        const cacheData = { name: matchingChallenge.name, timestamp: Date.now() };
        localStorage.setItem(challengeCacheKey, JSON.stringify(cacheData));
        challengeNameCache.set(cacheKey, matchingChallenge.name);
        return matchingChallenge.name;
      }
    }
  } catch (error) {
    console.warn('Error resolving challenge name:', error);
  }
  
  return null;
};

/**
 * Cache team name for future lookups
 * @param {string} teamUUID - The team UUID
 * @param {string} captainPubkey - The captain's pubkey
 * @param {string} teamName - The team name to cache
 */
export const cacheTeamName = (teamUUID, captainPubkey, teamName) => {
  if (!teamUUID || !teamName) return;
  
  const cacheKey = `${captainPubkey}:${teamUUID}`;
  const teamCacheKey = `runstr:teamCache:${cacheKey}`;
  
  try {
    const cacheData = { name: teamName, timestamp: Date.now() };
    localStorage.setItem(teamCacheKey, JSON.stringify(cacheData));
    teamNameCache.set(cacheKey, teamName);
  } catch (error) {
    console.warn('Error caching team name:', error);
  }
};

/**
 * Cache challenge name for future lookups
 * @param {string} challengeUUID - The challenge UUID
 * @param {string} teamUUID - The team UUID
 * @param {string} challengeName - The challenge name to cache
 */
export const cacheChallengeNames = (challengeUUID, teamUUID, challengeName) => {
  if (!challengeUUID || !challengeName) return;
  
  const cacheKey = `${teamUUID}:${challengeUUID}`;
  const challengeCacheKey = `runstr:challengeCache:${cacheKey}`;
  
  try {
    const cacheData = { name: challengeName, timestamp: Date.now() };
    localStorage.setItem(challengeCacheKey, JSON.stringify(cacheData));
    challengeNameCache.set(cacheKey, challengeName);
  } catch (error) {
    console.warn('Error caching challenge name:', error);
  }
};

/**
 * Resolve multiple challenge names efficiently
 * @param {Array} challengeUUIDs - Array of challenge UUIDs
 * @param {string} teamUUID - The team UUID they belong to
 * @returns {Array} Array of challenge names (may include nulls for unresolved names)
 */
export const resolveChallengeNames = (challengeUUIDs, teamUUID) => {
  if (!Array.isArray(challengeUUIDs)) return [];
  
  return challengeUUIDs.map(uuid => resolveChallengeName(uuid, teamUUID)).filter(Boolean);
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = () => {
  try {
    const now = Date.now();
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith('runstr:teamCache:') || key.startsWith('runstr:challengeCache:')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp) {
            const isExpired = key.includes('teamCache:') 
              ? (now - data.timestamp > 24 * 60 * 60 * 1000) // 24h for teams
              : (now - data.timestamp > 60 * 60 * 1000); // 1h for challenges
            
            if (isExpired) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Invalid data, remove it
          localStorage.removeItem(key);
        }
      }
    });
    
    // Clear in-memory caches
    teamNameCache.clear();
    challengeNameCache.clear();
  } catch (error) {
    console.warn('Error clearing expired cache:', error);
  }
};

// Clear expired cache on module load
clearExpiredCache(); 