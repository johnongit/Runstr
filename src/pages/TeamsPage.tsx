import React from 'react';
import { Link } from 'react-router-dom';
import { useNip101TeamsFeed } from '../hooks/useNip101TeamsFeed';
import { getTeamName, getTeamDescription, getTeamCaptain, getTeamUUID } from '../services/nostr/NostrTeamsService';
import { DisplayName } from '../components/shared/DisplayName';

const TeamsPage: React.FC = () => {
  const { teams, isLoading, error: fetchError, refetchTeams } = useNip101TeamsFeed();

  return (
    <div className="p-4 max-w-3xl mx-auto text-text-primary bg-bg-primary min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Teams</h1>
        <div className="flex items-center">
          <Link
            to="/teams/new"
            className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-md transition-all duration-150 ease-in-out shadow-lg border border-border-secondary"
          >
            Create New Team
          </Link>
        </div>
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="p-4 text-text-primary text-center">Loading NIP-101e teams...</div>
        )}
        {!isLoading && fetchError && (
          <div className="text-center text-error py-10 bg-bg-secondary rounded-lg p-4 border border-error">
            <p className="text-lg">Error Loading Teams</p>
            <p className="text-sm mt-2">{fetchError}</p>
            <p className="text-sm mt-2">Please check your connection or try refreshing. You can still create a new team.</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length === 0 && (
          <div className="text-center text-text-muted py-10 bg-bg-secondary rounded-lg p-4 border border-border-secondary">
            <p className="text-lg">No public NIP-101e teams found.</p>
            <p>Why not be the first to create one?</p>
          </div>
        )}
        {!isLoading && !fetchError && teams.length > 0 && (
          <ul className="space-y-4">
            {teams.map((team) => {
              return (
                <li key={team.id || `${team.captainPubkey}-${team.teamUUID}`} className="bg-bg-secondary shadow-lg rounded-lg p-5 hover:bg-bg-tertiary transition-all duration-150 border border-border-secondary">
                  <Link 
                    to={`/teams/${team.captainPubkey}/${team.teamUUID}`}
                    state={{ teamEvent: team.originalEvent }}
                    className="block"
                  >
                    <h2 className="text-xl font-semibold text-primary hover:text-primary-hover mb-2 transition-colors">
                      {team.name}
                    </h2>
                  </Link>
                  <p className="text-text-secondary mb-3 text-sm">
                    {team.description.substring(0, 150)}{team.description.length > 150 ? '...' : ''}
                  </p>
                  <div className="text-xs text-text-muted">
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