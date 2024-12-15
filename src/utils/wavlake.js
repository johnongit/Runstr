import { getToken } from "nostr-tools/nip98";

export const PLAYLIST = "playlist";
export const TOP_40 = "top-40";
export const LIKED = "liked";

const WAVLAKE_API_BASE_URL = "https://api.wavlake.com/v1";
const WAVLAKE_CATALOG_API_BASE_URL = "https://catalog.wavlake.com/v1";

const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const fetchTop40 = async () => {
  try {
    const response = await fetchWithTimeout(
      `${WAVLAKE_API_BASE_URL}/content/rankings?sort=sats&days=7&limit=40`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch top 40');
    }
    const tracks = await response.json();
    return { id: TOP_40, title: "Top 40", tracks };
  } catch (error) {
    console.error('Error fetching top 40:', error);
    throw error;
  }
};

export const fetchLikedPlaylist = async () => {
  if (!window.nostr) {
    throw new Error('Nostr not available');
  }

  try {
    const url = `${WAVLAKE_CATALOG_API_BASE_URL}/library/tracks`;
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: await getToken(
          url,
          "get",
          (event) => window.nostr.signEvent(event),
          true,
        ),
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch liked tracks');
    }

    const data = await response.json();
    return {
      id: LIKED,
      title: "Liked",
      tracks: data.data?.tracks || [],
      isPrivate: true,
    };
  } catch (error) {
    console.error('Error fetching liked playlist:', error);
    throw error;
  }
}; 