import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNip101TeamsFeed } from '../hooks/useNip101TeamsFeed';
import { useNostr } from '../hooks/useNostr';
import { useTeamRoles } from '../hooks/useTeamRoles';
import { getDefaultPostingTeamIdentifier, setDefaultPostingTeamIdentifier } from '../utils/settingsManager';

export default function Teams() {
  const navigate = useNavigate();
  const { ndk, ndkReady, publicKey } = useNostr();
  const { teams, isLoading, error, refresh } = useNip101TeamsFeed();
  const [userTeams, setUserTeams] = useState([]);
  const [isLoadingUserTeams, setIsLoadingUserTeams] = useState(false);
  const [defaultPostingTeam, setDefaultPostingTeam] = useState(null);

  // Load user's member teams and default posting team
  useEffect(() => {
    const loadUserTeams = async () => {
      if (!ndk || !ndkReady || !publicKey) return;
      
      setIsLoadingUserTeams(true);
      try {
        const { fetchUserMemberTeams } = await import('../services/nostr/NostrTeamsService');
        const memberTeams = await fetchUserMemberTeams(ndk, publicKey);
        setUserTeams(memberTeams);
        
        // Load current default posting team
        const defaultTeamId = getDefaultPostingTeamIdentifier();
        setDefaultPostingTeam(defaultTeamId);
      } catch (err) {
        console.error('Error loading user teams:', err);
      } finally {
        setIsLoadingUserTeams(false);
      }
    };

    loadUserTeams();
  }, [ndk, ndkReady, publicKey]);

  const handleSetDefaultTeam = (captainPubkey, teamUUID, teamName) => {
    const teamId = `${captainPubkey}:${teamUUID}`;
    setDefaultPostingTeamIdentifier(teamId);
    setDefaultPostingTeam(teamId);
    
    // Show feedback
    if (window.Android && window.Android.showToast) {
      window.Android.showToast(`"${teamName}" set as default posting team`);
    } else {
      // You could add a toast notification here if you have one
      console.log(`Set ${teamName} as default posting team`);
    }
  };

  const handleClearDefaultTeam = () => {
    setDefaultPostingTeamIdentifier(null);
    setDefaultPostingTeam(null);
    
    if (window.Android && window.Android.showToast) {
      window.Android.showToast('Default posting team cleared');
    }
  };

  const isUserMemberOfTeam = (team) => {
    if (!publicKey || !userTeams.length) return false;
    return userTeams.some(userTeam => 
      userTeam.pubkey === team.captainPubkey && 
      userTeam.tags.find(tag => tag[0] === 'd')?.[1] === team.teamUUID
    );
  };

  const isDefaultTeam = (captainPubkey, teamUUID) => {
    return defaultPostingTeam === `${captainPubkey}:${teamUUID}`;
  };

  const renderTeamCard = (team) => {
    const isMember = isUserMemberOfTeam(team);
    const isDefault = isDefaultTeam(team.captainPubkey, team.teamUUID);

    return (
      <div key={team.id} className="bg-bg-secondary p-4 sm:p-6 rounded-lg border border-border-secondary hover:border-primary transition-colors">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-primary mb-2 break-words">
              {team.name}
            </h3>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-3 break-words">
              {team.description}
            </p>
            <div className="text-xs sm:text-sm text-text-muted">
              <p>Captain: {team.captainPubkey.slice(0, 8)}...</p>
              <p>Members: {team.memberCount || 'Unknown'}</p>
              <p className={team.isPublic ? "text-primary" : "text-error"}>
                {team.isPublic ? 'Public' : 'Private'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 sm:min-w-[140px]">
            <button
              onClick={() => navigate(`/teams/${team.captainPubkey}/${team.teamUUID}`, { 
                state: { teamEvent: team.originalEvent } 
              })}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors text-sm border border-border-secondary"
            >
              View Team
            </button>
            
            {/* Default posting team controls - only show for members */}
            {isMember && (
              <div className="flex flex-col gap-1">
                {isDefault ? (
                  <div className="flex flex-col gap-1">
                    <div className="px-3 py-2 bg-success text-success-foreground rounded-lg text-sm font-medium text-center border border-success">
                      ✅ Default Team
                    </div>
                    <button
                      onClick={handleClearDefaultTeam}
                      className="px-3 py-1 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs rounded transition-colors border border-border-secondary"
                    >
                      Clear Default
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSetDefaultTeam(team.captainPubkey, team.teamUUID, team.name)}
                    className="px-3 py-2 bg-bg-tertiary hover:bg-primary hover:text-white text-text-primary text-sm rounded-lg transition-colors border border-border-secondary"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 max-w-4xl mx-auto text-text-primary bg-bg-primary min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary">Teams</h1>
        <div className="text-center py-12">
          <p className="text-text-secondary">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto text-text-primary bg-bg-primary min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary">Teams</h1>
        <div className="text-center py-12">
          <p className="text-error mb-4">Error loading teams: {error}</p>
          <button 
            onClick={refresh}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto text-text-primary bg-bg-primary min-h-screen">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Teams</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Teams'}
          </button>
          
          <button
            onClick={() => navigate('/teams/create')}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors border border-border-secondary"
          >
            Create Team
          </button>
        </div>
      </div>

      {/* Default team info banner */}
      {defaultPostingTeam && (
        <div className="mb-6 p-4 bg-primary-light border border-primary rounded-lg">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-sm font-medium text-primary">Default Posting Team:</p>
              <p className="text-xs text-text-secondary">
                Your runs will be automatically tagged with this team
              </p>
            </div>
            <p className="text-sm text-text-primary font-mono">
              {defaultPostingTeam.split(':')[1].slice(0, 8)}...
            </p>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-12 bg-bg-secondary rounded-lg border border-border-secondary">
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Teams Found</h3>
          <p className="text-text-secondary mb-6">
            There are no public teams available yet. Be the first to create one!
          </p>
          <button
            onClick={() => navigate('/teams/create')}
            className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors border border-border-secondary"
          >
            Create First Team
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map(renderTeamCard)}
        </div>
      )}
    </div>
  );
} 