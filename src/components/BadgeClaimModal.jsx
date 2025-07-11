import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Individual unclaimed badge component for the modal
 */
const UnclaimedBadge = ({ badge }) => {
  return (
    <div className="unclaimed-badge-item">
      <div className="badge-icon">
        {badge.type === 'level' ? (
          <div className="level-badge-preview">
            {badge.levelNumber}
          </div>
        ) : (
          <div className="award-badge-preview">
            🏆
          </div>
        )}
      </div>
      <div className="badge-info">
        <h4 className="badge-name">{badge.name}</h4>
        <p className="badge-description">
          {badge.type === 'level' 
            ? `Level ${badge.levelNumber} Achievement` 
            : 'Special Award'
          }
        </p>
        <span className="badge-date">
          Awarded {new Date(badge.timestamp * 1000).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

/**
 * Badge Claim Modal Component
 * Shows unclaimed badges with celebration UI and claiming functionality
 */
const BadgeClaimModal = ({ unclaimedBadges, onClaim, onClose, isOpen = false }) => {
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [isClaimingIndividual, setIsClaimingIndividual] = useState({});

  if (!isOpen) return null;

  const allUnclaimedBadges = [
    ...Object.values(unclaimedBadges.levelBadges || {}),
    ...(unclaimedBadges.awards || [])
  ];

  if (allUnclaimedBadges.length === 0) {
    return null;
  }

  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      await onClaim(allUnclaimedBadges);
      onClose();
    } catch (error) {
      console.error('Error claiming all badges:', error);
      // Handle error - maybe show a toast
    } finally {
      setIsClaimingAll(false);
    }
  };

  const handleClaimIndividual = async (badge) => {
    setIsClaimingIndividual(prev => ({ ...prev, [badge.id]: true }));
    try {
      await onClaim([badge]);
      // Badge will be removed from unclaimed list automatically
    } catch (error) {
      console.error('Error claiming badge:', error);
      // Handle error - maybe show a toast
    } finally {
      setIsClaimingIndividual(prev => ({ ...prev, [badge.id]: false }));
    }
  };

  return (
    <div className="badge-claim-modal-overlay">
      <div className="badge-claim-modal">
        {/* Header with celebration */}
        <div className="modal-header">
          <div className="celebration-stars">✨ 🎉 ✨</div>
          <h2 className="modal-title">New Badges Earned!</h2>
          <p className="modal-subtitle">
            You have {allUnclaimedBadges.length} new badge{allUnclaimedBadges.length !== 1 ? 's' : ''} to claim
          </p>
        </div>

        {/* Badge List */}
        <div className="unclaimed-badges-list">
          {allUnclaimedBadges.map((badge) => (
            <div key={badge.id} className="unclaimed-badge-wrapper">
              <UnclaimedBadge badge={badge} />
              <Button
                onClick={() => handleClaimIndividual(badge)}
                disabled={isClaimingIndividual[badge.id] || isClaimingAll}
                variant="outline"
                size="sm"
                className="claim-individual-btn"
              >
                {isClaimingIndividual[badge.id] ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <Button
            onClick={handleClaimAll}
            disabled={isClaimingAll}
            variant="default"
            size="default"
            className="claim-all-btn"
          >
            {isClaimingAll ? 'Claiming All...' : `Claim All ${allUnclaimedBadges.length} Badges`}
          </Button>
          
          <Button
            onClick={onClose}
            disabled={isClaimingAll}
            variant="outline"
            size="default"
          >
            Later
          </Button>
        </div>

        {/* Info Text */}
        <div className="modal-info">
          <p>Claiming badges adds them to your profile and makes them visible to others on Nostr.</p>
        </div>
      </div>
    </div>
  );
};

export default BadgeClaimModal; 