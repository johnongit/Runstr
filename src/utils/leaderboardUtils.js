/**
 * Leaderboard Utilities
 * Functions for managing leaderboard data, calculations, and user preferences.
 */

/**
 * Get leaderboard participation preference
 * @returns {boolean} Whether user has opted into leaderboards
 */
export const getLeaderboardParticipation = () => {
  try {
    const participation = localStorage.getItem('leaderboardParticipation');
    if (participation !== null) {
      return JSON.parse(participation);
    }
  } catch (err) {
    console.error('Error loading leaderboard participation:', err);
  }
  return true; // Default to opt-in
};

/**
 * Save leaderboard participation preference
 * @param {boolean} participate - Whether user wants to participate
 * @returns {boolean} Success status
 */
export const saveLeaderboardParticipation = (participate) => {
  try {
    localStorage.setItem('leaderboardParticipation', JSON.stringify(participate));
    return true;
  } catch (err) {
    console.error('Error saving leaderboard participation:', err);
    return false;
  }
};

/**
 * Calculate improvement rate between two periods
 * @param {number} currentDistance - Current period distance 
 * @param {number} previousDistance - Previous period distance
 * @returns {number} Improvement percentage
 */
export const calculateImprovementRate = (currentDistance, previousDistance) => {
  if (!previousDistance || previousDistance === 0) {
    return currentDistance > 0 ? 100 : 0;
  }
  
  return ((currentDistance - previousDistance) / previousDistance) * 100;
};

/**
 * Calculate distance for a specific time period
 * @param {Array} runHistory - Array of runs
 * @param {string} period - Time period ('week', 'month', 'all-time')
 * @returns {number} Total distance for the period
 */
export const getDistanceForPeriod = (runHistory, period = 'week') => {
  if (!runHistory || runHistory.length === 0) return 0;
  
  const now = new Date();
  let periodStart;
  
  switch (period) {
    case 'week':
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      periodStart.setHours(0, 0, 0, 0);
      break;
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    case 'all-time':
      return runHistory.reduce((sum, run) => sum + (run.distance || 0), 0);
    default:
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
  }
  
  return runHistory
    .filter(run => {
      const runDate = new Date(run.date);
      return !isNaN(runDate.getTime()) && runDate >= periodStart;
    })
    .reduce((sum, run) => sum + (run.distance || 0), 0);
};

/**
 * Create a leaderboard entry in standard format
 * @param {Object} user - User object with pubkey, name, etc.
 * @param {number|string} metric - Value for leaderboard (distance, streak, etc)
 * @param {string} type - Type of metric ('distance', 'streak', 'improvement')
 * @returns {Object} Formatted leaderboard entry
 */
export const formatLeaderboardEntry = (user, metric, type) => {
  return {
    pubkey: user.pubkey,
    name: user.name || 'Anonymous Runner',
    picture: user.picture || '',
    isCurrentUser: user.isCurrentUser || false,
    [type]: metric,
    timestamp: Math.floor(Date.now() / 1000)
  };
};

/**
 * Get previous week's start and end dates
 * @returns {Object} Object with start and end dates
 */
export const getPreviousWeekDates = () => {
  const now = new Date();
  
  // Start of current week
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  
  // End of previous week (1 millisecond before start of this week)
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setMilliseconds(-1);
  
  // Start of previous week
  const startOfLastWeek = new Date(endOfLastWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 6);
  startOfLastWeek.setHours(0, 0, 0, 0);
  
  return {
    start: startOfLastWeek,
    end: endOfLastWeek
  };
};

/**
 * Create a distance leaderboard
 * @param {Array} users - Array of user objects with run history
 * @param {string} period - Time period (week, month, all-time)
 * @returns {Array} Sorted leaderboard entries
 */
export const createDistanceLeaderboard = (users, period = 'week') => {
  if (!users || !users.length) return [];
  
  // Map users to leaderboard entries with calculated distances
  const entries = users.map(user => {
    const distance = getDistanceForPeriod(user.runHistory || [], period);
    return formatLeaderboardEntry(user, distance, 'distance');
  });
  
  // Sort by distance (descending)
  return entries
    .sort((a, b) => b.distance - a.distance)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
};

/**
 * Create a streak leaderboard
 * @param {Array} users - Array of user objects with streak information
 * @returns {Array} Sorted leaderboard entries
 */
export const createStreakLeaderboard = (users) => {
  if (!users || !users.length) return [];
  
  // Map users to leaderboard entries
  const entries = users.map(user => {
    return formatLeaderboardEntry(user, user.streak || 0, 'streak');
  });
  
  // Sort by streak length (descending)
  return entries
    .sort((a, b) => b.streak - a.streak)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
};

/**
 * Create an improvement rate leaderboard
 * @param {Array} users - Array of user objects with run history
 * @returns {Array} Sorted leaderboard entries
 */
export const createImprovementLeaderboard = (users) => {
  if (!users || !users.length) return [];
  
  // Calculate improvement rates
  const entries = users.map(user => {
    let improvementRate = 0;
    
    if (user.stats) {
      // Use precalculated stats if available
      improvementRate = user.stats.weeklyImprovementRate || 0;
    } else if (user.runHistory) {
      // Calculate manually if needed
      const thisWeekDistance = getDistanceForPeriod(user.runHistory, 'week');
      const prevWeekDates = getPreviousWeekDates();
      
      const prevWeekDistance = user.runHistory
        .filter(run => {
          const runDate = new Date(run.date);
          return !isNaN(runDate.getTime()) && 
                 runDate >= prevWeekDates.start && 
                 runDate <= prevWeekDates.end;
        })
        .reduce((sum, run) => sum + (run.distance || 0), 0);
      
      improvementRate = calculateImprovementRate(thisWeekDistance, prevWeekDistance);
    }
    
    return formatLeaderboardEntry(user, improvementRate, 'improvementRate');
  });
  
  // Sort by improvement rate (descending)
  return entries
    .sort((a, b) => b.improvementRate - a.improvementRate)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}; 