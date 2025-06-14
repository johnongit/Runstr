# Next Development Steps

This document outlines the plan and tracks progress for the next set of development tasks.

## Tasks

### 1. UI Cleanup
- [x] **Remove Liked Songs Playlist:** Remove the UI element for the "Liked Songs" playlist from the music section.
- [x] **Move Sync Watch Button:** Relocate the "Sync Watch" button from the dashboard banner to the settings modal.
- [x] **Hide Team IDs:** Remove the display of Team IDs from the UI, showing only team names.

### 2. Nostr Publishing
- [x] **Verify `kind:1301` Publishing Logic:** Review and confirm that `kind:1301` workout events are correctly published to user-defined private relays.

---

## Implementation Results

### 1. Remove Liked Songs Playlist ✅
- **File modified:** `src/pages/Music.jsx`
- **Changes:** Removed `fetchLikedPlaylist` import, `likedPlaylist` state, fetch logic, and inclusion in `userPlaylists`
- **Status:** Complete

### 2. Move Sync Watch Button ✅
- **Files modified:** 
  - `src/components/RunTracker.jsx` (removed button from banner)
  - `src/pages/Settings.jsx` (added button to new "Integrations" section)
- **Changes:** 
  - Added imports for `NostrContext`, `fetchRunDataFromWatch`, `mapWatchDataToRun`, and `SyncConfirmationModal`
  - Added state variables: `isSyncingWatch`, `syncedRun`, `showSyncModal`
  - Added `handleSyncFromWatch` function
  - Created new "Integrations" section with Bangle.js sync button
  - Added `SyncConfirmationModal` component
- **Status:** Complete

### 3. Hide Team IDs ✅
- **File modified:** `src/pages/TeamDetailPage.tsx`
- **Changes:** Removed the "Team ID" column from the team information grid, leaving only "Captain" and "Visibility"
- **Verification:** Checked other team-related components (`TeamsPage.tsx`, `DefaultTeamSetting.tsx`) - they only display team names, not IDs
- **Status:** Complete

### 4. Verify `kind:1301` Publishing Logic ✅
- **Files reviewed:** 
  - `src/utils/runPublisher.js`
  - `src/contexts/SettingsContext.jsx` 
  - `src/utils/nostr.js`
- **Findings:** 
  - ✅ `runPublisher.js` correctly calls `getActiveRelayList()` to get user-configured relays
  - ✅ `getActiveRelayList()` properly reads from localStorage and builds relay list based on publish mode
  - ✅ `createAndPublishEvent()` correctly uses `opts.relays` to create `NDKRelaySet` for targeted publishing
  - ✅ When specific relays are provided, the function throws an error if publishing fails (no fallback to default relays)
  - ✅ This ensures `kind:1301` events are sent to user-specified private relays as intended
- **Status:** Complete - No issues found

---

## Summary

All requested tasks have been completed successfully:

1. **Liked Songs playlist** has been removed from the Music page
2. **Sync Watch button** has been moved from the dashboard to the Settings modal under a new "Integrations" section
3. **Team IDs** are no longer displayed to users in any UI components
4. **`kind:1301` publishing logic** has been verified and is working correctly for user-defined private relays

The codebase is now cleaner and the user experience has been improved according to the specifications. 