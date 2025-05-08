# RUNSTR – NIP-29 "Teams / Group Chat" Implementation Journal
_Last updated: 2024-06-14_

---

## Background
RUNSTR originally shipped a partial implementation of NIP-29 group chats (kind 9), but
recently the Teams screen stopped showing messages and group metadata.  
Primary symptoms:
* **UI:** Team chat screen renders but stays empty.
* **Console:** NDK never reaches the "initialised/connected" state.
* **Metadata:** Group profiles (kind 39000) often fail to load.

---

## Timeline of Work & Findings

### 1  Initial Diagnostics  ("Phase 0")  
* Confirmed `TeamDetail` parses the `naddr` param correctly.  
* Discovered **`isInitialized` flag** in `NostrContext` stayed `false` because we
  returned `false` if _zero relays_ were connected **immediately** after
  calling `ndk.connect()`.  
* Noted inconsistent tag usage:  
  * Metadata queries used `#d` (correct)  
  * Chat queries sometimes still used legacy `#g` (should be `#h`)

---

### 2  First Fix Attempts  
| Attempt | Change | Result |
|---------|--------|--------|
| **2-A** | Removed strict `connectedCount == 0` guard in `NostrProvider`. | `isInitialized` still stayed `false`; chats still empty. |
| **2-B** | Skipped the `isInitialized` check in components. | Metadata fetch fired but relays were not yet connected; still no data. |
| **2-C** | Switched tag from `#g` → `#h` for chat filters. | No visible effect while NDK not ready. |

---

### 3  Comprehensive Refactor Plan  
We drafted a **six-phase plan**:

1. **Linter / hygiene cleanup**  
2. **NostrContext refactor** – introduce a 3 s grace period (`waitForFirstRelay`), expose `ndkReady` & live `relayCount`.  
3. **Relay helpers** – `ensureRelays(relayUrls)` to add & connect hints.  
4. **ndkGroups.js rewrite** – standardized helpers for parsing naddr, fetching metadata/messages, subscribing, and sending.  
5. **Component updates** – `TeamDetail` & `ChatRoom` now watch `ndkReady`, call `ensureRelays`, and use new helpers.  
6. **Send-message path** hook-up + manual QA.

---

### 4  Implementation Completed (Phases 1-5)  
Files created / replaced:

```
src/contexts/NostrContext.jsx   // refactored singleton + grace period
src/utils/relays.js             // ensureRelays helper
src/utils/ndkGroups.js          // full NIP-29 helper suite
src/pages/TeamDetail.jsx        // Phase-4 rewrite
src/components/ChatRoom.jsx     // Phase-4 rewrite
```

Key improvements:
* NDK waits up to 3 s for first `relay:connect` → sets `ndkReady`.
* Components rely on `ndkReady` & live `relayCount` instead of legacy flag.
* All filters now use **`#h`** for messages and **`#d`** for metadata.
* `ensureRelays` attaches relay hints from each group before data queries.

---

### 5  New Runtime Issues (present)  
1. **React warning:**  
   > "Cannot update a component while rendering another …"  
   Triggered by calling `loadFullGroupData` inside a `useEffect` before that
   function is defined (function hoisting doesn't apply to const-arrow
   functions).  
2. **ReferenceError:**  
   > `Cannot access 'loadFullGroupData' before initialization`  
   Root cause same as above – the arrow function is referenced prior to
   declaration.

3. **NDK still not ready fast enough for first render**  
   * Console shows `ndkReady: false, relayCount: 0` during multiple re-renders.
   * `ensureRelays` logs "All relays already known", so hints are at least
     registered.

---

## Outstanding Problems (as of this entry)

1. **`TeamDetail.jsx` ordering bug**  
   * Move `loadFullGroupData` _above_ its first `useEffect` call **or** wrap it
     in `useCallback` declared before the effect.

2. **NDK readiness race**  
   * Sometimes the 3 s timeout is not enough; consider increasing to 5 s or
     subscribing to `pool:relay:connect` events instead of fixed timeout.

