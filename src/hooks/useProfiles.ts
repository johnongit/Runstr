import { useState, useEffect } from 'react';
import { useNostr } from './useNostr';
import { NDKUserProfile } from '@nostr-dev-kit/ndk';

const profileCache = new Map<string, NDKUserProfile>();

export const useProfiles = (pubkeys: string[]) => {
  const { ndk, ndkReady } = useNostr() as any;
  const [profiles, setProfiles] = useState<Record<string, NDKUserProfile>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ndkReady || !ndk || pubkeys.length === 0) {
        // Clear profiles if pubkeys array is empty
        if (pubkeys.length === 0) {
            setProfiles({});
        }
        return;
    }

    const uniquePubkeys = Array.from(new Set(pubkeys));
    const pubkeysToFetch = uniquePubkeys.filter(pk => !profileCache.has(pk));

    // Load profiles from cache immediately
    const cachedProfiles: Record<string, NDKUserProfile> = {};
    let allLoadedFromCache = true;
    for (const pk of uniquePubkeys) {
        if (profileCache.has(pk)) {
            cachedProfiles[pk] = profileCache.get(pk)!;
        } else {
            allLoadedFromCache = false;
        }
    }
    setProfiles(cachedProfiles);

    if (pubkeysToFetch.length === 0 && allLoadedFromCache) {
      return; // All profiles were in the cache
    }

    setIsLoading(true);
    const fetchProfiles = async () => {
      try {
        const users = pubkeysToFetch.map(pk => ndk.getUser({ pubkey: pk }));
        await Promise.all(users.map(u => u.fetchProfile({cacheUsage: "CACHE_FIRST"})));
        
        const newlyFetchedProfiles: Record<string, NDKUserProfile> = {};
        users.forEach(user => {
            if (user.profile) {
                newlyFetchedProfiles[user.pubkey] = user.profile;
                profileCache.set(user.pubkey, user.profile);
            }
        });
        
        setProfiles(prev => ({ ...prev, ...newlyFetchedProfiles }));

      } catch (error) {
        console.error("Failed to fetch profiles", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [ndk, ndkReady, JSON.stringify(pubkeys)]); // JSON.stringify to handle array changes

  return { profiles, isLoading };
}; 