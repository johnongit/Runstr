export const DEFAULT_POSTING_TEAM_STORAGE_KEY = 'runstr:defaultPostingTeamIdentifier';

/**
 * Gets the identifier for the user's default posting team.
 * Identifier is in the format "captainPubkey:teamUUID".
 * @returns {string | null} The identifier string or null if not set.
 */
export const getDefaultPostingTeamIdentifier = (): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(DEFAULT_POSTING_TEAM_STORAGE_KEY);
  }
  return null;
};

/**
 * Sets the identifier for the user's default posting team.
 * @param {string | null} identifier - The identifier string ("captainPubkey:teamUUID") or null to clear it.
 */
export const setDefaultPostingTeamIdentifier = (identifier: string | null): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (identifier) {
      localStorage.setItem(DEFAULT_POSTING_TEAM_STORAGE_KEY, identifier);
    } else {
      localStorage.removeItem(DEFAULT_POSTING_TEAM_STORAGE_KEY);
    }
  }
};

// Example of how to parse the identifier if needed elsewhere:
// export const parseTeamIdentifier = (identifier: string | null): { captainPubkey: string; teamUUID: string } | null => {
//   if (!identifier) return null;
//   const parts = identifier.split(':');
//   if (parts.length === 2) {
//     return { captainPubkey: parts[0], teamUUID: parts[1] };
//   }
//   return null;
// }; 