3. **Chats still blank** even after initial messages fetch is called.  
   Debug ideas:  
   * Verify the `fetchGroupMessages` promise actually resolves with events.  
   * Check if relays (`groups.0xchat.com`) return events for the `#h` filter
     from an external script (e.g. `nostcat`).  
   * Ensure kind 9 events are signed with correct **`h` tag** _and_ **`p`
     (author) tag_ when published.

---

## Next Investigative Steps

1. **Fix function-order bug** in `TeamDetail.jsx` so the component mounts without runtime errors.
2. **Console-log any events** returned by `fetchGroupMessages` to confirm relay data.
3. **Add a manual relay connection check** in `ensureRelays` (e.g. wait for
   `relay.status === 1`) before marking ready.
4. **Write a headless test script** (`scripts/verify-nip29.cjs`) that:
   * Connects to same relays
   * Runs the `#h` filter for a known group ID
   * Dumps number of events returned
   This isolates UI from relay / NDK issues.

---

## Useful Commands & Snippets

```ts
// Quick one-off: verify messages from CLI
npx nostcat \
  --relay wss://groups.0xchat.com \
  --filter '{"kinds":[9], "#h":["<rawGroupId>"], "limit":5}'
```

```js
// Inside browser console after NDK injected on window:
window.ndk.fetchEvents([{ kinds:[9], '#h':[rawGroupId], limit:5 }])
  .then(evts => console.log('Found', evts.length, 'events'))
```

---

## Appendix A – Tag Reference

| Use-case       | Kind | Tag | Example |
|----------------|------|-----|---------|
| **Group metadata** | 39000 | `#d` | `["d", "<rawGroupId>"]` |
| **Group message**  | 9     | `#h` | `["h", "<rawGroupId>"]` |

*Legacy* `#g` tag is obsolete.

---

## Appendix B – Key Components & Helpers

* **`NostrContext.jsx`** – singleton NDK instance, `initNdk`, `ndkReady`.
* **`relays.js`** – `ensureRelays(relayUrls, opts?)`.
* **`ndkGroups.js`**  
  * `parseNaddr(naddr) → { rawGroupId, relays }`  
  * `fetchGroupMetadataByNaddr(naddr)`  
  * `fetchGroupMessages(rawGroupId, {limit, relays})`  
  * `subscribeToGroupMessages(rawGroupId, cb, relays)`  
  * `sendGroupMessage(rawGroupId, content)`

---

*End of log – keep appending new findings below this line.*

---

### Date: 2024-07-10 - Debugging Session & Refinements

**Summary of Changes & Attempts:**

1.  **Pre-flight Checks (Phase 0):**
    *   Verified `@nostr-dev-kit/ndk` version is `^2.13.0-rc2`. Recommended update to `2.14.9` (latest stable).
    *   Confirmed `wss://groups.0xchat.com` is present in `src/config/relays.js`.

2.  **`TeamDetail.jsx` Function Stability (Phase 1, Thought 4):
    *   `loadFullGroupData` was already wrapped in `useCallback` and defined before its `useEffect` uses it.
    *   Wrapped `loadGroupMembers` in `useCallback` with dependencies `[ndk, fetchProfiles, groupMetadataEvent, setAdmins, setMembers, setError]`. The apply model made additional (unrequested at the time) logic changes to member/admin fetching within this function, which were carried forward.

3.  **NDK Readiness in `NostrContext.jsx` (Phase 1, Thought 5):
    *   Removed custom `waitForFirstRelay` helper.
    *   Modified `initNdk` to use `await ndk.awaitConnection(1, 8000)` with a try-catch for timeouts.
    *   Added more detailed logging around `ndk.connect()`, `ndk.awaitConnection()`, and `setNdkReady` calls in `NostrProvider`.

4.  **`waitForConnectedRelays` Utility (Phase 1, Thought 6):
    *   Added `export const waitForConnectedRelays = async (minRelays = 1, timeoutMs = 8000)` to `src/utils/relays.js`, which uses `ndk.awaitConnection` internally.

