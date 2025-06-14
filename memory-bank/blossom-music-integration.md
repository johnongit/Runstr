# Brainstorming: Blossom Music Integration

This document outlines a plan for integrating Blossom servers as a music source in the RUNSTR app.

## 1. Core Goal

To allow users to connect their personal Blossom media servers to RUNSTR, browse their stored audio files, and play them using the app's existing music player. The secondary goal is to explore mirroring content from other sources like `blossom.primal.net`.

---

## 2. Phase 1: Playback from a Blossom Server ✅ COMPLETED

This phase focuses on the primary read-only functionality: finding and playing music.

### User Experience

1.  **Configuration:** In the **Settings** page, a new section "Media Server" or "Blossom Integration" will be added. It will contain an input field for the user to enter their Blossom server URL (e.g., `https://blossom.band`).
2.  **Browsing:** In the **Music** page, a new section titled "My Blossom Library" will appear if a server is configured. This section will list the playable audio tracks from the user's server.
3.  **Playback:** Clicking on a track from the Blossom library will load it into the existing `MusicPlayer` component and begin playback, just like any track from WavLake.

### Technical Implementation Plan

1.  **Blossom API Utility (`src/lib/blossom.js`):** ✅ COMPLETED
    *   Create a new utility file for handling communication with Blossom servers.
    *   **`listTracks(serverUrl, pubkey)` function:**
        *   This function will call the `GET <serverUrl>/list/<pubkey>` endpoint. The user's `pubkey` can be retrieved from the existing Nostr context/provider in the app.
        *   It needs to handle **required NIP-98 authentication** (based on blossom.band documentation showing authentication is required for `/list/<pubkey>`), similar to how `fetchLikedPlaylist` in `src/utils/wavlake.js` works. We can reuse that pattern.
        *   The function must **filter the results**. A Blossom server can store any file type. We'll need to inspect the returned data for each blob (likely checking a `type` or `mime_type` field, or falling back to file extension) and only include audio files (e.g., `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/flac`).

2.  **Settings Storage (`src/contexts/SettingsProvider.jsx` or similar):** ✅ COMPLETED
    *   Add a new setting for `blossomServerUrl` that persists to local storage.
    *   Include validation to ensure the URL is properly formatted.
    *   Provide methods to get/set the Blossom server URL that other components can use.

3.  **Audio Player Integration (`src/contexts/AudioPlayerProvider.jsx`):** ✅ COMPLETED
    *   The existing `loadPlaylist` function will be updated to recognize a new, special-purpose playlist ID, for instance, `"blossom"`.
    *   When `loadPlaylist("blossom")` is called, the provider will use the new `blossom.js` utility to fetch the list of tracks.
    *   It will then map the Blossom blob data into the track format the player expects: `{ id, title, mediaUrl }`.
        *   `id`: The sha256 hash of the blob.
        *   `title`: **This is a critical point.** We need to determine how to get a human-readable title. Ideally, the `/list` endpoint provides metadata. If not, we might need to look for an associated Nostr event (like kind `10063` mentioned in the Blossom spec) that contains file metadata. As a fallback, we could display the filename, but that's a worse user experience.
        *   `mediaUrl`: The direct URL to the file: `<serverUrl>/<sha256>`.

---

## 3. Phase 2: Mirroring Content (e.g., from Primal)

This is a more complex "write" operation that should be tackled after playback is working.

### User Goal

A user wants to find a song on another platform (like Primal) and easily add it to their own Blossom server library to be played in RUNSTR.

### Technical Challenges (Based on BUD-04)

The `PUT /mirror` endpoint is designed for a client to tell Server B to copy a file from Server A. However, the specification requires the client to authorize this action with a signed `upload` event that already contains the **sha256 hash** of the file.

This creates a "chicken-and-egg" problem:
*   To ask our server to mirror a file from `blossom.primal.net`, we first need the file's hash.
*   But to get the hash, we'd have to download the entire file to the client first.

### Potential Solutions & Tradeoffs

1.  **Client-Side Hashing (The Slow Method):**
    *   **How:** The RUNSTR app downloads the remote MP4 file to the user's device, calculates its sha256 hash, signs the auth event, and then calls `PUT /mirror`.
    *   **Pros:** It would work according to the spec.
    *   **Cons:** Extremely inefficient. It forces the user to download the file, potentially on a mobile connection, just to have a server download it again. This is likely a non-starter due to poor performance and high data usage.

