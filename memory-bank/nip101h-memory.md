# NIP-101h Implementation Memory

> Ongoing log of the RUNSTR app's NIP-101h (Health Profile Framework) work.  This file captures key decisions, specs, progress, blockers, and lessons learned so future AI agents (and humans) have full context.

## Current NIP-101h Implementation (Kinds 1351-1355)

> This section summarizes the NIP-101h metrics currently implemented and published by the RUNSTR app, based on the user's profile data. These are handled primarily in `src/utils/nostrHealth.js` and the UI in `src/pages/Profile.jsx`.

### Overview
- The app allows users to save their health profile (Weight, Height, Age, Gender, Fitness Level) to Nostr.
- The `publishHealthProfile` function in `src/utils/nostrHealth.js` orchestrates the creation and publication of these individual NIP-101h events.
- Users are presented with a confirmation dialog in `src/pages/Profile.jsx` before these metrics are published, explaining the public and potentially permanent nature of the data.

### Implemented Metrics

**1. NIP-101h.1: Weight (Kind 1351)**
- **Spec:** Numeric weight in `content`, `['unit', 'kg' or 'lb']`, `['t', 'health']`, `['t', 'weight']`. Optional `['converted_value']` and `['timestamp']`.
- **Implementation (`createWeightEvent` in `nostrHealth.js`):
  - Takes weight and unit ('kg' or 'lb') as input.
  - If unit is 'lb', a `['converted_value', kgValue, 'kg']` tag is automatically added.
  - Populates `content` with the provided weight.
  - Includes required tags: `['unit', unit]`, `['t', 'health']`, `['t', 'weight']`.
- **UI (`Profile.jsx`):
  - User inputs weight via `profile.weight`.
  - User selects preferred unit via `unitPreferences.weight` (`kg` or `lb`).

**2. NIP-101h.2: Height (Kind 1352)**
- **Spec:** Numeric height in cm or JSON `{"feet": x, "inches": y}` in `content`. `['unit', 'cm' or 'imperial']`, `['t', 'health']`, `['t', 'height']`. Optional `['converted_value']` (to cm) and `['timestamp']`.
- **Implementation (`createHeightEvent` in `nostrHealth.js`):
  - Takes `profile` object (containing `heightCm`, `heightFeet`, `heightInches`) and unit ('metric' or 'imperial').
  - If unit is 'metric', `content` is `profile.heightCm` and `['unit', 'cm']` is used.
  - If unit is 'imperial', `content` is JSON string `{"feet": profile.heightFeet, "inches": profile.heightInches}`, `['unit', 'imperial']` is used, and a `['converted_value', profile.heightCm, 'cm']` tag is added.
  - Includes required tags: `['t', 'health']`, `['t', 'height']`.
- **UI (`Profile.jsx`):
  - User inputs height based on preferred unit selection (`unitPreferences.height`):
    - Metric: `profile.heightCm`.
    - Imperial: `profile.heightFeet`, `profile.heightInches`.

**3. NIP-101h.3: Age (Kind 1353)**
- **Spec:** Numeric age in `content`. `['unit', 'years']`, `['t', 'health']`, `['t', 'age']`. Optional `['timestamp']`, `['dob']`.
- **Implementation (`createAgeEvent` in `nostrHealth.js`):
  - Takes `profile.age` as input.
  - `content` is `String(age)`.
  - Includes required tags: `['unit', 'years']`, `['t', 'health']`, `['t', 'age']`.
- **UI (`Profile.jsx`):
  - User inputs age via `profile.age`.

**4. NIP-101h.4: Gender (Kind 1354)**
- **Spec:** Gender string in `content`. `['t', 'health']`, `['t', 'gender']`. Optional `['timestamp']`, `['preferred_pronouns']`. Recommended common values.
- **Implementation (`createGenderEvent` in `nostrHealth.js`):
  - Takes `profile.gender` as input.
  - `content` is `gender`.
  - Includes required tags: `['t', 'health']`, `['t', 'gender']`.
- **UI (`Profile.jsx`):
  - User selects gender from a dropdown (`profile.gender`) with options: `male`, `female`, `non-binary`, `other`, `prefer-not-to-say`.

**5. NIP-101h.5: Fitness Level (Kind 1355)**
- **Spec:** Fitness level string in `content`. `['t', 'health']`, `['t', 'fitness']`, `['t', 'level']`. Optional `['timestamp']`, `['activity']`, `['metrics']`. Recommended common values.
- **Implementation (`createFitnessLevelEvent` in `nostrHealth.js`):
  - Takes `profile.fitnessLevel` as input.
  - `content` is `level`.
  - Includes required tags: `['t', 'health']`, `['t', 'fitness']`, `['t', 'level']`.
- **UI (`Profile.jsx`):
  - User selects fitness level from a dropdown (`profile.fitnessLevel`) with options: `beginner`, `intermediate`, `advanced`.

### Publishing Flow
- The `publishHealthProfile` async function in `src/utils/nostrHealth.js` gathers all the above profile data, creates the respective event objects using the helper functions, and then iterates through them, calling `createAndPublishEvent` (from `src/utils/nostr.js`) for each.
- It returns a summary of successful and failed publications.

---

## 2025-05-07 – Feature Kick-off

### Goals
1. Extend NIP-101h with two new metrics and corresponding Nostr kinds.
   - **Workout Intensity** → kind **1356**  
     • Supports RPE 1-10 *or* keyword scale `low | moderate | high | max`.
   - **Caloric Data** → kind **1357**  
     • Canonical unit **kcal** with optional kJ conversion.
2. Integrate both metrics into the "Save run to Nostr" flow.
3. Add Settings preference controlling automatic vs manual publishing:
   - `autoAccept` | `autoIgnore` | `manual`.

### Agreed Event Specs
**Kind 1356 – Workout Intensity**
```json
{
  "kind": 1356,
  "content": "7",              // or "high"
  "tags": [
    ["t", "health"],
    ["t", "intensity"],
    ["scale", "rpe10"],       // or "keyword"
    ["activity", "run"],      // optional
    ["timestamp", "ISO8601"]  // optional
  ]
}
```

**Kind 1357 – Caloric Data**
```json
{
  "kind": 1357,
  "content": "550",           // kcal
  "tags": [
    ["unit", "kcal"],
    ["t", "health"],
    ["t", "calories"],
    ["converted_value", "9628", "kJ"], // optional
    ["accuracy", "estimated"],          // optional
    ["timestamp", "ISO8601"]            // optional
  ]
}
```

### Planned Code Changes
- `src/utils/nostrHealth.js`  
  • Add `createWorkoutIntensityEvent()` & `createCaloricDataEvent()` helpers.  
  • Expose `publishWorkoutExtras(intensity, calories, opts)` like existing `publishHealthProfile()`.
- **Settings**  
  • Extend global settings slice with `calorieIntensityPref` enum.
- **UI**  
  • Modal after "Save run" with two toggles obeying preference.
- **Tests**  
  • Snapshot tests for new event creators.

### Status
- Specs finalised ✅
- Code not yet implemented ⏳

### Open Questions / TODO
- Should intensity & calorie events include a pointer (`["e", <workoutEventId>]`) back to the workout summary? → **Probably yes**; implement once we refactor publish flow.
- Persistence of last manual toggle choice? (out of scope for v1).

---

## Template for future updates

```
## YYYY-MM-DD – <Title>

### What Happened
- …

### Successes / Wins
- …

### Failures / Issues
- …

### Decisions
- …

### Next Steps
- …
``` 