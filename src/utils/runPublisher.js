import { createWorkoutEvent, createAndPublishEvent } from './nostr';
import { getActiveRelayList } from '../contexts/SettingsContext';
import { resolveTeamName, resolveChallengeNames } from '../services/nameResolver';

/**
 * Publish a run's workout summary (kind 1301) plus optional NIP-101h events.
 * @param {Object} run  Run record saved in local storage.
 * @param {string} distanceUnit 'km' | 'mi'
 * @param {Object} settings User's publishing preferences from SettingsContext.
 * @returns {Promise<Array>} resolved array of publish results
 */
export const publishRun = async (run, distanceUnit = 'km', settings = {}) => {
  if (!run) throw new Error('publishRun: run is required');

  const results = [];
  const relayList = getActiveRelayList();

  // 🏷️ Determine default posting team (A2 strategy – simple hashtag tag)
  let teamAssociation = undefined;
  let challengeUUIDs = [];
  let challengeNames = [];
  
  try {
    const { getDefaultPostingTeamIdentifier } = await import('./settingsManager.ts');
    const defaultTeamId = getDefaultPostingTeamIdentifier ? getDefaultPostingTeamIdentifier() : null;
    if (defaultTeamId) {
      const parts = defaultTeamId.split(':');
      if (parts.length === 2) {
        const [teamCaptainPubkey, teamUUID] = parts;
        
        // Resolve team name for enhanced content
        const teamName = resolveTeamName(teamUUID, teamCaptainPubkey);
        
        teamAssociation = { 
          teamCaptainPubkey, 
          teamUUID,
          teamName 
        };
        
        // 🏆 Get challenge participation for this team and resolve names
        try {
          const challengeKey = `runstr:challengeParticipation:${teamUUID}`;
          const stored = JSON.parse(localStorage.getItem(challengeKey) || '[]');
          if (Array.isArray(stored)) {
            challengeUUIDs = stored;
            challengeNames = resolveChallengeNames(challengeUUIDs, teamUUID);
          }
        } catch (challengeErr) {
          console.warn('runPublisher: could not retrieve challenge participation', challengeErr);
        }
      }
    }
  } catch (err) {
    console.warn('runPublisher: could not resolve default posting team', err);
  }

  // 1️⃣ Publish workout summary if not already published earlier (ALWAYS PUBLISHED)
  if (!run.nostrWorkoutEventId) {
    // Pass team association, challenge UUIDs, and resolved names to createWorkoutEvent
    const summaryTemplate = createWorkoutEvent(run, distanceUnit, { teamAssociation, challengeUUIDs, challengeNames });
    try {
      const summaryResult = await createAndPublishEvent(summaryTemplate, null, { relays: relayList });
      results.push({ kind: 1301, success: true, result: summaryResult });
      if (summaryResult?.id) {
        run.nostrWorkoutEventId = summaryResult.id;
      }
    } catch (err) {
      console.error('publishRun: failed for kind 1301', err);
      results.push({ kind: 1301, success: false, error: err.message });
      return results; // bail if summary fails
    }
  }

  // PHASE-1 SIMPLIFICATION: Skip all NIP-101h follow-up publishing. Return after summary.
  return results;
}; 