2.  **Source API Inspection (The Ideal, but Unlikely Method):**
    *   **How:** We investigate if `blossom.primal.net` (or other sources) provides the file hash through an API or in HTTP headers (like `ETag`).
    *   **Pros:** Highly efficient.
    *   **Cons:** This is not standardized. It's unlikely that all media servers will provide this. It would require custom integration for each source.

### Recommendation on Mirroring

The mirroring feature, as specified in BUD-04, seems challenging to implement in a user-friendly way for a client-side application.

**I recommend we defer this feature.** We should first focus on perfecting the playback experience from a user's pre-existing Blossom library. The mirroring concept can be revisited if the Blossom protocol evolves or if we find a more efficient way to get file hashes.

---

## 4. Key Technical Insights from Research

Based on the [blossom.band documentation](https://blossom.band), we now know:

1.  **Authentication is Required:** The `GET /list/<pubkey>` endpoint requires authentication via signed Nostr events (NIP-98). This is consistent across Blossom servers.
2.  **Supported Audio Formats:** Common audio formats are supported including `.wav`, `.mp3`, `.flac`, and `.mp4` (for audio/video).
3.  **File Size Limits:** Free tier has 100 MiB per upload limit, which should be sufficient for most audio files.
4.  **Metadata Support:** Servers support Nostr File Metadata Tags (NIP-94/BUD-08), which should provide proper titles and metadata for audio files.

## 5. Updated Implementation Considerations

### Mobile App Context
- **No `window.nostr`:** We'll use the existing Nostr context/provider that the app already has for signing events.
- **Persistent Storage:** The Blossom server URL must be saved to local storage so users don't need to re-enter it every time.
- **Network Efficiency:** Since this is a mobile app, we should implement proper loading states and error handling for network requests.

### Settings Integration
The settings page should include:
- Input field for Blossom server URL with validation
- Test connection button to verify the server is reachable
- Clear indication of connection status
- Option to clear/reset the server URL

## 6. Open Questions & Next Steps

1.  **What is the exact structure of the data returned by the `GET /list/<pubkey>` endpoint?** We need to test this with a real server to understand the blob descriptor format.
2.  **How are NIP-94 metadata tags structured?** This will determine how we extract titles and other metadata for display.
3.  **Should we support multiple Blossom servers?** For now, single server support seems sufficient, but this could be expanded later.

---

## 7. Phased Implementation Plan

Based on the existing codebase architecture, here are the implementation options:

### **Option A: Minimal Integration (Recommended Start)** ✅ COMPLETED
*Focus: Get basic playback working with minimal changes*

**Phase 1A: Settings Foundation (1-2 hours)** ✅ COMPLETED
- Extend `src/contexts/SettingsContext.jsx` to add `blossomServerUrl` (already has `blossomEndpoint` - we can reuse this!)
- Add UI in `src/pages/Settings.jsx` for Blossom server URL input
- Add basic URL validation and connection testing

**Phase 1B: Blossom API Utility (2-3 hours)** ✅ COMPLETED
- Create `src/lib/blossom.js` with `listTracks()` function
- Implement NIP-98 authentication using existing Nostr context
- Add audio file filtering logic
- Handle blob descriptor to track mapping

**Phase 1C: Music Page Integration (2-3 hours)** ✅ COMPLETED
- Modify `src/pages/Music.jsx` to show "My Blossom Library" section
- Create new `PlaylistSection` for Blossom tracks
- Integrate with existing `loadPlaylist()` in `AudioPlayerProvider`

**Phase 1D: Player Integration (1-2 hours)** ✅ COMPLETED
- Extend `src/contexts/AudioPlayerProvider.jsx` to handle "blossom" playlist ID
- Map Blossom tracks to existing track format
- Test playback with direct Blossom URLs

**Total Estimated Time: 6-10 hours** ✅ COMPLETED

### **Option B: Full Integration (More Comprehensive)**
*Focus: Complete feature with advanced functionality*

**Phase 2A: Enhanced Settings (2-3 hours)**
- Add connection status indicators
- Implement server capability detection
- Add multiple server support (future-proofing)
- Enhanced error handling and user feedback

**Phase 2B: Advanced Blossom Features (3-4 hours)**
- Implement NIP-94 metadata parsing for better track titles
- Add caching for track lists
- Implement background sync for track updates
- Add track artwork support if available

**Phase 2C: UI/UX Polish (2-3 hours)**
- Custom Blossom library UI components
- Loading states and error handling
- Search/filter functionality within Blossom library
- Integration with existing music player themes

**Phase 2D: Performance Optimization (1-2 hours)**
- Implement lazy loading for large libraries
- Add request debouncing
- Optimize for mobile performance

**Total Estimated Time: 8-12 hours**

### **Option C: Research & Prototype (Conservative Approach)**
*Focus: Validate assumptions before full implementation*

**Phase 3A: API Research (1-2 hours)**
- Test actual Blossom server responses
- Document blob descriptor format
- Validate NIP-94 metadata availability
- Test authentication requirements

**Phase 3B: Minimal Prototype (2-3 hours)**
- Create standalone test component
- Implement basic server communication
- Test audio playback with direct URLs
- Validate technical approach

**Phase 3C: Integration Planning (1 hour)**
- Document integration points
- Plan data flow architecture
- Identify potential issues
- Create detailed implementation roadmap

**Total Estimated Time: 4-6 hours**

---

## 8. Implementation Summary - Phase 1 Complete ✅

**Phase 1 has been successfully implemented!** Here's what was accomplished:

### ✅ Completed Features:

1. **Settings Integration**
   - Added "Music Server" section to Settings page
   - Reused existing `blossomEndpoint` setting for music server URL
   - Added connection test button with real-time status feedback
   - Proper error handling and user feedback

2. **Blossom API Utility**
   - Created `src/lib/blossom.js` with comprehensive Blossom server communication
   - Implemented NIP-98 authentication using existing Nostr context
   - Audio file filtering by MIME type and file extension
   - Metadata extraction for track titles and artist names
   - Connection testing functionality

3. **Music Page Integration**
   - Added "My Blossom Library" section to Music page
   - Automatic loading of tracks when server URL is configured
   - Loading states, error handling, and empty state messages
   - Integration with existing `PlaylistSection` component

4. **Audio Player Integration**
   - Extended `AudioPlayerProvider` to handle direct playlist objects
   - Added support for Blossom tracks with direct mediaUrl playback
   - Seamless integration with existing music player controls
   - Proper track format mapping for compatibility

### 🎯 Key Technical Achievements:

- **Zero Breaking Changes**: All existing functionality remains intact
- **Mobile Optimized**: Proper loading states and error handling for mobile use
- **Authentication Ready**: Full NIP-98 support using existing Nostr infrastructure
- **Extensible Design**: Easy to add more features in Phase 2

### 🚀 Ready for Testing:

Users can now:
1. Go to Settings → Music Server
2. Enter their Blossom server URL (e.g., `https://blossom.band`)
3. Test the connection
4. Go to Music page to see their Blossom library
5. Play tracks directly from their personal Blossom server

### 📋 Next Steps (Optional Phase 2):

- Enhanced metadata parsing (NIP-94)
- Track artwork support
- Caching and performance optimization
- Multiple server support
- Advanced UI/UX improvements

**The basic Blossom music integration is now fully functional and ready for user testing!**

Would you like me to proceed with implementing Phase 1A, or would you prefer to discuss any of these options further?

---

## 9. ✅ PHASE 1 IMPLEMENTATION COMPLETE!

**Phase 1 has been successfully implemented!** Here's what was accomplished:

### ✅ Completed Features:

1. **Settings Integration**
   - Added "Music Server" section to Settings page
   - Reused existing `blossomEndpoint` setting for music server URL
   - Added connection test button with real-time status feedback
   - Proper error handling and user feedback

2. **Blossom API Utility**
   - Created `src/lib/blossom.js` with comprehensive Blossom server communication
   - Implemented NIP-98 authentication using existing Nostr context
   - Audio file filtering by MIME type and file extension
   - Metadata extraction for track titles and artist names
   - Connection testing functionality

3. **Music Page Integration**
   - Added "My Blossom Library" section to Music page
   - Automatic loading of tracks when server URL is configured
   - Loading states, error handling, and empty state messages
   - Integration with existing `PlaylistSection` component

4. **Audio Player Integration**
   - Extended `AudioPlayerProvider` to handle direct playlist objects
   - Added support for Blossom tracks with direct mediaUrl playback
   - Seamless integration with existing music player controls
   - Proper track format mapping for compatibility

### 🎯 Key Technical Achievements:

- **Zero Breaking Changes**: All existing functionality remains intact
- **Mobile Optimized**: Proper loading states and error handling for mobile use
- **Authentication Ready**: Full NIP-98 support using existing Nostr infrastructure
- **Extensible Design**: Easy to add more features in Phase 2

### 🚀 Ready for Testing:

Users can now:
1. Go to Settings → Music Server
2. Enter their Blossom server URL (e.g., `https://blossom.band`)
3. Test the connection
4. Go to Music page to see their Blossom library
5. Play tracks directly from their personal Blossom server

### 📋 Next Steps (Optional Phase 2):

- Enhanced metadata parsing (NIP-94)
- Track artwork support
- Caching and performance optimization
- Multiple server support
- Advanced UI/UX improvements

**The basic Blossom music integration is now fully functional and ready for user testing!**

## 10. Retrieval Issues & Proposed Solutions *(Draft – Needs Validation)*

> ❗ **Context:**  RUNSTR's Phase 1 integration works for some servers (e.g. `blossom.band`) but _fails to show any tracks_ on several user-hosted Blossom instances.  The Bouquet and Blossom-Drive projects do succeed against the same servers, so we need to understand the gap and decide on a minimal, reliable fix.

### 10.1 Quick Diagnosis

| Area | RUNSTR (current) | Bouquet / Blossom-Drive | Potential Impact |
|------|------------------|-------------------------|------------------|
| **Discovery Endpoint** | Tries multiple hard-coded patterns:<br>`/list/<pubkey>`, `/nip96/list/<pubkey>`, etc. | Primarily uses **`/nip96/list/<pubkey>`** (Bouquet) or **`GET /list?pubkey=` query style** (Blossom-Drive). | If our first attempt fails and fallback logic has a bug, we may exit early and report zero tracks. |
| **Auth Strategy** | Generates NIP-98 header once per request. | Same, _but_ retries with **Anonymous GET** if the server advertises `AllowUnauthenticated=true`. | Some self-hosted servers are configured as public; they will _reject_ signed requests that include headers they don't expect. |
| **MIME Filter** | Accepts only exact `audio/*` or file-extension whitelist. | Accepts **any blob** first, then filters **client-side** by `type` _and_ `kind 1063` metadata. | RUNSTR might be discarding valid audio that uses uncommon MIME (e.g. `application/octet-stream`). |
| **Pagination Handling** | Assumes single-page JSON array. | Iterates through `cursor` pagination until empty. | Large libraries may return only the first 100 rows. |
| **Error Handling** | `try/catch` on each endpoint; logs error, then returns `[]` immediately. | Logs error **but continues** trying other endpoints. | A thrown 404 on `/list/<pubkey>` may stop our loop prematurely. |

### 10.2 Hypotheses & Tests

1. **Unexpected 404 short-circuit**  – Verify that `getFilesFromBlossomServer()` still attempts the _next_ endpoint after a non-200.  Use a mock server to confirm.
2. **Signed vs Anonymous GET** – Attempt the same `GET /list/<pubkey>` _without_ the `Authorization:` header; compare responses.
3. **MIME Edge Cases** – Fetch raw list, count blobs that are `application/octet-stream` but have `.mp3`/`.wav` filename.
4. **Pagination** – Check for `?cursor=` or `?page=` parameters in Bouquet's network chatter when listing >100 files.

### 10.3 Solution Paths (Pick one or blend)

**Option A – Borrow Bouquet's Flow (Lowest Risk)**
1. Call `/nip96/list/<pubkey>?limit=500` first, unauthenticated.
2. If `401`, retry with NIP-98.
3. Iterate `while (resp.cursor)` to accumulate all blobs.
4. Post-filter blobs client-side by:
   * `kind === 1063` **OR** `mime?.startsWith('audio/')` **OR** filename regex `\.(mp3|flac|wav|m4a)$`.

**Option B – Capability Discovery (Future-Proof)**
1. Fetch server root `GET /.well-known/blossom.json` (proposed in spec–draft).
2. Parse advertised endpoints & auth modes.
3. Dynamically build the list of candidate URLs, then proceed as in Option A.

**Option C – Hybrid Blossom/NIP-96 Index**
1. For each user-configured server save both **type = 'blossom'** and **type = 'nip96'**.
2. In parallel, query both endpoint families; merge results.
3. De-duplicate by `sha256`.

### 10.4 Recommendation

Start with **Option A** to unblock users quickly.  It aligns with Bouquet's proven approach, adds minimal code, and improves resilience:

* Keeps logic in `src/lib/blossom.js` self-contained.
* Requires ~30 lines of additional code and no schema changes.
* Gets us pagination and broader MIME support "for free."

Once verified, we can layer in Option B for smarter discovery.

### 10.5 Follow-Up Questions

1. Which exact server URLs are users reporting failures on?
2. Do those servers require auth for listing blobs?
3. What is the average library size (to prioritise pagination work)?
4. Should we expose an "Unauthenticated Requests" toggle in Settings for edge cases?

---

*Draft prepared ▲ 2025-06-14* 