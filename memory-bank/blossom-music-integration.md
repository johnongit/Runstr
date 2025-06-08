# Brainstorming: Blossom Music Integration

This document outlines a plan for integrating Blossom servers as a music source in the RUNSTR app.

## 1. Core Goal

To allow users to connect their personal Blossom media servers to RUNSTR, browse their stored audio files, and play them using the app's existing music player. The secondary goal is to explore mirroring content from other sources like `blossom.primal.net`.

---

## 2. Phase 1: Playback from a Blossom Server

This phase focuses on the primary read-only functionality: finding and playing music.

### User Experience

1.  **Configuration:** In the **Settings** page, a new section "Media Server" or "Blossom Integration" will be added. It will contain an input field for the user to enter their Blossom server URL (e.g., `https://blossom.band`).
2.  **Browsing:** In the **Music** page, a new section titled "My Blossom Library" will appear if a server is configured. This section will list the playable audio tracks from the user's server.
3.  **Playback:** Clicking on a track from the Blossom library will load it into the existing `MusicPlayer` component and begin playback, just like any track from WavLake.

### Technical Implementation Plan

1.  **Blossom API Utility (`src/lib/blossom.js`):**
    *   Create a new utility file for handling communication with Blossom servers.
    *   **`listTracks(serverUrl, pubkey)` function:**
        *   This function will call the `GET <serverUrl>/list/<pubkey>` endpoint. The user's `pubkey` can be retrieved from `window.nostr.getPublicKey()`.
        *   It needs to handle optional **NIP-98 authentication**, similar to how `fetchLikedPlaylist` in `src/utils/wavlake.js` works. We can reuse that pattern.
        *   The function must **filter the results**. A Blossom server can store any file type. We'll need to inspect the returned data for each blob (likely checking a `type` or `mime_type` field, or falling back to file extension) and only include audio files (e.g., `audio/mpeg`, `audio/wav`, `video/mp4`).

2.  **Audio Player Integration (`src/contexts/AudioPlayerProvider.jsx`):**
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

## 4. Open Questions & Next Steps

1.  **What is the exact structure of the data returned by the `GET /list/<pubkey>` endpoint?** This is the most important question. We need to know if it includes mime types for filtering and titles for display.
2.  **How do we handle blobs without metadata?** We need a fallback strategy for displaying tracks if a title isn't available.
3.  **Are most Blossom servers private?** We should assume authentication might be needed and build `nip98` support from the start. 