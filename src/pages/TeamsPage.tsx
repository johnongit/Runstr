import React from 'react';
import { Link } from 'react-router-dom';
import { useNip101TeamsFeed } from '../hooks/useNip101TeamsFeed';
import { getTeamName, getTeamDescription, getTeamCaptain, getTeamUUID } from '../services/nostr/NostrTeamsService';

const TeamsPage: React.FC = () => {
  const { teams, isLoading, error: fetchError, refetchTeams } = useNip101TeamsFeed();

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nostr Teams (NIP-101e)</h1>
        <div className="flex items-center">
          <button 
            onClick={refetchTeams} 
            disabled={isLoading}
            className="mr-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50"
            title="Refresh Teams List"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            to="/teams/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out"
          >
            Create New Team
          </Link>
        </div>
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="p-4 text-white text-center">Loading NIP-101e teams...</div>
        )}
        {!isLoading && fetchError && (
          <div className="text-center text-red-400 py-10 bg-gray-800 rounded-lg p-4">
            <p className="text-lg">Error Loading Teams</p>
            <p className="text-sm mt-2">{fetchError}</p>
            <p className="text-sm mt-2">Please check your connection or try refreshing. You can still create a new team.</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length === 0 && (
          <div className="text-center text-gray-400 py-10 bg-gray-800 rounded-lg p-4">
            <p className="text-lg">No public NIP-101e teams found.</p>
            <p>Why not be the first to create one?</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length > 0 && (
          <ul className="space-y-4">
            {teams.map((team) => {
              return (
                <li key={team.id || `${team.captainPubkey}-${team.teamUUID}`} className="bg-gray-800 shadow-lg rounded-lg p-5 hover:bg-gray-700 transition-colors duration-150">
                  <Link to={`/teams/${team.captainPubkey}/${team.teamUUID}`} className="block">
                    <h2 className="text-xl font-semibold text-blue-400 hover:text-blue-300 mb-2">
                      {team.name}
                    </h2>
                  </Link>
                  <p className="text-gray-300 mb-3 text-sm">
                    {team.description.substring(0, 150)}{team.description.length > 150 ? '...' : ''}
                  </p>
                  <div className="text-xs text-gray-500">
                    <p>Captain: <span className="font-mono text-gray-400">{team.captainPubkey.substring(0,10)}...{team.captainPubkey.substring(team.captainPubkey.length - 5)}</span></p>
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