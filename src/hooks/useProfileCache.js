import { useCallback } from 'react';
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton';

// Module-level cache and status tracking
const profileCache = new Map();
// Status: 'idle', 'fetching', 'fetched', 'error'
const fetchingStatus = new Map();

/**
 * Safely parses profile content from a Nostr event.
 * @param {string} contentString - The JSON string content of a kind 0 event.
 * @returns {object|null} Parsed profile object or null if parsing fails.
 */
const parseProfileContent = (contentString) => {
  if (typeof contentString !== 'string') {
    return null;
  }
  try {
    const profileData = JSON.parse(contentString);
    // Basic validation: ensure it's an object
    if (typeof profileData !== 'object' || profileData === null) {
      return null;
    }
    return {
      name: profileData.name || profileData.display_name || profileData.displayName,
      picture: profileData.picture,
      about: profileData.about,
      banner: profileData.banner,
      lud06: profileData.lud06,
      lud16: profileData.lud16,
      nip05: profileData.nip05,
      website: profileData.website,
      // Add any other fields you might need
    };
  } catch (error) {
    console.error("[useProfileCache] Error parsing profile content:", error);
    return null;
  }
};

export const useProfileCache = () => {
  const fetchProfiles = useCallback(async (pubkeys = []) => {
    // Ensure NDK is ready before proceeding
    try {
      const isNdkReady = await ndkReadyPromise;
      if (!isNdkReady) {
        console.error('[useProfileCache] NDK is not ready. Aborting profile fetch.');
        return new Map();
      }
    } catch (error) {
      console.error('[useProfileCache] Error awaiting NDK readiness:', error);
      return new Map();
    }
    
    // NDK instance is imported and should be available if ndkReadyPromise resolved true
    if (!ndk) { 
      console.error('[useProfileCache] NDK instance unexpectedly not available after readiness check.');
      return new Map(); 
    }

    const uniquePubkeys = [...new Set(pubkeys.filter(pk => typeof pk === 'string' && pk.trim() !== ''))];
    if (uniquePubkeys.length === 0) {
      return new Map();
    }

    const pubkeysToFetch = uniquePubkeys.filter(pk => {
      const status = fetchingStatus.get(pk);
      return !profileCache.has(pk) && (status === undefined || status === 'idle' || status === 'error');
    });

    if (pubkeysToFetch.length > 0) {
      // console.log('[useProfileCache] Need to fetch profiles for:', pubkeysToFetch);
      pubkeysToFetch.forEach(pk => fetchingStatus.set(pk, 'fetching'));

      try {
        const events = await ndk.fetchEvents({ kinds: [0], authors: pubkeysToFetch });
        
        const fetchedProfilesMap = new Map();
        if (events && events.size > 0) {
          events.forEach(event => {
            const parsed = parseProfileContent(event.content);
            if (parsed && event.pubkey) {
              // Only add to cache if name or picture exists to avoid caching empty profiles
              if (parsed.name || parsed.picture) {
                 profileCache.set(event.pubkey, parsed);
                 fetchedProfilesMap.set(event.pubkey, parsed); // Keep track of what was fetched in this run
              }
              fetchingStatus.set(event.pubkey, 'fetched');
            } else if (event.pubkey) {
              // If parsing failed but we have a pubkey, mark as error to avoid re-fetching an unparsable profile
              fetchingStatus.set(event.pubkey, 'error');
            }
          });
        }
        
        // Mark any pubkeys that were requested but didn't return an event as 'error' 
        // to prevent immediate re-fetching, unless they were already fetched by another call.
        pubkeysToFetch.forEach(pk => {
          if (!fetchedProfilesMap.has(pk) && fetchingStatus.get(pk) === 'fetching') {
            // console.log(`[useProfileCache] No profile event returned for ${pk}, marking as error.`);
            fetchingStatus.set(pk, 'error'); 
          }
        });

      } catch (error) {
        console.error('[useProfileCache] Error fetching profile events:', error);
        pubkeysToFetch.forEach(pk => fetchingStatus.set(pk, 'error'));
      }
    }

    // Construct result map with all requested profiles that are now in cache
    const resultMap = new Map();
    uniquePubkeys.forEach(pk => {
      if (profileCache.has(pk)) {
        resultMap.set(pk, profileCache.get(pk));
      }
    });
    // console.log('[useProfileCache] Returning profiles:', resultMap);
    return resultMap;
  }, []); // NDK dependency might be needed if it can change, but it's imported as a module constant.

  const getProfile = useCallback((pubkey) => {
    if (typeof pubkey !== 'string' || pubkey.trim() === '') {
      return undefined;
    }
    return profileCache.get(pubkey);
  }, []);

  return { fetchProfiles, getProfile };
}; 