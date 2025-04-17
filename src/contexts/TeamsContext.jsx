import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import teamsDataService from '../services/TeamsDataService';
import { NostrContext } from './NostrContext';
import { getUserPublicKey, fetchUserGroupList } from '../utils/nostrClient';

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
  
  // State for centralized teams (if still needed)
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]); // Centralized teams user is a member of
  const [selectedTeam, setSelectedTeam] = useState(null); // For centralized teams
  
  // State for Nostr groups
  const [myNostrGroups, setMyNostrGroups] = useState([]);
  const [loadingNostrGroups, setLoadingNostrGroups] = useState(false);
  
  // General state
  const [loading, setLoading] = useState(true); // Loading state for centralized teams
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    // Prioritize Nostr pubkey if available from previous session
    return localStorage.getItem('currentNostrPubkey') || localStorage.getItem('currentUser') || null;
  });

  // Update currentUser when Nostr pubkey changes and trigger Nostr group fetch
  useEffect(() => {
    const syncNostrUserAndFetchGroups = async () => {
      if (nostrPublicKey) {
        console.log("Nostr public key available:", nostrPublicKey);
        setCurrentUser(nostrPublicKey);
        localStorage.setItem('currentNostrPubkey', nostrPublicKey); // Store Nostr key specifically
        
        // --- Fetch Nostr Groups --- 
        setLoadingNostrGroups(true);
        setError(null); // Clear previous errors
        try {
          // Load cached groups first
          const cacheKey = `my_nostr_groups_${nostrPublicKey}`;
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            setMyNostrGroups(JSON.parse(cachedData));
            setLoadingNostrGroups(false); // Show cached immediately
            console.log("Displayed cached Nostr groups.");
          } else {
             console.log("No cached Nostr groups found.");
             // Keep loading true if no cache
          }
          
          // Fetch fresh list from relays
          console.log("Fetching fresh Nostr groups from relays...");
          const groups = await fetchUserGroupList(nostrPublicKey);
          setMyNostrGroups(groups);
          console.log("Fetched fresh Nostr groups:", groups);
          
          // Cache the fresh list
          localStorage.setItem(cacheKey, JSON.stringify(groups));
          console.log("Cached fresh Nostr groups.");

        } catch (err) {
          console.error('Error loading My Nostr Clubs in context:', err);
          setError('Failed to load your Nostr clubs.');
          // Keep showing cached groups if fetch fails and cache existed
          if (!localStorage.getItem(cacheKey)) {
             setMyNostrGroups([]); // Clear if fetch fails and no cache
          }
        } finally {
          setLoadingNostrGroups(false); // Mark loading as complete
        }
        // --- End Fetch Nostr Groups --- 

      } else {
        console.log("No Nostr public key available.");
        // Optionally clear Nostr-specific data if user logs out of Nostr
        // setCurrentUser(localStorage.getItem('currentUser') || null); // Revert to non-Nostr user? Requires thought.
        setMyNostrGroups([]);
        localStorage.removeItem('currentNostrPubkey');
        // Consider clearing the cache for the logged-out pubkey? Or leave it?
      }
    };
    
    syncNostrUserAndFetchGroups();
  }, [nostrPublicKey]); // Rerun when Nostr public key changes

  // --- Centralized Team Functions (Keep if still needed, otherwise remove) --- 
  
  // Define the fetchTeams function (centralized)
  const fetchTeams = useCallback(() => {
    try {
      const allTeams = teamsDataService.getAllTeams();
      setTeams(allTeams);
    } catch (err) {
      console.error('Error fetching centralized teams:', err);
      setError('Failed to load centralized teams');
    }
  }, []);

  // Define the fetchMyTeams function (centralized)
  const fetchMyTeams = useCallback(() => {
    if (currentUser && !currentUser.startsWith('npub')) { // Only run for non-Nostr users?
      try {
        const userTeams = teamsDataService.getUserTeams(currentUser);
        setMyTeams(userTeams);
      } catch (err) { 
         // Handle error 
      }
    } else {
      setMyTeams([]);
    }
  }, [currentUser]);
  
  // Initialize the context (mostly for centralized teams now)
  useEffect(() => {
    setLoading(true);
    teamsDataService.initialize().then(() => {
        fetchTeams();
        fetchMyTeams();
        setLoading(false);
    });
    
    teamsDataService.addListener('teams', fetchTeams);
    teamsDataService.addListener('myTeams', fetchMyTeams);
    teamsDataService.addListener('error', (error) => setError(error));
    
    return () => {
      teamsDataService.removeListener('teams', fetchTeams);
      teamsDataService.removeListener('myTeams', fetchMyTeams);
      teamsDataService.removeListener('error', (error) => setError(error));
    };
  }, [currentUser, fetchTeams, fetchMyTeams]); // Re-initialize when user changes

  // Select a team (centralized)
  const selectTeam = useCallback((teamId) => {
     // ... implementation for selecting a centralized team ...
  }, []);

  // Create a team (centralized) - REMOVE IF NOT NEEDED
  const createTeam = useCallback(async (teamData) => {
     // ... remove create team logic ...
     console.warn("Team creation is disabled.");
     return null;
  }, [currentUser, fetchMyTeams]);

  // Join a team (centralized) - REMOVE IF NOT NEEDED
  const joinTeam = useCallback(async (teamId) => {
     // ... remove join team logic ...
     console.warn("Joining centralized teams is disabled.");
     return false;
  }, [currentUser]);

  // Leave a team (centralized) - REMOVE IF NOT NEEDED
  const leaveTeam = useCallback((teamId) => {
     // ... remove leave team logic ...
     console.warn("Leaving centralized teams is disabled.");
     return false;
  }, [currentUser, selectedTeam]);

  // Send message to team chat (centralized) - REMOVE IF NOT NEEDED
  const sendMessage = useCallback(async (teamId, content) => {
     // ... remove send message logic ...
     console.warn("Sending messages to centralized teams is disabled.");
     return null;
  }, [currentUser]);

  // --- End Centralized Team Functions --- 

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    // Centralized team state (if kept)
    teams,
    myTeams,
    selectedTeam,
    loading,
    
    // Nostr group state
    myNostrGroups,
    loadingNostrGroups,
    
    // General state
    error,
    currentUser,
    
    // Centralized team actions (if kept)
    selectTeam,
    createTeam, // Keep if needed, otherwise remove
    joinTeam,   // Keep if needed, otherwise remove
    leaveTeam,  // Keep if needed, otherwise remove
    sendMessage,// Keep if needed, otherwise remove
    
    // General actions
    clearError
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