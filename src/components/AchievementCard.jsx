import { useState } from 'react';
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
  
  return (
    <div className="achievement-card">
      <div className="achievement-header">
        <h3>ACHIEVEMENTS & REWARDS</h3>
      </div>
      
      <div className="achievement-content">
        <div className="streak-summary">
          {/* Streak flames and count */}
          <span className="streak-flames">
            {currentStreak < 3 ? '🔥' : currentStreak < 7 ? '🔥🔥' : '🔥🔥🔥'}
          </span>
          <span className="streak-count">Current Streak: {currentStreak} days</span>
        </div>
        
        <div className="leaderboard-summary">
          <span className="position-star">⭐</span>
          <span className="position">
            Leaderboard: #{userPosition > 0 ? userPosition : '--'} in Weekly Distance
          </span>
        </div>
        
        {nextMilestone && (
          <div className="next-reward">
            <div className="reward-progress-bar">
              <div 
                className="progress" 
                style={{ width: `${Math.min(100, (currentStreak / nextMilestone.days) * 100)}%` }}
              ></div>
            </div>
            <span className="reward-text">
              NEXT REWARD: {nextMilestone.sats} SATS IN {nextMilestone.days - currentStreak} DAYS
            </span>
          </div>
        )}
      </div>
      
      <button 
        className="view-rewards-button"
        onClick={() => setModalOpen(true)}
      >
        VIEW REWARDS & LEADERBOARDS
      </button>
      
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

export default AchievementCard; 