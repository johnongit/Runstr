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
  
  const currentDays = streakData.currentStreakDays;
  
  // Calculate current week's workout count
  const getWeeklyWorkoutCount = () => {
    const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start of week
    startOfWeek.setHours(0, 0, 0, 0);
    
    const workoutsThisWeek = runHistory.filter(run => {
      const runDate = new Date(run.date);
      return runDate >= startOfWeek && runDate <= now;
    });
    
    return workoutsThisWeek.length;
  };
  
  // Calculate days until next payout (Friday nights)
  const getDaysUntilPayout = () => {
    const now = new Date();
    const nextFriday = new Date(now);
    const daysUntilFriday = (5 - now.getDay() + 7) % 7; // Friday is day 5
    
    if (daysUntilFriday === 0) {
      // Today is Friday, get next Friday
      nextFriday.setDate(now.getDate() + 7);
    } else {
      nextFriday.setDate(now.getDate() + daysUntilFriday);
    }
    
    const timeDiff = nextFriday.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
  };
  
  const weeklyWorkouts = getWeeklyWorkoutCount();
  const maxWeeklyWorkouts = 7;
  const baseReward = weeklyWorkouts * 50; // 50 sats per workout
  const streakBonus = currentDays * 50; // 50 sats per streak day
  const weeklyTotal = baseReward + streakBonus;
  const daysUntilPayout = getDaysUntilPayout();
  const weekProgress = (weeklyWorkouts / maxWeeklyWorkouts) * 100;

  return (
    <div className="bg-bg-secondary rounded-xl shadow-lg p-4 border border-border-secondary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="streak-flames">🔥</div>
          <div>
            <div className="streak-days text-xl font-bold text-text-primary">
              {currentDays}
            </div>
            <div className="streak-label text-sm text-text-secondary">
              day streak
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-secondary">Next payout in</div>
          <div className="text-lg font-semibold text-text-primary">{daysUntilPayout} days</div>
        </div>
      </div>
      
      {/* Weekly Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-text-secondary">This Week's Progress</span>
          <span className="text-sm font-bold text-text-primary">{weeklyWorkouts}/{maxWeeklyWorkouts} workouts</span>
        </div>
        <div className="w-full bg-bg-tertiary rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
            style={{ width: `${weekProgress}%` }}
          ></div>
        </div>
      </div>
      
      {/* Weekly Earnings Breakdown */}
      <div className="bg-bg-tertiary rounded-lg p-3 mb-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Weekly Earnings</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Base reward ({weeklyWorkouts} workouts)</span>
            <span className="text-sm font-semibold" style={{ color: '#f7931a' }}>{baseReward} sats</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Streak bonus ({currentDays} days)</span>
            <span className="text-sm font-semibold" style={{ color: '#f7931a' }}>+{streakBonus} sats</span>
          </div>
          <div className="border-t border-border-secondary pt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">Weekly Total</span>
              <span className="text-lg font-bold" style={{ color: '#f7931a' }}>{weeklyTotal} sats</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Motivational Message */}
      <div className="text-center">
        {weeklyWorkouts < maxWeeklyWorkouts ? (
          <div className="tomorrow-reward">
            <div className="reward-text">
              Run tomorrow (Day {currentDays + 1}) to earn <span style={{ color: '#f7931a', fontWeight: '600' }}>100 sats</span>
            </div>
          </div>
        ) : (
          <div className="reward-capped">
            <div className="reward-text">
              🎉 Week complete! Great job maintaining your streak!
            </div>
          </div>
        )}
      </div>
      
      {/* Notification Modal */}
      {modalInfo && (
        <NotificationModal
          isOpen={modalInfo.isVisible}
          onClose={clearModal}
          title={modalInfo.title}
          message={modalInfo.message}
        />
      )}
    </div>
  );
};

AchievementCard.propTypes = {};

export default AchievementCard; 