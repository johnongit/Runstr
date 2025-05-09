// Minimal Snapshot utils for Weekly Leaderboard
// Uses Nostr (ndk singleton) to write & read simple JSON events
// The event kind is arbitrarily chosen as 31977 (Runstr weekly leaderboard snapshot)
// Content is JSON string with required fields.

import { ndk } from '../lib/ndkSingleton';

const EVENT_KIND = 31977; // Custom, application-specific kind

/**
 * Calculate ISO week string (e.g. 2025-W28)
 */
export const getCurrentWeekISO = (date = new Date()) => {
  // Copy so we don't mutate input
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to Thursday in current week, per ISO 8601
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Publish weekly snapshot for the current user.
 * @param {Object} snapshot – { name, pubkey, distanceKm, streak, improvementPct }
 */
export const publishWeeklySnapshot = async (snapshot) => {
  if (!snapshot?.pubkey) throw new Error('publishWeeklySnapshot: pubkey required');

  const week = getCurrentWeekISO();
  const content = JSON.stringify({ week, ...snapshot });

  const event = ndk?.getEvent({ kind: EVENT_KIND, content });
  if (!event) throw new Error('NDK not ready');
  event.tag('week', week);

  await ndk.publish(event);
  return { success: true, id: event.id };
};

/**
 * Fetch all snapshots for given ISO week.
 */
export const fetchWeeklySnapshots = async (weekIso = getCurrentWeekISO()) => {
  const filter = { kinds: [EVENT_KIND], '#week': [weekIso] };
  const events = await ndk.fetchEvents(filter, { closeOnEose: true, groupable: false });
  const snapshots = [];
  events.forEach((ev) => {
    try {
      const obj = JSON.parse(ev.content);
      if (obj?.week === weekIso && obj.pubkey) {
        snapshots.push({ ...obj, id: ev.id });
      }
    } catch {
      // ignore invalid
    }
  });
  return snapshots;
}; 