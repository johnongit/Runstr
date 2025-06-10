import React, { useState, useEffect, memo } from 'react';
import { useProfileCache } from '../../hooks/useProfileCache';

interface DisplayNameProps {
  pubkey: string;
}

const DisplayNameComponent: React.FC<DisplayNameProps> = ({ pubkey }) => {
  const { getProfile } = useProfileCache();
  const [displayName, setDisplayName] = useState<string>(`${pubkey.substring(0, 8)}...`);

  useEffect(() => {
    if (!pubkey) return;
    const fetchDisplayName = async () => {
      const profile = await getProfile(pubkey);
      if (profile) {
        const name = profile.display_name || profile.name;
        if (name) {
          setDisplayName(name);
        }
      }
    };
    fetchDisplayName();
  }, [pubkey, getProfile]);

  return <span title={pubkey}>{displayName}</span>;
};

export const DisplayName = memo(DisplayNameComponent); 