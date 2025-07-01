import React, { useState } from 'react';
import { useBadges } from '../hooks/useBadges';
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
    } finally {
      setIsClaimingAll(false);
    }
  };

  const handleClaimIndividual = async (badge) => {
    setIsClaimingIndividual(prev => ({ ...prev, [badge.id]: true }));
    try {
      await onClaim([badge]);
    } catch (error) {
      console.error('Error claiming badge:', error);
    } finally {
      setIsClaimingIndividual(prev => ({ ...prev, [badge.id]: false }));
    }
  };

  return (
    <div className="badge-claim-modal-overlay">
      <div className="badge-claim-modal">
        <div className="modal-header">
          <div className="celebration-stars">✨ 🎉 ✨</div>
          <h2 className="modal-title">New Badges Earned!</h2>
          <p className="modal-subtitle">
            You have {allUnclaimedBadges.length} new badge{allUnclaimedBadges.length !== 1 ? 's' : ''} to claim
          </p>
        </div>

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

        <div className="modal-info">
          <p>Claiming badges adds them to your profile and makes them visible to others on Nostr.</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Individual badge slot component
 */
const BadgeSlot = ({ badge, levelNumber, isEmpty = false }) => {
  if (isEmpty) {
    return (
      <div className="badge-slot empty" title={`Level ${levelNumber} badge`}>
        <div className="badge-placeholder">
          {levelNumber}
        </div>
      </div>
    );
  }

  return (
    <div className="badge-slot filled" title={badge?.name || `Level ${levelNumber}`}>
      <div className="badge-content">
        {levelNumber}
      </div>
    </div>
  );
};

/**
 * Award badge component (for special achievements)
 */
const AwardBadge = ({ award }) => {
  return (
    <div className="award-badge" title={award.name}>
      <div className="award-content">
        🏆
      </div>
    </div>
  );
};

/**
 * Main BadgeDisplay component
 * Shows level badges (1-21 in 3 rows of 7) and awards section
 * Includes notification system for unclaimed badges
 */
const BadgeDisplay = () => {
  const { badges, unclaimedBadges, isLoading, error, claimBadges, hasUnclaimedBadges } = useBadges();
  const [showClaimModal, setShowClaimModal] = useState(false);

  if (isLoading) {
    return (
      <div className="badge-display loading">
        <div className="badge-loading">Loading badges...</div>
      </div>
    );
  }

  if (error) {
    console.warn('BadgeDisplay error:', error);
    // Fail silently to not disrupt the UI
    return null;
  }

  const { levelBadges, awards } = badges;

  // Create array of 21 level slots
  const levelSlots = [];
  for (let i = 1; i <= 21; i++) {
    const badge = levelBadges[i];
    levelSlots.push(
      <BadgeSlot 
        key={i} 
        badge={badge} 
        levelNumber={i} 
        isEmpty={!badge} 
      />
    );
  }

  const handleClaimBadges = async (badgesToClaim) => {
    try {
      await claimBadges(badgesToClaim);
      // Modal will close automatically on success
    } catch (error) {
      console.error('Failed to claim badges:', error);
      // Could show toast notification here
    }
  };

  return (
    <div className="badge-display">
      {/* Notification Banner for Unclaimed Badges */}
      {hasUnclaimedBadges && (
        <div 
          className="badge-notification-banner"
          onClick={() => setShowClaimModal(true)}
        >
          🎉 You have new badges to claim! Click here to view them.
        </div>
      )}

      {/* Level Badges Section - 3 rows of 7 badges each */}
      <div className="level-badges">
        <div className="badge-grid">
          {levelSlots}
        </div>
      </div>

      {/* Awards Section - Only show if user has awards */}
      {awards && awards.length > 0 && (
        <div className="awards-section">
          <div className="awards-header">
            <span className="awards-title">🏆 AWARDS</span>
          </div>
          <div className="awards-grid">
            {awards.map((award, index) => (
              <AwardBadge key={award.id || index} award={award} />
            ))}
          </div>
        </div>
      )}

      {/* Badge Claim Modal */}
      <BadgeClaimModal
        unclaimedBadges={unclaimedBadges}
        onClaim={handleClaimBadges}
        onClose={() => setShowClaimModal(false)}
        isOpen={showClaimModal}
      />
    </div>
  );
};

export default BadgeDisplay; 