import React, { useState, useEffect, memo } from 'react';
import { useProfileCache } from '../../hooks/useProfileCache';

interface DisplayNameProps {
  pubkey: string;
}

const DisplayNameComponent: React.FC<DisplayNameProps> = ({ pubkey }) => {
  const { getProfile, fetchProfiles } = useProfileCache();
  const [displayName, setDisplayName] = useState<string>(`${pubkey.substring(0, 8)}...`);

  useEffect(() => {
    if (!pubkey) return;
    
    const fetchDisplayName = async () => {
      try {
        // First fetch the profile from the network
        await fetchProfiles([pubkey]);
        
        // Then get it from cache
        const profile = getProfile(pubkey);
        if (profile) {
          const name = profile.display_name || profile.name;
          if (name) {
            setDisplayName(name);
          }
        }
      } catch (error) {
        console.error('DisplayName: Error fetching profile for', pubkey.substring(0, 8), error);
        // Keep the fallback hex display if fetching fails
      }
    };
    
    fetchDisplayName();
  }, [pubkey, getProfile, fetchProfiles]);

  return <span title={pubkey}>{displayName}</span>;
};

export const DisplayName = memo(DisplayNameComponent); 