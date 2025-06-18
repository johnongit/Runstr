import { useStreakRewards as useLinearStreakRewards } from '../hooks/useStreakRewards';
import PropTypes from 'prop-types';
import { useNostr } from '../hooks/useNostr';
import { REWARDS } from '../config/rewardsConfig';
import NotificationModal from './NotificationModal';

/**
 * Card displaying user achievements and rewards
 * Shown on the dashboard below the run tracker
 */
const AchievementCard = () => {
  // Handle case where NostrContext might not be fully initialized yet
  const nostrContext = useNostr();
  const pubkey = nostrContext?.publicKey || null;
  
  // Get modalInfo and clearModal from the hook
  const { streakData, rewardState, modalInfo, clearModal } = useLinearStreakRewards(pubkey);
  
  // Compute next milestone details from reward config
  const { satsPerDay, capDays } = REWARDS.STREAK;
  const currentDays = streakData.currentStreakDays;
  
  // Calculate today's reward (if any was earned)
  const todaysReward = currentDays > streakData.lastRewardedDay ? 
    (currentDays - streakData.lastRewardedDay) * satsPerDay : 0;
  
  // Calculate tomorrow's reward
  const tomorrowDay = Math.min(currentDays + 1, capDays);
  const tomorrowReward = tomorrowDay > streakData.lastRewardedDay ? 
    (tomorrowDay * satsPerDay) : 0;
  
  // Check if we're at the cap
  const isAtCap = currentDays >= capDays && streakData.lastRewardedDay >= capDays;
  
  return (
    <>
      <div className="bg-bg-secondary rounded-xl overflow-hidden mb-4 shadow-lg border border-border-secondary">
        <div className="p-4 flex flex-col gap-3">
          {/* Current Streak Display */}
          <div className="bg-bg-primary/50 rounded-lg p-2.5 flex items-center border border-border-secondary">
            <div className="flex items-center justify-center mr-2.5 w-8 h-8 rounded-lg bg-warning/20">
              {/* Fire outline SVG icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">Current Streak</span>
              <span className="text-sm font-semibold text-text-primary">{currentDays} {currentDays === 1 ? 'day' : 'days'}</span>
            </div>
          </div>

          {/* Today's Reward (if earned) */}
          {todaysReward > 0 && (
            <div className="bg-bg-primary/50 rounded-lg p-2.5 flex items-center border border-border-secondary">
              <div className="flex items-center justify-center mr-2.5 w-8 h-8 rounded-lg bg-bitcoin/20">
                {/* Bitcoin/Lightning bolt icon instead of dollar sign */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-bitcoin">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-text-muted">Today's Reward (Day {currentDays})</span>
                <span className="text-sm font-semibold text-bitcoin">{todaysReward} sats</span>
              </div>
            </div>
          )}

          {/* Next Reward Information */}
          <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border-secondary">
            <div className="flex flex-col gap-2">
              {!isAtCap ? (
                <div className="text-center">
                  <span className="text-sm text-text-primary">
                    Run tomorrow (Day {tomorrowDay}) to earn <span className="font-semibold text-bitcoin">{tomorrowReward} sats</span>
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-sm text-primary font-medium">
                    Maximum {capDays}-day reward reached! Keep the streak alive!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Render the NotificationModal */}
      {modalInfo && modalInfo.isVisible && (
        <NotificationModal
          title={modalInfo.title}
          message={modalInfo.message}
          isVisible={modalInfo.isVisible}
          onClose={clearModal} 
        />
      )}
    </>
  );
};

AchievementCard.propTypes = {};

export default AchievementCard; 