5.  **ID Handling in `ndkGroups.js` (Phase 2, Thought 8):
    *   Reviewed existing `parseNaddr` - found it suitable for extracting `rawGroupId`.
    *   Added `getRawGroupId(naddrOrRawId)` utility to handle inputs that might be full naddrs or already raw IDs.

6.  **NIP-29 Tag/Kind Standardization (Phase 2, Thought 9):
    *   `sendGroupMessage`: Changed to publish Kind 39001, added `['p', userPubkey]` tag.
    *   `fetchGroupMessages` & `subscribeToGroupMessages`: Updated filters to include Kinds `[39001, 9]`.

7.  **`ChatRoom.jsx` Relay Hint Handling (Debug Step):
    *   Modified `TeamDetail.jsx` to pass parsed `relayHintsRef.current` as a prop (`passedRelayHints`) to `ChatRoom.jsx`.
    *   Modified `ChatRoom.jsx` to use `passedRelayHints` prop directly, removing its internal naddr parsing for hints.

8.  **WebSocket Fallback for Metadata (Debug Step):
    *   Updated `fetchGroupMetadataByNaddr` in `src/utils/ndkGroups.js` to first attempt fetch via NDK (`ndk.fetchEvent()` with `NDKRelaySet` from hints), then fall back to a direct WebSocket connection method if the NDK attempt fails or returns no event.

**Current Status & Observations (based on latest logs - YYYY-MM-DD HH:MM anHourAgo):**

*   **SUCCESS:** `GroupDiscoveryScreen.jsx` continues to successfully fetch metadata using its *direct WebSocket method*.
*   **SUCCESS:** `TeamDetail.jsx` correctly parses `naddr` into `rawGroupId` and `relayHints`.
*   **SUCCESS:** `ChatRoom.jsx` now correctly receives `relayHints` as a prop.
*   **SUCCESS:** `fetchGroupMessages` in `ndkGroups.js` is called with correct Kinds and `relayHints`.
*   **FAILURE:** Metadata and messages are still NOT displaying in `TeamDetail.jsx` / `ChatRoom.jsx`.
*   **BLOCKER:** Console logs from `TeamDetail.jsx` (e.g., `TeamDetail NDK-dependent useEffect ... ndkReady: false ...`) indicate that `ndkReady` from `NostrContext` is still `false` when `TeamDetail.jsx` attempts to load data. This prevents `loadFullGroupData` (and thus `fetchGroupMetadataByNaddr`) from being called from `TeamDetail.jsx`.
*   **ISSUE:** The `fetchGroupMetadataByNaddr` (with NDK attempt + WS fallback) is likely not being reached from `TeamDetail` due to the `ndkReady: false` issue.
*   **LOGS MISSING:** Crucial logs from `NostrContext.jsx` (added to trace `ndkReady` state changes) were not present in the last provided log set. These are needed to diagnose why `ndkReady` isn't turning `true`.
*   **Network Errors:** Persistent "FetchEvent for <URL> resulted in a network error response" and `sw.js` errors indicate potential underlying network or service worker issues that might be affecting NDK's ability to connect or fetch, but the primary focus remains on `ndkReady` propagation.

**Next Steps (Re-prioritized based on findings):**

1.  **CRITICAL: Re-run application and capture console logs, specifically looking for the detailed logs from `NostrContext.jsx` related to `ndk.connect()`, `ndk.awaitConnection()`, and `setNdkReady(true/false)` calls.** This is essential to confirm if/when NDK initialization completes and if `ndkReady` state is correctly updated and propagated.
2.  If `ndkReady` is confirmed to be set to `true` by `NostrContext` but `TeamDetail.jsx` still sees it as `false` in its `useEffect`, investigate React context propagation or component re-render timing issues.
3.  If `ndkReady` *never* becomes `true` in `NostrContext`, analyze the new `NostrContext` logs to pinpoint failure in `initNdk` (e.g., `ndk.awaitConnection` consistently failing/timing out, errors during signer attachment).
4.  Once `ndkReady` is reliably `true` in `TeamDetail.jsx` and `loadFullGroupData` is called:
    *   Verify if `fetchGroupMetadataByNaddr` (NDK or WS fallback) successfully loads metadata.
    *   Verify if `fetchGroupMessages` (NDK, with its own WS fallback to be potentially added later) successfully loads initial messages.
    *   Verify if `subscribeToGroupMessages` establishes a working subscription.

