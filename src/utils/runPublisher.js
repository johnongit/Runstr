import { createWorkoutEvent, createAndPublishEvent } from './nostr';
import { buildIntensityEvent, buildCalorieEvent, buildDurationEvent } from './nostrHealth';
import { buildDistanceEvent, buildPaceEvent, buildElevationEvent, buildSplitEvents } from './nostrHealth';
import { getActiveRelayList } from '../contexts/SettingsContext';

/**
 * Publish a run's workout summary (kind 1301) plus optional 1356, 1357 and 1358 events.
 * @param {Object} run  Run record saved in local storage.
 * @param {string} distanceUnit 'km' | 'mi'
 * @returns {Promise<Array>} resolved array of publish results
 */
export const publishRun = async (run, distanceUnit = 'km') => {
  if (!run) throw new Error('publishRun: run is required');

  const results = [];
  const relayList = getActiveRelayList();

  // 1️⃣  Publish workout summary first
  const summaryTemplate = createWorkoutEvent(run, distanceUnit);
  try {
    const summaryResult = await createAndPublishEvent(summaryTemplate, null, { relays: relayList });
    results.push({ kind: 1301, success: true, result: summaryResult });
    if (summaryResult?.id) {
      run.nostrWorkoutEventId = summaryResult.id; // allow linking
    }
  } catch (err) {
    console.error('publishRun: failed for kind 1301', err);
    results.push({ kind: 1301, success: false, error: err.message });
    // If summary fails, bail early (optional)
    return results;
  }

  // 2️⃣  Publish intensity, calorie, & duration events if available
  const followUps = [
    buildIntensityEvent(run),
    buildCalorieEvent(run),
    buildDurationEvent(run)
  ].filter(Boolean);
  for (const tmpl of followUps) {
    try {
      const res = await createAndPublishEvent(tmpl, null, { relays: relayList });
      results.push({ kind: tmpl.kind, success: true, result: res });
    } catch (err) {
      console.error('publishRun: failed for kind', tmpl.kind, err);
      results.push({ kind: tmpl.kind, success: false, error: err.message });
    }
  }

  // 3️⃣ Publish additional NIP-101h metrics: distance, pace, elevation, splits
  const metricTemplates = [
    buildDistanceEvent(run, distanceUnit),
    buildPaceEvent(run, distanceUnit),
    buildElevationEvent(run, distanceUnit),
    // splits returns array
  ].filter(Boolean);

  const splitTemplates = buildSplitEvents(run, distanceUnit);
  metricTemplates.push(...splitTemplates);

  // Determine encryption preference from localStorage (fallback encrypted)
  let encryptPref = true;
  try {
    encryptPref = (localStorage.getItem('healthEncryptionPref') || 'encrypted') === 'encrypted';
  } catch (err) {
    console.warn('Could not read healthEncryptionPref, defaulting to encrypted', err);
  }

  for (const tmpl of metricTemplates) {
    try {
      const res = await createAndPublishEvent(tmpl, null, { encrypt: encryptPref, relays: relayList });
      results.push({ kind: tmpl.kind, success: true, result: res });
    } catch (err) {
      console.error('publishRun: failed for kind', tmpl.kind, err);
      results.push({ kind: tmpl.kind, success: false, error: err.message });
    }
  }

  return results;
}; 