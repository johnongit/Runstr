import { useStreakRewards as useLinearStreakRewards } from '../hooks/useStreakRewards';
import PropTypes from 'prop-types';
import { useNostr } from '../hooks/useNostr';
import { REWARDS } from '../config/rewardsConfig';
// import AchievementModal from './AchievementModal';
import '../assets/styles/achievements.css';

/**
 * Card displaying user achievements and rewards
 * Shown on the dashboard below the run tracker
 */
const AchievementCard = () => {
  // Handle case where NostrContext might not be fully initialized yet
  const nostrContext = useNostr();
  const pubkey = nostrContext?.publicKey || null;
  
  const { streakData, rewardState } = useLinearStreakRewards(pubkey);
  
  // Compute next milestone details from reward config
  const { satsPerDay, capDays } = REWARDS.STREAK;
  const currentDays = streakData.currentStreakDays;
  
  // Calculate today's reward (if any was earned)
  const todaysReward = currentDays > streakData.lastRewardedDay ? 
    (currentDays - streakData.lastRewardedDay) * satsPerDay : 0;
  
  // Calculate tomorrow's reward
  const tomorrowDay = Math.min(currentDays + 1, capDays);
  const tomorrowReward = tomorrowDay > streakData.lastRewardedDay ? 
    satsPerDay : 0;
  
  // Check if we're at the cap
  const isAtCap = currentDays >= capDays && streakData.lastRewardedDay >= capDays;
  
  return (
    <div className="achievement-card modern">
      {/*
      <div className="achievement-header">
        <h3>Achievements & Rewards</h3>
        <button 
          className="view-details-button"
          onClick={() => setModalOpen(true)}
        >
          View Details
          <span className="chevron-right">→</span>
        </button>
      </div>
      */}
      
      <div className="achievement-content">
        <div className="achievement-grid">
          {/* Streak Card */}
          <div className="achievement-item">
            <div className="icon-container">
              <span className="icon">🔥</span>
            </div>
            <div className="item-details">
              <span className="item-label">Current Streak</span>
              <span className="item-value">{currentDays} {currentDays === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
          
          {/* Reward Information */}
          <div className="achievement-item full-width">
            <div className="reward-info-container">
              {todaysReward > 0 && (
                <div className="today-reward">
                  <span className="reward-label">Today's Reward (Day {currentDays})</span>
                  <span className="reward-amount">{todaysReward} sats</span>
                </div>
              )}
              
              {!isAtCap ? (
                <div className="tomorrow-reward">
                  <span className="reward-text">
                    Run (Day {tomorrowDay}) to earn {tomorrowReward} sats
                  </span>
                </div>
              ) : (
                <div className="reward-capped">
                  <span className="reward-text">
                    Maximum {capDays}-day reward reached! Keep the streak alive! 🔥
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/*
      {modalOpen && (
        <AchievementModal 
          onClose={() => setModalOpen(false)}
          currentStreak={currentStreak}
        />
      )}
      */}
    </div>
  );
};

AchievementCard.propTypes = {};

export default AchievementCard; 