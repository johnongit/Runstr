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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { ndk, ndkReady } = useNostr(); // Get NDK from your context

  useEffect(() => {
    if (!ndkReady || !ndk) {
      // Wait for NDK to be ready, or show appropriate message
      setIsLoading(false); // Not loading if NDK isn't ready
      // setError("Nostr client not ready. Waiting for connection..."); // Optional: inform user
      if (ndkReady === false) { // Check explicit false, as it could be null/undefined initially
        console.log("TeamsPage: NDK not ready yet.");
      }
      return;
    }

    const loadTeams = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("TeamsPage: NDK is ready, fetching public teams...");
        const fetchedTeams = await fetchPublicTeams(ndk); // Pass NDK instance
        setTeams(fetchedTeams);

        if (fetchedTeams.length === 0) {
            console.log("No public teams found or returned by fetchPublicTeams.");
        }

      } catch (err) {
        console.error("Error fetching teams:", err);
        setError("Failed to load teams. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [ndk, ndkReady]); // Depend on NDK instance and its readiness

  if (isLoading) {
    return <div className="p-4 text-white text-center">Loading teams...</div>;
  }

  if (!ndkReady && !isLoading) {
      return <div className="p-4 text-white text-center">Connecting to Nostr... <br/> If this persists, please check your relay connections.</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-800 text-white rounded-md text-center">Error: {error}</div>;
  }

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

      {teams.length === 0 ? (
        <div className="text-center text-gray-400 py-10">
            <p className="text-lg">No public teams found.</p>
            <p>Why not be the first to create one?</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => {
            const teamName = getTeamName(team);
            const teamDescription = getTeamDescription(team);
            const captainPubkey = getTeamCaptain(team);
            const teamUUID = getTeamUUID(team);

            // Every valid team event should have a UUID from its d-tag
            if (!teamUUID) {
                console.warn("Team event found without a UUID (d-tag):", team);
                return null; 
            }

            return (
              <li key={team.id || `${captainPubkey}-${teamUUID}`} className="bg-gray-800 shadow-lg rounded-lg p-5 hover:bg-gray-700 transition-colors duration-150">
                <Link to={`/teams/${captainPubkey}/${teamUUID}`} className="block">
                  <h2 className="text-xl font-semibold text-blue-400 hover:text-blue-300 mb-2">
                    {teamName}
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