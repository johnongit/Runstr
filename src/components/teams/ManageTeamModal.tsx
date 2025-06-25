import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr';
import {
  NostrTeamEvent,
  getTeamName,
  getTeamDescription,
  isTeamPublic,
  prepareNip101eTeamEventTemplate,
  TeamData,
} from '../../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../../utils/nostr';

interface ManageTeamModalProps {
  team: NostrTeamEvent;
  onClose: () => void;
  onTeamUpdated?: () => void;
}

// Helper function to get team image from tags
const getTeamImage = (team: NostrTeamEvent): string => {
  const imageTag = team.tags?.find(tag => tag[0] === 'image');
  return imageTag ? imageTag[1] : '';
};

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({ team, onClose, onTeamUpdated }) => {
  const { publicKey, ndkReady, connectSigner } = useNostr() as any;
  
  // Initialize form state with current team data
  const [teamName, setTeamName] = useState(getTeamName(team) || '');
  const [teamDescription, setTeamDescription] = useState(getTeamDescription(team) || '');
  const [teamImage, setTeamImage] = useState(getTeamImage(team) || '');
  const [isPublic, setIsPublic] = useState(isTeamPublic(team));
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enhanced readiness check
  const isReady = ndkReady && publicKey;
  
  // Attempt to auto-connect signer if not ready (Amber prompt will open) on mount
  useEffect(() => {
    if (!publicKey) {
      (async () => {
        try {
          await connectSigner();
        } catch (err) {
          console.warn('ManageTeamModal: Auto connectSigner failed:', err);
        }
      })();
    }
  }, [publicKey, connectSigner]);
  
  const handleUpdateTeam = async () => {
    if (!isReady) {
      setError('Nostr connection or authentication not ready. Please wait a moment and try again.');
      return;
    }

    if (!teamName.trim()) {
      setError('Team name is required.');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const teamData: TeamData = {
        name: teamName.trim(),
        description: teamDescription.trim(),
        isPublic,
        image: teamImage.trim() || undefined,
      };

      const updatedTeamTemplate = prepareNip101eTeamEventTemplate(teamData, publicKey);

      if (!updatedTeamTemplate) {
        setError('Failed to prepare team update.');
        setIsUpdating(false);
        return;
      }

      // Copy the original team's tags that we want to preserve (like members)
      const originalTags = team.tags || [];
      const memberTags = originalTags.filter(tag => tag[0] === 'p' && tag[3] === 'member');
      
      // Merge preserved tags with new template tags
      updatedTeamTemplate.tags = [
        ...updatedTeamTemplate.tags,
        ...memberTags
      ];

      const result: any = await createAndPublishEvent(updatedTeamTemplate, publicKey);

      if (result && result.success) {
        console.log('Team updated successfully:', result);
        onTeamUpdated?.();
        onClose();
      } else {
        setError(result?.error || 'Failed to update team. Please try again.');
      }
    } catch (err: any) {
      console.error('Error updating team:', err);
      setError(err.message || 'An error occurred while updating the team.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-bg-secondary p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-lg text-text-primary transform transition-all max-h-[90vh] overflow-y-auto border border-border-secondary">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-primary">Manage Team</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="teamNameManage" className="block text-sm font-medium text-text-primary mb-1">
              Team Name
            </label>
            <input
              type="text"
              id="teamNameManage"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full p-2 border border-border-secondary rounded-md bg-bg-tertiary text-text-primary focus:ring-primary focus:border-primary transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="teamDescriptionManage" className="block text-sm font-medium text-text-primary mb-1">
              Team Description
            </label>
            <textarea
              id="teamDescriptionManage"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              rows={3}
              className="w-full p-2 border border-border-secondary rounded-md bg-bg-tertiary text-text-primary focus:ring-primary focus:border-primary transition-colors"
              placeholder="Describe your team..."
            />
          </div>

          <div>
            <label htmlFor="teamImageManage" className="block text-sm font-medium text-text-primary mb-1">
              Team Image URL (Optional)
            </label>
            <input
              type="url"
              id="teamImageManage"
              value={teamImage}
              onChange={(e) => setTeamImage(e.target.value)}
              className="w-full p-2 border border-border-secondary rounded-md bg-bg-tertiary text-text-primary focus:ring-primary focus:border-primary transition-colors"
              placeholder="https://example.com/image.png"
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-primary border-border-secondary rounded bg-bg-tertiary focus:ring-primary"
              />
              <span className="ml-2 text-sm text-text-secondary">Publicly visible team</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error-light border border-error rounded-md">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {!isReady && (
          <div className="mt-4 p-3 bg-warning-light text-warning border border-warning rounded-md text-sm space-y-2">
            <p><strong>Signer Required</strong> – connect Amber to edit team.</p>
            <button
              onClick={connectSigner}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors border border-border-secondary"
            >
              Connect Signer
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 border border-border-secondary rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdateTeam}
            disabled={!isReady || isUpdating}
            className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto border border-border-secondary"
          >
            {isUpdating ? 'Updating...' : 'Update Team'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageTeamModal; 