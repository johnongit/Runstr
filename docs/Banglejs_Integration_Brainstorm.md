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

---

## X. Sync Feature Fixes & Implementation Plan

Based on current issues with the RUNSTR-Bangle.js sync functionality, here's a comprehensive plan to fix and improve the sync feature.

### Current Issues Analysis

1. **Sync Button Location**: Currently in dashboard banner, should be moved to Settings
2. **BLE Communication Mismatch**: Mobile app uses READ pattern, watch app now uses WRITE+NOTIFY pattern
3. **UI Layout Issues**: Stop run section falling off screen
4. **Watch App Issues**: Distance tracking, step counting, logo display problems

### Implementation Plan

#### Phase 1: Fix Mobile App BLE Communication

**Problem**: The current `BluetoothService.js` uses `BleClient.read()` which doesn't match the updated watch app's WRITE+NOTIFY pattern.

**Solution**: Update the mobile app to use the phone-initiated sync pattern:

```javascript
// New approach in BluetoothService.js
export async function fetchRunDataFromWatch() {
  await BleClient.initialize();
  
  const device = await BleClient.requestDevice({
    services: [RUNSTR_SERVICE_UUID],
  });
  
  if (!device) {
    throw new Error('No device selected');
  }
  
  await BleClient.connect(device.deviceId);
  
  // Set up notification listener BEFORE writing
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    // Listen for notifications
    BleClient.startNotifications(
      device.deviceId,
      RUNSTR_SERVICE_UUID,
      RUNSTR_DATA_CHAR_UUID,
      (value) => {
        clearTimeout(timeoutId);
        BleClient.disconnect(device.deviceId);
        
        const jsonString = new TextDecoder('utf-8').decode(value.buffer);
        
        if (!jsonString || jsonString.includes('no_run_data')) {
          reject(new Error('No run data available on the watch.'));
          return;
        }
        
        try {
          resolve(JSON.parse(jsonString));
        } catch (err) {
          reject(new Error('Received invalid run data'));
        }
      }
    );
    
    // Write to characteristic to trigger sync
    BleClient.write(
      device.deviceId,
      RUNSTR_SERVICE_UUID,
      RUNSTR_DATA_CHAR_UUID,
      new DataView(new ArrayBuffer(1))  // Send any value to trigger
    ).catch(reject);
    
    // Set timeout for sync operation
    timeoutId = setTimeout(() => {
      BleClient.disconnect(device.deviceId);
      reject(new Error('Sync timeout - no response from watch'));
    }, 10000); // 10 second timeout
  });
}
```

#### Phase 2: Move Sync Button to Settings

**Current**: Sync button in RunTracker dashboard banner
**Target**: Add sync button to Settings page under a new "Device Sync" section

**Settings.jsx additions**:
```javascript
// Add to settings sections
<div className="settings-section">
  <h3>Device Sync</h3>
  
  <div className="setting-item">
    <label>Bangle.js Watch Sync</label>
    <button 
      className="sync-button"
      onClick={handleSyncFromWatch}
      disabled={isSyncingWatch}
    >
      {isSyncingWatch ? 'Syncing...' : 'Sync Run Data'}
    </button>
    <p className="setting-description">
      Sync workout data from your Bangle.js watch to RUNSTR
    </p>
  </div>
  
  <div className="setting-item">
    <label htmlFor="autoSyncToggle">Auto-sync on App Open</label>
    <div className="toggle-switch">
      <input 
        type="checkbox"
        id="autoSyncToggle"
        checked={autoSyncEnabled}
        onChange={handleAutoSyncToggle}
      />
      <span className="toggle-slider"></span>
    </div>
  </div>
</div>
```

#### Phase 3: UI Layout Fixes

**Problem**: Stop run section falls off bottom of screen

**Solution Options**:
1. **Scrollable Container**: Make the RunTracker component scrollable
2. **Dynamic Height**: Adjust component heights based on screen size
3. **Collapsible Sections**: Make some sections collapsible when screen space is limited

**Recommended Approach**: Add scroll container with proper spacing
```css
.run-tracker-container {
  height: 100vh;
  overflow-y: auto;
  padding-bottom: 100px; /* Ensure bottom content is accessible */
}
```

#### Phase 4: Watch App Improvements

**Issues to Address on Bangle.js Side**:

1. **Distance Tracking**:
   - Verify GPS coordinate collection frequency
   - Check distance calculation algorithm
   - Consider using Bangle.js built-in GPS utilities

2. **Step Counter**:
   - Investigate step detection sensitivity
   - Compare with Bangle.js built-in step counter
   - Consider calibration options

3. **Logo Display**:
   - Check image format compatibility (should be 1-bit bitmap)
   - Verify file size constraints
   - Test logo display on different Bangle.js firmware versions

### Implementation Priority

#### High Priority (Fix sync functionality):
1. Update `BluetoothService.js` to use WRITE+NOTIFY pattern
2. Move sync button to Settings page
3. Add proper error handling and timeout management

#### Medium Priority (UI improvements):
1. Fix stop run button layout issue
2. Add auto-sync option in settings
3. Improve sync user feedback

#### Low Priority (Watch app refinements):
1. Investigate distance tracking accuracy
2. Calibrate step counter
3. Fix logo display issue

### Testing Strategy

1. **BLE Communication Testing**:
   - Test connection establishment
   - Verify data transmission
   - Test error scenarios (out of range, no data, etc.)

2. **UI Flow Testing**:
   - Test sync button in settings
   - Verify layout on different screen sizes
   - Test sync confirmation modal

3. **Data Integrity Testing**:
   - Verify watch data maps correctly to Run object
   - Test Nostr publishing of synced runs
   - Validate run appears in history correctly

### Questions for You

1. **Priority**: Which issue should we tackle first - the BLE communication fix or the sync button relocation?

2. **Watch App**: Do you have the ability to test changes on the Bangle.js side, or should we focus purely on mobile app improvements?

3. **User Experience**: Would you prefer the sync to happen automatically when the app opens, or keep it manual via the settings button?

4. **Data Validation**: Should we add data validation for synced runs (e.g., minimum distance, maximum reasonable pace) to prevent corrupted data from being saved?

5. **Offline Sync**: Should the app be able to queue multiple runs from the watch if the user hasn't synced in a while?

This plan addresses all the issues you mentioned while building on the existing architecture. The modular approach allows us to tackle each problem independently while ensuring the fixes work together cohesively. 