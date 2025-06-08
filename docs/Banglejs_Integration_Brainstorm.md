# Brainstorming: Bangle.js Watch Sync Integration

This document outlines a potential implementation strategy for integrating a Bangle.js companion watch app with RUNSTR. The primary goal is to receive run data via Bluetooth, store it as a standard run, and publish it to Nostr as a kind 1301 workout event, all while minimizing code duplication and complexity.

## High-Level Plan

The process can be broken down into four main steps, most of which can leverage existing code:

1.  **Listen & Receive:** The RUNSTR app needs a way to listen for and receive data from the Bangle.js watch over Bluetooth Low Energy (BLE). This is the only major piece of new functionality required.
2.  **Parse & Transform:** The incoming BLE data must be parsed and transformed into the standard `Run` object format that the RUNSTR app uses internally.
3.  **Store & Process:** The newly created `Run` object will be saved using the existing `runDataService`. This will automatically trigger existing logic for stat calculation (`useRunStats`) and make the run appear in the user's history.
4.  **Publish to Nostr:** The existing `createWorkoutEvent` and `createAndPublishEvent` functions will be used to create and broadcast the kind 1301 event, just as is done for runs recorded on the phone.

---

## Key Implementation Areas & Questions

### 1. Bluetooth Service (The New Part)

A dedicated service, perhaps `src/services/bluetoothService.js`, would be responsible for all BLE communication.

*   **Functionality:** This service would need to handle scanning for the Bangle.js device, connecting to it, and subscribing to the specific BLE characteristic that transmits the run data.
*   **Trigger:** How should the user initiate this? We could add a "Sync with Watch" button on the main screen ([RunTracker.jsx](mdc:src/components/RunTracker.jsx)) or in the settings page.
*   **Question for you:** What is the exact data format the Bangle.js app sends? Is it a JSON string? A custom format? Knowing the structure is crucial for the parsing step. A good format would include:
    *   `distance`: in meters
    *   `duration`: in seconds
    *   `date`: An ISO 8601 timestamp string
    *   `elevationGain`: Optional, in meters

### 2. Data Processing (Reusing Existing Logic)

We can create a single new function to orchestrate the process after data is received. Let's call it `handleSyncedRun(dataFromWatch)`. This function would:

1.  Call the new Bluetooth service to get the data.
2.  Parse `dataFromWatch` into a `Run` object.
3.  Use the existing `runDataService` to save the new run. This service is already used in `[RunHistory.jsx](mdc:src/pages/RunHistory.jsx)` and is responsible for managing runs in `localStorage`.
4.  This approach ensures the new run is immediately integrated into the rest of the app's ecosystem (stats, history, etc.).

### 3. Nostr Publishing (Reusing Existing Logic)

The logic for publishing to Nostr is already well-defined in the `handleSaveWorkoutRecord` function found in both `[RunHistory.jsx](mdc:src/pages/RunHistory.jsx)` and `[RunTracker.jsx](mdc:src/components/RunTracker.jsx)`. We would simply replicate this pattern:

1.  After the synced run is saved, call `createWorkoutEvent(newRun, distanceUnit)` from `[nostr.js](mdc:src/utils/nostr.js)`.
2.  Pass the result to `createAndPublishEvent(...)`.
3.  Update the run record with the returned Nostr event ID via `runDataService.updateRun(...)`.

### 4. User Feedback (Reusing Existing Patterns)

To inform the user of the outcome, we can use the existing toast notification system:

*   On success: `window.Android.showToast('Run synced successfully from watch!')`
*   On failure: `window.Android.showToast('Failed to sync from watch: ' + error.message)`

---

## Summary of Code Impact

*   **New File:** `src/services/bluetoothService.js` to contain all BLE logic. This isolates the new complexity.
*   **Modified UI File:** A component like `[RunTracker.jsx](mdc:src/components/RunTracker.jsx)` would be modified to add a "Sync" button and call the new service.
*   **Orchestration:** A new handler function would be added to tie the steps together, calling the BLE service and then reusing the existing `runDataService` and Nostr utility functions.

This approach introduces the new Bluetooth functionality in an isolated way and leans heavily on existing, proven code for everything else, which should meet your goal of avoiding unnecessary complexity. What are your thoughts on this direction? 