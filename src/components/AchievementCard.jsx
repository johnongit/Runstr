import { useState } from 'react';
import PropTypes from 'prop-types';
import { useStreakRewards } from '../hooks/useStreakRewards';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNostr } from '../hooks/useNostr';
import AchievementModal from './AchievementModal';
import '../assets/styles/achievements.css';

/**
 * Card displaying user achievements and rewards
 * Shown on the dashboard below the run tracker
 */
const AchievementCard = ({ currentStreak, runHistory, stats }) => {
  const { publicKey } = useNostr();
  const { nextMilestone } = useStreakRewards(currentStreak, publicKey);
  const { distanceLeaderboard } = useLeaderboard(publicKey, null, runHistory, stats);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Find user position in leaderboard
  const userPosition = distanceLeaderboard.findIndex(entry => entry.isCurrentUser) + 1;
  const progressPercentage = nextMilestone ? Math.min(100, (currentStreak / nextMilestone.days) * 100) : 0;
  
  return (
    <div className="achievement-card modern">
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
      
      <div className="achievement-content">
        <div className="achievement-grid">
          {/* Streak Card */}
          <div className="achievement-item">
            <div className="icon-container">
              <span className="icon">🔥</span>
            </div>
            <div className="item-details">
              <span className="item-label">Current Streak</span>
              <span className="item-value">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
          
          {/* Leaderboard Position */}
          <div className="achievement-item">
            <div className="icon-container">
              <span className="icon">⭐</span>
            </div>
            <div className="item-details">
              <span className="item-label">Leaderboard</span>
              <span className="item-value">
                #{userPosition > 0 ? userPosition : '--'}
              </span>
            </div>
          </div>
          
          {/* Next Reward */}
          {nextMilestone && (
            <div className="achievement-item full-width">
              <div className="reward-header">
                <span className="item-label">Next Reward</span>
                <span className="reward-progress">
                  {currentStreak}/{nextMilestone.days} days
                </span>
              </div>
              <div className="reward-progress-bar">
                <div 
                  className="progress" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <span className="reward-text">
                {nextMilestone.sats} SATS in {nextMilestone.days - currentStreak} days
              </span>
            </div>
          )}
        </div>
      </div>
      
      {modalOpen && (
        <AchievementModal 
          onClose={() => setModalOpen(false)}
          currentStreak={currentStreak}
          runHistory={runHistory}
          stats={stats}
        />
      )}
    </div>
  );
};

AchievementCard.propTypes = {
  currentStreak: PropTypes.number.isRequired,
  runHistory: PropTypes.array.isRequired,
  stats: PropTypes.object.isRequired
};

export default AchievementCard; 