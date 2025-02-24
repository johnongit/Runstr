import { nip98 } from 'nostr-tools';

// todo: move this to env variables
const WAVLAKE_CATALOG_API_BASE_URL = 'https://catalog.wavlake.com/v1';
const WAVLAKE_API_BASE_URL = 'https://wavlake.com/api/v1';

// Constants for playlist types
export const PLAYLIST = 'playlist';
export const TOP_40 = 'top-40';
export const TRENDING_ROCK_PLAYLIST_ID = 'trending-rock';
export const TRENDING_HIPHOP_PLAYLIST_ID = 'trending-hiphop';
export const LIKED = 'liked';

/**
 * Base fetch function with headers and error handling
 */
const fetchWithHeaders = async (endpoint, options = {}) => {
  try {
    const url = `${WAVLAKE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
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
 * Fetch trending tracks filtered by genre
 */
export const fetchTrendingPlaylistByGenre = async (genre) => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&genre=${genre}&limit=40`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
};

export const fetchTrendingRock = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('rock');

  return { id: TRENDING_ROCK_PLAYLIST_ID, title: 'Rock', tracks: playlist };
};

export const fetchTrendingHipHop = async () => {
  const playlist = await fetchTrendingPlaylistByGenre('hip-hop');

  return {
    id: TRENDING_HIPHOP_PLAYLIST_ID,
    title: 'Hip-Hop',
    tracks: playlist
  };
};

/**
 * Fetch Top 40 tracks
 */
export const fetchTop40 = async () => {
  try {
    const data = await fetchWithHeaders(
      `/content/rankings?sort=sats&days=7&limit=40`
    );
    const tracks = Array.isArray(data) ? data : [];
    return { id: TOP_40, title: 'Top 40', tracks };
  } catch (error) {
    console.error('Error fetching top40:', error);
    throw error;
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
    const data = await fetchWithHeaders(
      `/content/search?term=${encodeURIComponent(term)}`
    );
    return data;
  } catch (error) {
    console.error('Error searching content:', error);
    throw error;
  }
};

export const fetchLibraryPlaylists = async (pubkey) => {
  return fetch(`${WAVLAKE_CATALOG_API_BASE_URL}/playlists/user/${pubkey}`)
    .then((res) => res.json())
    .then((res) => res.data);
};

/**
 * Get liked playlist using NIP-98 auth and NIP-88 format
 */
export const fetchLikedPlaylist = async () => {
  const url = `${WAVLAKE_CATALOG_API_BASE_URL}/library/tracks`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: await nip98.getToken(
          url,
          'get',
          (event) => window.nostr.signEvent(event),
          true
        )
      }
    });

    const tracks = await res.json().then((res) => res.data.tracks);

    return {
      id: LIKED,
      title: 'Liked',
      tracks,
      isPrivate: true
    };
  } catch (error) {
    console.error('Error fetching liked playlist:', error);
    throw error;
  }
};

export const fetchPlaylistById = async (playlistId) => {
  const response = await fetch(
    `${WAVLAKE_API_BASE_URL}/content/playlist/${playlistId}`
  );
  if (!response.ok) {
    const error = new Error(`Failed to fetch playlist: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return { id: playlistId, ...(await response.json()) };
};

export const fetchPlaylist = async (playlistId) => {
  switch (playlistId) {
    case TOP_40:
      return fetchTop40();
    case TRENDING_ROCK_PLAYLIST_ID:
      return fetchTrendingRock();
    case TRENDING_HIPHOP_PLAYLIST_ID:
      return fetchTrendingHipHop();
    default:
      return fetchPlaylistById(playlistId);
  }
};
