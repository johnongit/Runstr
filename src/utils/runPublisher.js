import { createWorkoutEvent } from './nostr';
import { createAndPublishEvent } from './nostr';
import { buildIntensityEvent, buildCalorieEvent, buildDurationEvent } from './nostrHealth';

/**
 * Publish a run's workout summary (kind 1301) plus optional 1356, 1357 and 1358 events.
 * @param {Object} run  Run record saved in local storage.
 * @param {string} distanceUnit 'km' | 'mi'
 * @returns {Promise<Array>} resolved array of publish results
 */
export const publishRun = async (run, distanceUnit = 'km') => {
  if (!run) throw new Error('publishRun: run is required');

  const results = [];

  // 1️⃣  Publish workout summary first
  const summaryTemplate = createWorkoutEvent(run, distanceUnit);
  try {
    const summaryResult = await createAndPublishEvent(summaryTemplate);
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
      const res = await createAndPublishEvent(tmpl);
      results.push({ kind: tmpl.kind, success: true, result: res });
    } catch (err) {
      console.error('publishRun: failed for kind', tmpl.kind, err);
      results.push({ kind: tmpl.kind, success: false, error: err.message });
    }
  }

  return results;
}; 