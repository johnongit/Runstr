import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import { 
  fetchUserGroupList, 
  fetchUserGroupListWS,
  initializeNostr, 
  setAmberUserPubkey
} from '../utils/nostrClient';

// Create context
export const TeamsContext = createContext();

// Custom hook for using Teams context
export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
};

export const TeamsProvider = ({ children }) => {
  // Get Nostr context
  const { publicKey: nostrPublicKey } = useContext(NostrContext);
  
  // State for Nostr groups
  const [myNostrGroups, setMyNostrGroups] = useState([]);
  const [loadingNostrGroups, setLoadingNostrGroups] = useState(false);
  const [nostrInitialized, setNostrInitialized] = useState(false);
  
  // General state
  const [error, setError] = useState(null);

  // Initialize Nostr when component mounts
  useEffect(() => {
    const initNostr = async () => {
      try {
        console.log('TeamsContext: Initializing Nostr...');
        const initialized = await initializeNostr();
        console.log('TeamsContext: Nostr initialized result:', initialized);
        setNostrInitialized(initialized);
        if (!initialized) {
          setError('Failed to connect to Nostr network');
        }
      } catch (err) {
        console.error('Error initializing Nostr:', err);
        setError('Failed to initialize Nostr connection');
      }
    };

    initNostr();
  }, []); // Run once on mount

  // Update currentUser and fetch groups when nostrPublicKey changes
  useEffect(() => {
    const fetchNostrGroups = async () => {
      if (!nostrPublicKey || !nostrInitialized) {
        setMyNostrGroups([]);
        return;
      }

      try {
        setLoadingNostrGroups(true);
        setError(null);
        
        // Set Amber public key for nostrClient.js
        setAmberUserPubkey(nostrPublicKey);

        console.log('TeamsContext: Fetching user groups for pubkey:', nostrPublicKey);
        
        try {
          // Use WebSocket implementation to avoid SimplePool issues
          const groups = await fetchUserGroupListWS(nostrPublicKey);
          console.log('TeamsContext: Fetched groups using WebSocket:', groups);
          setMyNostrGroups(groups || []);
        } catch (wsErr) {
          console.error('WebSocket approach failed, trying fallback:', wsErr);
          
          try {
            // Fallback to original implementation if WebSocket fails
            const groups = await fetchUserGroupList(nostrPublicKey);
            console.log('TeamsContext: Fetched groups using fallback:', groups);
            setMyNostrGroups(groups || []);
          } catch (fallbackErr) {
            console.error('Error in fallback approach:', fallbackErr);
            setError('Failed to fetch Nostr groups');
            setMyNostrGroups([]);
          }
        }
      } catch (err) {
        console.error('Error in overall fetch process:', err);
        setError('Failed to fetch Nostr groups');
        setMyNostrGroups([]);
      } finally {
        setLoadingNostrGroups(false);
      }
    };

    // Fetch groups whenever nostrPublicKey changes and Nostr is initialized
    if (nostrInitialized) {
      console.log('TeamsContext: nostrPublicKey changed, fetching groups...');
      fetchNostrGroups();
    }
  }, [nostrPublicKey, nostrInitialized]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    myNostrGroups,
    loadingNostrGroups,
    error,
    clearError,
    nostrInitialized
  };

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
};

TeamsProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 