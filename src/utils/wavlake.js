// Constants for playlist types
export const PLAYLIST = "playlist";
export const TOP_40 = "top-40";
export const LIKED = "liked";

/**
 * Base fetch function with headers and error handling
 */
const fetchWithHeaders = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Get rankings (featured tracks)
 */
export const fetchRankings = async (days = 7, limit = 40) => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=${days}&limit=${limit}`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
};

/**
 * Get track metadata by ID
 */
export const getTrackById = async (trackId) => {
  try {
    const data = await fetchWithHeaders(`/content/track/${trackId}`);
    return data;
  } catch (error) {
    console.error('Error fetching track:', error);
    throw error;
  }
};

/**
 * Get stream URL for a track
 */
export const getTrackStreamUrl = (trackId) => {
  if (!trackId) return null;
  return `/api/v1/stream/track/${trackId}`;
};

/**
 * Search for content
 */
export const searchContent = async (term) => {
  try {
    const data = await fetchWithHeaders(`/content/search?term=${encodeURIComponent(term)}`);
    return data;
  } catch (error) {
    console.error('Error searching content:', error);
    throw error;
  }
};

/**
 * Create NIP-88 playlist event
 */
const createPlaylistEvent = (name, description, tracks = []) => {
  return {
    kind: 30088, // NIP-88 playlist kind
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'wavlake-playlist'],
      ['name', name],
      ['description', description],
      ...tracks.map(track => ['t', track.id, track.title, track.artist])
    ],
    content: JSON.stringify({
      name,
      description,
      tracks: tracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist
      }))
    })
  };
};

/**
 * Get liked playlist using NIP-98 auth and NIP-88 format
 */
export const fetchLikedPlaylist = async () => {
  if (!window.nostr) {
    throw new Error('Nostr not available');
  }

  try {
    // First get the rankings as initial tracks
    const tracks = await fetchRankings();
    
    // Create NIP-88 playlist event
    const playlistEvent = createPlaylistEvent(
      'Liked Tracks',
      'My liked tracks on Wavlake',
      tracks
    );

    // Sign the event
    const signedEvent = await window.nostr.signEvent(playlistEvent);

    return {
      id: LIKED,
      title: "Liked",
      tracks,
      isPrivate: true,
      event: signedEvent
    };
  } catch (error) {
    console.error('Error fetching liked playlist:', error);
    return {
      id: LIKED,
      title: "Liked",
      tracks: [],
      isPrivate: true
    };
  }
}; 