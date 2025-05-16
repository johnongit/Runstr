---
# Post-Run Nostr Sharing Flow (RUNSTR)

This document is our living checklist for implementing the new post-run sharing experience that publishes:

* NIP-101e workout summary (kind 1301)
* NIP-101h workout-intensity metric (kind 1356)
* NIP-101h calories-burned metric (kind 1357)

Health-profile metrics (weight, height, age, gender, fitness-level) are **not** part of this flow – they are published separately from the Health Profile screen.

---

## Epic
"Post-run Nostr sharing flow (intensity + calories + 101e workout summary)"

| ID | Title | Priority | Depends on |
|----|-------|----------|------------|
| 1 | Extend run model with `intensity` & `calories` | High | – |
| 2 | WorkoutFinishedModal (UI + wiring) | High | 1 |
| 3 | Rename & re-wire "Save to Nostr" button | High | 2 |
| 4 | SaveToNostrModal (list & publish) | High | 3 |
| 5 | Event-builder updates for 1356 & 1357 | High | 4 |
| 6 | Integrated publish flow (1301 + 1356 + 1357) | High | 5 |
| 7 | Unit & component tests | Medium | 2-6 |
| 8 | Docs & copy updates | Low | 6 |

---

### Task 1 – Extend run model
* Files: `src/services/RunDataService.js` (data schema) and any TypeScript interfaces.
* Add two optional fields to each run record:
  * `intensity`: `'easy' | 'moderate' | 'hard' | null`
  * `calories`: `number | null`
* Ensure defaults (`null`) are set when saving legacy runs.
* Unit tests: verify a newly saved run without these props gets defaults.

### Task 2 – WorkoutFinishedModal
* New component `src/components/WorkoutFinishedModal.jsx`.
* Auto-opens when run tracking stops.
* Allows selecting intensity; stores intensity (and calories if available) into the run record.

### Task 3 – Button rename & wiring
* Change label **Save run to Nostr** → **Save to Nostr** everywhere.
* On press ⇒ open `SaveToNostrModal`.

### Task 4 – SaveToNostrModal
* Read-only checklist with three items:
  * Workout intensity (kind 1356)
  * Calories burned (kind 1357)
  * Workout summary (kind 1301)
* Publish / Cancel actions.

### Task 5 – Event-builder updates
* Wrap helpers in `src/utils/nostrHealth.js`:
  * `buildIntensityEvent(run)` → uses `createWorkoutIntensityEvent`.
  * `buildCalorieEvent(run)` → uses `createCaloricDataEvent`.

### Task 6 – Integrated publish flow
```
publishRun(run) {
  const events = [
    createWorkoutEvent(run, run.unit), // 1301
    buildIntensityEvent(run),          // 1356
    buildCalorieEvent(run)             // 1357
  ].filter(Boolean);
  return Promise.all(events.map(e => createAndPublishEvent(e)));
}
```
* Called from `SaveToNostrModal`.

### Task 7 – Tests
* Unit tests for event builder and publishRun.
* Component tests for both modals.

### Task 8 – Docs & copy
* Update README and in-app help strings.

---

**Last updated:** <!-- keep manual until automated --> 