---

### Date: 2024-07-11 - Hybrid Implementation Progress & Debugging

**Summary of Multi-Phase Implementation (Option B - Hybrid Approach):**

*   **Phase 0 & 1: `NostrContext.jsx` Hardening & NDK Version**
    *   User manually verified message history exists on relays.
    *   NDK package `uuid` was missing and installed (`npm install uuid` and `@types/uuid`).
    *   `NostrContext.jsx` was updated to include an awaitable `ndkReadyPromise`, which resolves based on NDK connection status (timeout 15s). Detailed logging for NDK initialization was enhanced.

*   **Phase 2: `src/utils/wsFetch.js` Created**
    *   New utility `fetchEventsViaWebSocket` implemented to allow direct WebSocket fetching of Nostr events as a fallback mechanism. This includes multi-relay support, timeout, and unique event aggregation.

*   **Phase 3 & Subsequent Re-application: Hybrid Helpers in `src/utils/ndkGroups.js`**
    *   `fetchGroupMessages` completely refactored:
        *   Now takes an `options` object: `{ limit, relays, kinds, since, until }`.
        *   Attempts NDK fetch with a 4-second timeout.
        *   Falls back to `fetchEventsViaWebSocket` if NDK fails/times out or returns no events.
        *   Ensures `limit` passed to NDK/WS is a number.
        *   Sorts messages newest first.
        *   Maps raw events from WS fallback to `NDKEvent` instances.
    *   `subscribeToGroupMessages` updated:
        *   Now `async` and awaits `ndkReadyPromise`.
        *   If NDK is not ready or no relays are connected, it logs a warning and returns a mock `unsub` (no WS live subscription fallback in this iteration).
        *   If NDK is ready, proceeds with NDK-based subscription.
    *   `ensureMessagesForDebug` utility added for easier testing.
    *   Initial application of these changes seemed to have issues with `fetchGroupMessages` still using an old signature/logic. Re-applied the correct hybrid versions.

*   **Phase 4 & Subsequent Fix: Relay Helper Improvements in `src/utils/relays.js`**
    *   `ensureRelays` refactored to be `async`.
    *   Initial attempt to use `ndk.pool.ensureRelay(url)` caused runtime error `ndk.pool.ensureRelay is not a function`.
    *   Updated `ensureRelays` to first try `ndk.connectToRelay()` and then fallback to `ndk.pool.addRelay()`. This aims to inform NDK of the relays and initiate connection attempts.

*   **Phase 5: `ChatRoom.jsx` Integration**
    *   Main `useEffect` for data loading refactored:
        *   Awaits the improved `ensureRelays(passedRelayHints)`.
        *   Calls the hybrid `fetchGroupMessages` for initial message load.
        *   Calls the updated `subscribeToGroupMessages`, passing a `since` timestamp derived from the latest loaded message.
        *   Handles message state (sorted newest first) and loading/error states.

*   **Phase 7: Caching & Polish**
    *   `ChatRoom.jsx`:
        *   Added `useEffect` to load messages from `localStorage` (`chatMessages_${groupId}`) on mount/`groupId` change, converting raw events to `NDKEvent`.
        *   Added `useEffect` to save messages (as raw events, newest 50) to `localStorage` when `messages` state or `groupId` changes.
        *   Logic in `loadAndSubscribe` updated to merge fetched messages with cached ones.
        *   Auto-scroll to bottom behavior was commented out due to newest-first display.
    *   `src/utils/ndkGroups.js`:
        *   Added in-memory `metadataCache` to `fetchGroupMetadataByNaddr` to cache results from NDK or WS fallback.

**Current Status & Observations (from latest user feedback & logs):**

