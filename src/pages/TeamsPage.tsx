import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router for navigation
import { 
  fetchPublicTeams, 
  NostrTeamEvent,
  getTeamName,
  getTeamDescription,
  getTeamCaptain,
  getTeamUUID,
  // isTeamPublic // Already used inside fetchPublicTeams for filtering
} from '../services/nostr/NostrTeamsService'; // Corrected path
import { useNostr } from '../hooks/useNostr'; // Corrected path


const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<NostrTeamEvent[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState<boolean>(false); // Renamed for clarity
  const [fetchError, setFetchError] = useState<string | null>(null); // Renamed for clarity

  const { ndk, ndkReady, ndkError } = useNostr(); // Get ndkError as well

  useEffect(() => {
    // Only attempt to load teams if NDK is ready and available
    if (ndkReady && ndk) {
      const loadTeams = async () => {
        setIsLoadingTeams(true);
        setFetchError(null);
        try {
          console.log("TeamsPage: NDK is ready, fetching public teams...");
          const fetchedTeams = await fetchPublicTeams(ndk);
          setTeams(fetchedTeams);
          if (fetchedTeams.length === 0) {
            console.log("No public teams found or returned by fetchPublicTeams.");
          }
        } catch (err) {
          console.error("Error fetching teams:", err);
          setFetchError("Failed to load teams. Please try again.");
        } finally {
          setIsLoadingTeams(false);
        }
      };
      loadTeams();
    } else {
      // If NDK is not ready, don't show teams loading, but reset teams list
      setTeams([]);
      setIsLoadingTeams(false); 
    }
  }, [ndk, ndkReady]);

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nostr Teams</h1>
        <Link 
          to="/teams/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Create New Team
        </Link>
      </div>

      {/* Conditional rendering for team list area based on NDK status */}
      {!ndkReady ? (
        <div className="text-center text-yellow-400 py-10 bg-gray-800 rounded-lg p-4">
          <p className="text-lg">Connecting to Nostr to fetch public teams...</p>
          {ndkError && <p className="text-sm text-red-400 mt-2">Details: {ndkError}</p>}
          <p className="text-sm mt-2">You can still create a new team.</p>
        </div>
      ) : isLoadingTeams ? (
        <div className="p-4 text-white text-center">Loading teams...</div>
      ) : fetchError ? (
        <div className="p-4 bg-red-800 text-white rounded-md text-center">Error: {fetchError}</div>
      ) : teams.length === 0 ? (
        <div className="text-center text-gray-400 py-10 bg-gray-800 rounded-lg p-4">
            <p className="text-lg">No public NIP-101e teams found.</p>
            <p>Why not be the first to create one?</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => {
            const teamNameStr = getTeamName(team);
            const teamDescription = getTeamDescription(team);
            const captainPubkey = getTeamCaptain(team);
            const teamUUIDVal = getTeamUUID(team); // Renamed to avoid conflict

            if (!teamUUIDVal) {
                console.warn("Team event found without a UUID (d-tag):", team);
                return null; 
            }

            return (
              <li key={team.id || `${captainPubkey}-${teamUUIDVal}`} className="bg-gray-800 shadow-lg rounded-lg p-5 hover:bg-gray-700 transition-colors duration-150">
                <Link to={`/teams/${captainPubkey}/${teamUUIDVal}`} className="block">
                  <h2 className="text-xl font-semibold text-blue-400 hover:text-blue-300 mb-2">
                    {teamNameStr}
                  </h2>
                </Link>
                <p className="text-gray-300 mb-3 text-sm">
                    {teamDescription.substring(0, 150)}{teamDescription.length > 150 ? '...' : ''}
                </p>
                <div className="text-xs text-gray-500">
                    <p>Captain: <span className="font-mono text-gray-400">{captainPubkey.substring(0,10)}...{captainPubkey.substring(captainPubkey.length - 5)}</span></p>
                    {/* <p>Team ID: <span className="font-mono">{teamUUID}</span></p> */}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TeamsPage; 