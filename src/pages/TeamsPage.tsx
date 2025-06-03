import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPublicTeams, 
  NostrTeamEvent,
  getTeamName,
  getTeamDescription,
  getTeamCaptain,
  getTeamUUID,
} from '../services/nostr/NostrTeamsService';
import { useNostr } from '../hooks/useNostr';
import { awaitNDKReady } from '../lib/ndkSingleton';

const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<NostrTeamEvent[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { ndk } = useNostr();

  useEffect(() => {
    const initializeAndLoadTeams = async () => {
      setIsLoadingTeams(true);
      setFetchError(null);
      setTeams([]);

      console.log("TeamsPage: Checking NDK readiness via awaitNDKReady() directly...");
      const isNdkDirectlyReady = await awaitNDKReady();

      if (isNdkDirectlyReady && ndk) {
        console.log("TeamsPage: NDK is directly ready. Fetching public teams...");
        try {
          const fetchedTeams = await fetchPublicTeams(ndk);
          setTeams(fetchedTeams);
          if (fetchedTeams.length === 0) {
            console.log("No public NIP-101e teams found.");
          }
        } catch (err: any) {
          console.error("Error fetching teams:", err);
          setFetchError(err.message || "Failed to load teams list.");
        } finally {
          setIsLoadingTeams(false);
        }
      } else {
        console.warn("TeamsPage: NDK not directly ready or NDK instance from context is missing.");
        setFetchError("Could not connect to Nostr relays to fetch teams list. Please check your network and relay configuration.");
        setIsLoadingTeams(false);
      }
    };

    initializeAndLoadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [ndk]);

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nostr Teams (NIP-101e)</h1>
        <Link
          to="/teams/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Create New Team
        </Link>
      </div>

      <div className="mt-4">
        {isLoadingTeams && (
          <div className="p-4 text-white text-center">Loading NIP-101e teams...</div>
        )}
        {!isLoadingTeams && fetchError && (
          <div className="text-center text-red-400 py-10 bg-gray-800 rounded-lg p-4">
            <p className="text-lg">Error Loading Teams</p>
            <p className="text-sm mt-2">{fetchError}</p>
            <p className="text-sm mt-2">You can still try to create a new team.</p>
          </div>
        )}
        {!isLoadingTeams && !fetchError && teams.length === 0 && (
          <div className="text-center text-gray-400 py-10 bg-gray-800 rounded-lg p-4">
            <p className="text-lg">No public NIP-101e teams found.</p>
            <p>Why not be the first to create one?</p>
          </div>
        )}
        {!isLoadingTeams && !fetchError && teams.length > 0 && (
          <ul className="space-y-4">
            {teams.map((team) => {
              const teamNameStr = getTeamName(team);
              const teamDescription = getTeamDescription(team);
              const captainPubkey = getTeamCaptain(team);
              const teamUUIDVal = getTeamUUID(team);

              if (!teamUUIDVal || !captainPubkey) {
                console.warn("Team event found without a UUID or Captain:", team);
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeamsPage; 