*   **SUCCESS:** Messages are now visible in the chat UI! This is a major breakthrough.
*   **ISSUE (Fixed):** Error `ndk.pool.ensureRelay is not a function` in `ensureRelays`.
    *   **Attempted Fix:** `ensureRelays` was modified to try `ndk.connectToRelay()` and then fallback to `ndk.pool.addRelay()`. The logs (`relays.js:40 [ensureRelays] ndk.connectToRelay is not a function. Using ndk.pool.addRelay...`) show this fallback is being used.
*   **NEW ISSUE (From Logs):** `relays.js:70 [ensureRelays] Error or timeout processing relay wss://groups.0xchat.com/: Cannot read properties of undefined (reading 'includes')`.
    *   **Fix Attempted:** The logic inside the `ndk.pool.addRelay` fallback in `ensureRelays` was simplified to avoid complex promise handling that might have led to this error. It now just adds the relay and pauses briefly.
*   **POTENTIAL ISSUE (From Logs):** The filter logged by `fetchGroupMessages` (`ndkGroups.js:284`) showed `limit` as an object: `limit: {relays: [...], limit: 50}`. This was due to the older version of `fetchGroupMessages` being active. The re-application of the correct `fetchGroupMessages` (which destructures `options` object) in thought_11 should have fixed this. User needs to confirm with new logs if the filter construction for NDK is now correct (i.e., `limit` is a number).
*   **Metadata Fetching:** `GroupDiscoveryScreen.jsx` successfully uses its direct WebSocket method. `fetchGroupMetadataByNaddr` in `ndkGroups.js` attempts NDK and then falls back to its own direct WS method, now with in-memory caching.
*   **NDK Readiness:** `TeamDetail.jsx` still logs `NDK not ready yet. Waiting...` initially, which is expected. The key is that `ndkReadyPromise` should eventually resolve and allow dependent operations (like NDK subscriptions) to proceed.

**Next Steps & Focus for User Testing:**

1.  **Verify `ensureRelays` Fix:** Confirm no more `Cannot read properties of undefined (reading 'includes')` errors from `relays.js`. Check console logs for the behavior of the simplified `ensureRelays`.
2.  **Confirm `fetchGroupMessages` Filter:** Ensure console logs from `ndkGroups.js` for `fetchGroupMessages` now show the `filter` object with a numeric `limit` value when attempting NDK fetch (e.g., `limit: 50`).
3.  **Test Chat Functionality (Comprehensive):**
    *   Loading initial messages (from cache & network - NDK or WS fallback).
    *   Real-time message subscription (new messages appearing).
    *   Sending messages.
    *   Correct sorting (newest first).
    *   Behavior across different groups and navigation.
4.  **Report any new errors or persistent issues.**

*Further work will focus on any remaining bugs or UI polish for the chat features based on testing feedback.*

---

### Date: 2024-07-12 - Resolution & Final State

**Summary:**
After implementing the multi-phase "Option B - Hybrid Approach" and subsequent debugging, the NIP-29 chat functionality is now largely operational.

**Key Fixes & Outcomes:**

1.  **Hybrid Fetching Implemented:**
    *   `fetchGroupMessages` (`ndkGroups.js`) now successfully uses NDK first (with timeout) and falls back to direct WebSocket (`wsFetch.js`) for initial message history, ensuring messages load even with NDK delays.
    *   `subscribeToGroupMessages` (`ndkGroups.js`) awaits `ndkReadyPromise` before attempting NDK subscription for real-time updates.
2.  **NDK Readiness Handling:**
    *   `NostrContext.jsx` now exports `ndkReadyPromise`, providing a reliable signal for NDK initialization completion.
3.  **Relay Management (`ensureRelays`):**
    *   Initial refactors using `ndk.pool.ensureRelay` or `ndk.connectToRelay` failed due to API unavailability/version issues.
    *   Simplified `ensureRelays` (`relays.js`) to synchronously use `ndk.pool.addRelay(url, true)` as a fallback, removing problematic async logic and resolving runtime errors.
4.  **Metadata Handling (`TeamDetail.jsx`):**
    *   Removed the secondary metadata fetch (`fetchGroupMetadataByNaddr`) from `TeamDetail.jsx` to avoid issues related to `ensureRelays` errors and NDK readiness timing.
    *   Navigation from `GroupDiscoveryScreen.jsx` now passes the already-fetched group name and picture via route `state`.
    *   `TeamDetail.jsx` uses `useLocation` to retrieve and display this passed metadata, simplifying the component and ensuring the header loads correctly.
