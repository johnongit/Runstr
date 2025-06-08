import { createWorkoutEvent, createAndPublishEvent } from './nostr';
import { buildIntensityEvent, buildCalorieEvent, buildDurationEvent } from './nostrHealth';
import { buildDistanceEvent, buildPaceEvent, buildElevationEvent, buildSplitEvents } from './nostrHealth';
import { getActiveRelayList } from '../contexts/SettingsContext';

/**
 * Publish a run's workout summary (kind 1301) plus optional NIP-101h events.
 * @param {Object} run  Run record saved in local storage.
 * @param {string} distanceUnit 'km' | 'mi'
 * @param {Object} settings User's publishing preferences from SettingsContext.
 * @returns {Promise<Array>} resolved array of publish results
 */
export const publishRun = async (run, distanceUnit = 'km', settings = {}) => {
  if (!run) throw new Error('publishRun: run is required');

  // Helper to check settings, defaulting to true if undefined
  const shouldPublish = (metricKey) => {
    const settingKey = `publish${metricKey.charAt(0).toUpperCase() + metricKey.slice(1)}`;
    return settings[settingKey] !== false;
  };

  const results = [];
  const relayList = getActiveRelayList();

  // 🏷️ Determine default posting team (A2 strategy – simple hashtag tag)
  let teamAssociation = undefined;
  try {
    const { getDefaultPostingTeamIdentifier } = await import('./settingsManager.ts');
    const defaultTeamId = getDefaultPostingTeamIdentifier ? getDefaultPostingTeamIdentifier() : null;
    if (defaultTeamId) {
      const parts = defaultTeamId.split(':');
      if (parts.length === 2) {
        const [teamCaptainPubkey, teamUUID] = parts;
        teamAssociation = { teamCaptainPubkey, teamUUID };
      }
    }
  } catch (err) {
    console.warn('runPublisher: could not resolve default posting team', err);
  }

  // 1️⃣ Publish workout summary if not already published earlier (ALWAYS PUBLISHED)
  if (!run.nostrWorkoutEventId) {
    // Pass settings to createWorkoutEvent if it needs to conditionally add tags like steps
    const summaryTemplate = createWorkoutEvent(run, distanceUnit, { teamAssociation }); // Adds A2 team tag if available
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

  // 2️⃣ Publish intensity, calorie, & NIP-101h duration events if available and enabled
  const followUps = [];
  if (shouldPublish('intensity')) followUps.push(buildIntensityEvent(run));
  if (shouldPublish('calories')) followUps.push(buildCalorieEvent(run));
  if (shouldPublish('durationMetric')) followUps.push(buildDurationEvent(run)); // NIP-101h detailed duration
  
  const filteredFollowUps = followUps.filter(Boolean);
  for (const tmpl of filteredFollowUps) {
    try {
      const res = await createAndPublishEvent(tmpl, null, { relays: relayList });
      results.push({ kind: tmpl.kind, success: true, result: res });
    } catch (err) {
      console.error('publishRun: failed for kind', tmpl.kind, err);
      results.push({ kind: tmpl.kind, success: false, error: err.message });
    }
  }

  // 3️⃣ Publish additional NIP-101h metrics: distance, pace, elevation, splits if enabled
  const metricTemplates = [];
  if (shouldPublish('distanceMetric')) metricTemplates.push(buildDistanceEvent(run, distanceUnit));
  if (shouldPublish('paceMetric')) metricTemplates.push(buildPaceEvent(run, distanceUnit));
  if (shouldPublish('elevationMetric')) metricTemplates.push(buildElevationEvent(run, distanceUnit));
  
  if (shouldPublish('splits')) {
    const splitTemplates = buildSplitEvents(run, distanceUnit);
    metricTemplates.push(...splitTemplates);
  }

  const filteredMetricTemplates = metricTemplates.filter(Boolean);

  // Determine encryption preference from localStorage (fallback encrypted)
  let encryptPref = true;
  try {
    // Reading from localStorage directly here as settings object might not have healthEncryptionPref directly in this utility
    encryptPref = (localStorage.getItem('healthEncryptionPrefIsPlaintext') !== 'true'); 
  } catch (err) {
    console.warn('Could not read healthEncryptionPref, defaulting to encrypted', err);
  }

  for (const tmpl of filteredMetricTemplates) {
    try {
      const res = await createAndPublishEvent(tmpl, null, { encrypt: encryptPref, relays: relayList });
      results.push({ kind: tmpl.kind, success: true, result: res });
    } catch (err) {
      console.error('publishRun: failed for kind', tmpl.kind, err);
      results.push({ kind: tmpl.kind, success: false, error: err.message });
    }
  }
  // Note: The 'steps' metric preference is not directly used here as it's assumed to be part of the main
  // kind 1301 event (createWorkoutEvent) or not yet a distinct NIP-101h event handled by this publisher.
  // If 'steps' needs to be conditionally included in the kind 1301 summary, 
  // createWorkoutEvent would need to accept and use the 'settings.publishSteps' preference.

  return results;
}; 