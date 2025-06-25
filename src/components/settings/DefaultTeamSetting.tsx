import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr'; // Adjust path if this component is deeper
import {
  fetchUserMemberTeams,
  NostrTeamEvent,
  getTeamName,
  getTeamCaptain,
  getTeamUUID,
} from '../../services/nostr/NostrTeamsService'; // Adjust path

const DEFAULT_POSTING_TEAM_STORAGE_KEY = 'runstr:defaultPostingTeamIdentifier';

const DefaultTeamSetting: React.FC = () => {
  const { ndk, publicKey, ndkReady } = useNostr();
  const [userTeams, setUserTeams] = useState<NostrTeamEvent[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState<boolean>(false);
  const [selectedTeamIdentifier, setSelectedTeamIdentifier] = useState<string>(
    localStorage.getItem(DEFAULT_POSTING_TEAM_STORAGE_KEY) || ''
  );
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ndkReady && ndk && publicKey) {
      setIsLoadingTeams(true);
      fetchUserMemberTeams(ndk, publicKey)
        .then(teams => {
          setUserTeams(teams);
          // Ensure current selection is valid if teams load
          const currentSelection = localStorage.getItem(DEFAULT_POSTING_TEAM_STORAGE_KEY) || '';
          if (currentSelection && !teams.some(t => `${getTeamCaptain(t)}:${getTeamUUID(t)}` === currentSelection)) {
             // If previously selected team is no longer a member of, reset to 'No Team'
             // setSelectedTeamIdentifier('');
             // localStorage.setItem(DEFAULT_POSTING_TEAM_STORAGE_KEY, '');
             // console.log("Previously selected default team not found in user's current teams. Resetting.");
          } else {
            setSelectedTeamIdentifier(currentSelection);
          }
        })
        .catch(err => {
          console.error("Error fetching user's teams for settings:", err);
          setFeedbackMessage("Could not load your teams.");
        })
        .finally(() => setIsLoadingTeams(false));
    }
  }, [ndk, ndkReady, publicKey]);

  const handleSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIdentifier = event.target.value;
    setSelectedTeamIdentifier(newIdentifier);
    localStorage.setItem(DEFAULT_POSTING_TEAM_STORAGE_KEY, newIdentifier);
    setFeedbackMessage(newIdentifier ? "Default posting team saved!" : "Default posting team cleared.");
    setTimeout(() => setFeedbackMessage(null), 3000); // Clear feedback after 3s
  };

  if (!ndkReady) {
    return <p className="text-sm text-yellow-400">Nostr connection not ready. Please connect to select a default team.</p>;
  }

  return (
    <div className="my-6 p-4 bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-100 mb-2">Default Posting Team</h3>
      <p className="text-sm text-gray-400 mb-3">
        Select a team to automatically associate your new workout records with. 
        This can be overridden if/when specific sharing options are presented.
      </p>
      {isLoadingTeams ? (
        <p className="text-sm text-gray-400">Loading your teams...</p>
      ) : (
        <select
          value={selectedTeamIdentifier}
          onChange={handleSelectionChange}
          className="w-full p-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 appearance-none transition-colors"
          disabled={!publicKey} // Disable if not logged in
        >
          <option value="">-- No Default Team --</option>
          {userTeams.map(team => {
            const teamNameStr = getTeamName(team);
            const captain = getTeamCaptain(team);
            const uuid = getTeamUUID(team);
            if (!uuid || !captain) return null;
            const identifier = `${captain}:${uuid}`;
            return (
              <option key={identifier} value={identifier}>
                {teamNameStr}
              </option>
            );
          })}
        </select>
      )}
      {!publicKey && <p className="text-xs text-yellow-500 mt-1">Please log in to select a default team.</p>}
      {feedbackMessage && <p className="text-xs text-green-400 mt-2">{feedbackMessage}</p>}
      {userTeams.length === 0 && !isLoadingTeams && publicKey && (
        <p className="text-sm text-gray-400 mt-2">You are not a member of any teams yet. Join or create a team to select it as default.</p>
      )}
    </div>
  );
};

export default DefaultTeamSetting; 