5.  **UI Fixes (`ChatRoom.jsx`):**
    *   Implemented scrolling for the message list using `overflow-y: auto`.
    *   Adjusted layout (using flexbox) to ensure the message input form is always visible.
6.  **Caching:**
    *   `localStorage` caching implemented in `ChatRoom.jsx` for the last 50 messages, improving perceived load times.
    *   In-memory caching implemented in `ndkGroups.js` for `fetchGroupMetadataByNaddr`.

**Final Status:**
*   Users can now view group chat history (loaded via hybrid fetch).
*   The chat UI is scrollable and includes the message input form.
*   Group metadata (name/picture) is displayed reliably in the header by passing it from the previous screen.
*   Sending and receiving real-time messages should be functional via NDK subscription (dependent on `ndkReadyPromise`).

**Potential Minor Issues/Considerations:**
*   The `ensureRelays` function relies on the `ndk.pool.addRelay` fallback, which might not guarantee immediate connection status like more explicit NDK methods would.
*   Real-time subscription only works if `ndkReadyPromise` resolves successfully.
*   Further UI polish and error handling can be added as needed.

*This concludes the intensive debugging and refactoring effort for NIP-29. Core functionality is restored.*

### Date: 2024-08-18 - UI Refactor & Bug Hunt

**Goal:** Fix message order, display user profiles/avatars, render rich content (links/images), and polish general UI (button contrast, text wrapping, pin button alignment) in `ChatRoom.jsx`.

**Changes Made:**
1.  **Message Order/Scroll:** Reversed message sort order (`oldest first`) and implemented auto-scroll to bottom in `ChatRoom.jsx`.
2.  **Profile Display:** 
    *   Initially attempted using `useRunProfile` hook - **Failure:** Realized this hook was for local user settings, not fetching external profiles.
    *   Corrected by adding local `profiles` state (Map) to `ChatRoom.jsx`.
    *   Added `useEffect` hook to fetch missing profiles (Kind 0) for message authors using `ndk.fetchEvents`.
    *   Updated message rendering to display avatar and name from the `profiles` state map.
3.  **Rich Content:** Added `MessageContentRenderer` component within `ChatRoom.jsx` to parse message content and render clickable URLs and inline image previews.
4.  **UI Polish:**
    *   Created `ChatRoom.css` and imported it.
    *   Added flexbox layout and styles to `ChatRoom.css` for `message-item`, `message-avatar`, `message-main-area`, `message-header`, `message-body`, `pin-button` to ensure proper alignment and text wrapping.
    *   Removed inline styles from `ChatRoom.jsx` root div and other elements now covered by CSS.
    *   Verified active tab button styles in `RunClub.css` - found `.tab-button.active` already had correct contrast (white text on blue bg), no changes needed there.
5.  **Bug Fixing (Attempt 1 - Blinking):** Identified potential re-render loop caused by profile fetching effect updating `profiles` state, which was in its own dependency array. Optimized `setProfiles` updater function to only return a new Map reference if data actually changed. **Result:** Blinking still occurred.
6.  **Bug Fixing (Attempt 2 - Profile Fetch Refactor):** Refactored profile fetching logic to use the shared `fetchEvents` utility from `nostr.js` instead of calling `ndk.fetchEvents` directly. **Result:** Blinking still occurred.
7.  **Bug Fixing (Attempt 3 - Dependency Array):** Removed `profiles` state map from the dependency array of the profile-fetching `useEffect` hook to break the potential re-render loop. **Result:** Still observing blinking UI, including parent component header, although errors related to `.get` and `.has` on undefined `profiles` seem resolved.

**Results:**
*   **Partial Success:** Message order, user profile display logic (fetching and rendering placeholders), rich content rendering, and general layout/styling improvements were implemented.
*   **Failure:** Persistent blinking/flashing of the chat UI and the parent component's header indicates rapid re-renders are still happening, likely related to state updates or effect dependencies, despite optimizations.

