import React from 'react';
import { Link } from 'react-router-dom';
import { useNip101TeamsFeed } from '../hooks/useNip101TeamsFeed';
import { getTeamName, getTeamDescription, getTeamCaptain, getTeamUUID } from '../services/nostr/NostrTeamsService';
import { DisplayName } from '../components/shared/DisplayName';

const TeamsPage: React.FC = () => {
  const { teams, isLoading, error: fetchError, refetchTeams } = useNip101TeamsFeed();

  return (
    <div className="p-4 max-w-3xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teams</h1>
        <div className="flex items-center">
          <Link
            to="/teams/new"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-md transition-all duration-150 ease-in-out shadow-lg"
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
          <div className="text-center text-red-400 py-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-red-500/20">
            <p className="text-lg">Error Loading Teams</p>
            <p className="text-sm mt-2">{fetchError}</p>
            <p className="text-sm mt-2">Please check your connection or try refreshing. You can still create a new team.</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length === 0 && (
          <div className="text-center text-slate-400 py-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-purple-500/20">
            <p className="text-lg">No public NIP-101e teams found.</p>
            <p>Why not be the first to create one?</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length > 0 && (
          <ul className="space-y-4">
            {teams.map((team) => {
              return (
                <li key={team.id || `${team.captainPubkey}-${team.teamUUID}`} className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg rounded-lg p-5 hover:from-slate-700 hover:to-slate-800 transition-all duration-150 border border-purple-500/20">
                  <Link 
                    to={`/teams/${team.captainPubkey}/${team.teamUUID}`}
                    state={{ teamEvent: team.originalEvent }}
                    className="block"
                  >
                    <h2 className="text-xl font-semibold text-purple-400 hover:text-purple-300 mb-2 transition-colors">
                      {team.name}
                    </h2>
                  </Link>
                  <p className="text-slate-300 mb-3 text-sm">
                    {team.description.substring(0, 150)}{team.description.length > 150 ? '...' : ''}
                  </p>
                  <div className="text-xs text-slate-500">
                    <p>Captain: <DisplayName pubkey={team.captainPubkey} /></p>
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