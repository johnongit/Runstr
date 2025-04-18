import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import teamsDataService from '../services/TeamsDataService';
import { NostrContext } from './NostrContext';
import { getUserPublicKey, fetchUserGroupList, initializeNostr, setAmberUserPubkey } from '../utils/nostrClient';

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
        
        // Set the pubkey in nostrClient for Amber authentication
        setAmberUserPubkey(nostrPublicKey);
        
        // Initialize Nostr client with proper relay connections
        const initialized = await initializeNostr();
        if (!initialized) {
          console.error("Failed to initialize Nostr client");
          setError('Failed to connect to Nostr network');
          return;
        }
        
        // --- Fetch Nostr Groups --- 
        setLoadingNostrGroups(true);
        setError(null); // Clear previous errors
        
        try {
          console.log("Fetching Nostr groups from relays...");
          const groups = await fetchUserGroupList(nostrPublicKey);
          console.log("Fetched Nostr groups:", groups);
          
          if (groups && groups.length > 0) {
            setMyNostrGroups(groups);
          } else {
            console.log("No groups found for user");
            setMyNostrGroups([]);
          }
        } catch (err) {
          console.error('Error loading My Nostr Clubs in context:', err);
          setError('Failed to load your Nostr clubs.');
          setMyNostrGroups([]); // Clear on error
        } finally {
          setLoadingNostrGroups(false);
        }
      } else {
        console.log("No Nostr public key available");
        setMyNostrGroups([]);
        setLoadingNostrGroups(false);
      }
    };

    syncNostrUserAndFetchGroups();
  }, [nostrPublicKey]); // Only depend on nostrPublicKey changes

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