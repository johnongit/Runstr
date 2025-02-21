import { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export const NostrContext = createContext(null);

export function NostrProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);

  useEffect(() => {
    const initNostr = async () => {
      if (window.nostr) {
        try {
          const pubkey = await window.nostr.getPublicKey();
          setPublicKey(pubkey);
        } catch (error) {
          console.error('Error getting Nostr public key:', error);
        }
      }
    };

    initNostr();
  }, []);

  return (
    <NostrContext.Provider value={{ publicKey }}>
      {children}
    </NostrContext.Provider>
  );
}

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};