**Next Steps:**
*   Investigate remaining causes of re-renders. Could `ndkReady` be flapping? Is the message subscription causing issues?
*   Consider more aggressive memoization (`React.memo`, `useMemo`, `useCallback`) around message items or the `ChatRoom` component itself, although the root cause seems to be state update frequency.
*   Re-evaluate the dependency arrays of all major `useEffect` hooks in `ChatRoom.jsx`.

---

### Date: 2024-08-19 - Current Status & Next Steps

**Recent UI Changes:**
1.  **Group Avatar Removal:** The main group avatar image in the `TeamDetail.jsx` header has been commented out. This was done to resolve a persistent blinking issue associated with its display.
2.  **Group Header Metadata:** Metadata for the group header (name and picture, though picture is now removed) is now primarily passed via route `state` when navigating from `GroupDiscoveryScreen.jsx` to `TeamDetail.jsx`, simplifying metadata fetching in `TeamDetail.jsx`.

**Current Known Issues & Status:**

1.  **Usernames in Chat:** Chat messages in `ChatRoom.jsx` currently display users' raw hexadecimal npubs instead of their profile names. The logic to fetch profile names exists but may not be functioning as expected. This is the immediate next development focus.
2.  **Rich Content:** There is no support for rendering rich content like clickable URLs or inline images within chat messages.
3.  **Message Posting (Android):** The functionality of sending messages from the Android application environment is untested and its status is unknown.
4.  **Message Posting (Browser with Extension):** When using the application in a web browser with a Nostr browser extension (e.g., for key management), the `ChatRoom.jsx` component incorrectly indicates that a Nostr key connection is required to send messages. This prevents users with extensions from sending messages.
5.  **Blinking Issues:** The major UI blinking previously observed seems to be resolved. The group avatar blinking was fixed by removing the avatar. The chat message area blinking was likely related to attempts to render user avatars alongside messages; since the focus is now only on names (and avatars were previously disabled in profile fetching for chat), this specific blinking is not currently an active problem.

**Next Development Focus:**
*   Ensure that user profile names are correctly fetched and displayed in `ChatRoom.jsx` for each message author, replacing the raw hex npubs.
*   Investigate and resolve the issue preventing message sending from browsers when a Nostr extension is managing the user's key.

---

### Date: 2024-08-19 - Failure: Displaying Usernames/Avatars

**Goal:** Replace hex npubs with usernames and avatars in `ChatRoom.jsx`.

**Summary of Efforts:**
1.  Created `useProfileCache` hook for centralized profile fetching (Kind 0).
2.  Integrated `useProfileCache` into `ChatRoom.jsx`.
3.  Fixed multiple underlying issues:
    *   Resolved NDK internal errors in relay management (`ensureRelays`).
    *   Resolved NIP-07 signer interaction errors.
    *   Refactored `NostrProvider` initialization logic multiple times to ensure `ndkReady` state and `ndkReadyPromise` are correctly handled asynchronously.
    *   Modified `ChatRoom` profile fetching effect to `await ndkReadyPromise`.

**Current Status & Outcome:**
*   **FAILURE:** Usernames and avatars are still not displayed in the chat. Only hex pubkeys are visible.
*   **Root Cause Analysis:** Logs indicate that despite fixes, the `ndkReadyPromise` seems to never resolve successfully from the perspective of the `ChatRoom` component's profile-fetching `useEffect`. Although the promise *should* be resolving in `NostrProvider`, the `await ndkReadyPromise` in `ChatRoom` doesn't appear to unblock the effect, thus preventing the profile fetching logic (`fetchProfiles` via `useProfileCache`) from executing.

**Next Steps:**
*   Re-examine the interaction between `NostrProvider`'s `useEffect`, `initNdk`, `ndkReadyPromise` resolution, and `ChatRoom`'s `useEffect`.
*   Add more granular logging around the promise resolution in `NostrProvider` and the `await` point in `ChatRoom`.
*   Consider alternative state management or signaling mechanisms for NDK readiness if context propagation proves unreliable for this async scenario.

---
