import { useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext.jsx';

/**
 * Hook to access the NostrContext
 * @returns {Object} The Nostr context values
 */
export function useNostr() {
  return useContext(NostrContext);
}

export default useNostr; 