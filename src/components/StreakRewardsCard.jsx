import { useState, useEffect, useRef } from 'react';
import { useStreakRewards } from '../hooks/useStreakRewards';
import { useNostr } from '../hooks/useNostr';
import PropTypes from 'prop-types';

/**
 * Component for displaying streak rewards and claiming Bitcoin rewards
 */
const StreakRewardsCard = ({ currentStreak, showTitle = true }) => {
  const nostrContext = useNostr();
  const lightningAddress = nostrContext?.lightningAddress || null;
  
  const { 
    rewards, 
    eligibleRewards, 
    nextMilestone, 
    claimStatus,
    claimReward 
  } = useStreakRewards(currentStreak, lightningAddress);
  
  const [showSuccess, setShowSuccess] = useState(false);
  const prevEligibleRewardsRef = useRef([]);

  useEffect(() => {
    // Check for newly eligible rewards
    if (eligibleRewards.length > prevEligibleRewardsRef.current.length) {
      const newlyEligible = eligibleRewards.filter(
        currentReward => !prevEligibleRewardsRef.current.some(prevReward => prevReward.days === currentReward.days)
      );

      if (newlyEligible.length > 0) {
        newlyEligible.forEach(reward => {
          // You can replace this with a more sophisticated toast notification
          alert(`🎉 You've unlocked a new reward: ${reward.days}-Day Streak for ${reward.sats} sats! Claim it now!`);
        });
      }
    }
    prevEligibleRewardsRef.current = eligibleRewards;
  }, [eligibleRewards]);
  
  // No manual claim; handleClaim retained only for legacy but not used
  const handleClaim = () => {};
  
  // Generate streak flame icons based on current streak length
  const renderStreakFlames = () => {
    if (currentStreak < 3) return '🔥';
    if (currentStreak < 7) return '🔥🔥';
    return '🔥🔥🔥';
  };
  
  return (
    <div className="streak-rewards-card">
      {showTitle && (
        <div className="streak-rewards-header">
          <h3>Streak Rewards</h3>
        </div>
      )}
      
      <div className="streak-status">
        <div className="current-streak">
          <span className="streak-flames">{renderStreakFlames()}</span>
          <span className="streak-days">{currentStreak || 0}</span>
          <span className="streak-label">day{currentStreak !== 1 ? 's' : ''}</span>
        </div>
      </div>
      
      {/* Success message */}
      {showSuccess && (
        <div className="claim-success">
          <p>🎉 Reward claimed successfully! Your sats are on the way!</p>
        </div>
      )}
      
      {/* Reward claiming section */}
      {eligibleRewards.length > 0 ? (
        <div className="eligible-rewards">
          <h4>Eligible Rewards</h4>
          {eligibleRewards.map(reward => (
            <div key={reward.days} className="reward-item auto">
              <div className="reward-info">
                <span className="days-milestone">{reward.days} Day Streak</span>
                <span className="sats-amount">{reward.sats} sats</span>
                <span className="auto-sent-label">💸 Auto-sent</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-eligible-rewards">
          {currentStreak > 0 && nextMilestone ? (
            <div className="next-milestone">
              <h4>Next Reward</h4>
              <div className="milestone-info">
                <div className="milestone-progress">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${Math.min(100, (currentStreak / nextMilestone.days) * 100)}%` }}
                  ></div>
                </div>
                <p>
                  <strong>{currentStreak}</strong> / {nextMilestone.days} days to 
                  <span className="sats-highlight"> {nextMilestone.sats} sats</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="streak-message">
              {currentStreak === 0 
                ? "Start running to build your streak and earn Bitcoin rewards!" 
                : "Keep running to earn your streak rewards!"}
            </p>
          )}
        </div>
      )}
      
      {/* All milestones section */}
      <div className="all-milestones">
        <h4>Streak Milestones</h4>
        <div className="milestones-grid">
          {rewards.map(reward => (
            <div 
              key={reward.days} 
              className={`milestone-item ${reward.claimed ? 'claimed' : ''} ${
                currentStreak >= reward.days && !reward.claimed ? 'eligible' : ''
              }`}
            >
              <div className="milestone-day">{reward.days} Days</div>
              <div className="milestone-reward">{reward.sats} sats</div>
              <div className="milestone-status">
                {reward.claimed 
                  ? '✅ Claimed' 
                  : currentStreak >= reward.days 
                    ? '⭐ Ready!' 
                    : '⏳'}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Error message */}
      {claimStatus.error && (
        <div className="claim-error">
          <p>Error: {claimStatus.error}</p>
        </div>
      )}
    </div>
  );
};

StreakRewardsCard.propTypes = {
  currentStreak: PropTypes.number.isRequired,
  showTitle: PropTypes.bool,
};

export default StreakRewardsCard; 