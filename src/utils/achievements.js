// Experience points required for each level (increases by 1000 each level)
export const LEVEL_THRESHOLDS = Array.from(
  { length: 100 },
  (_, i) => (i + 1) * 1000
);

// Achievement definitions
export const ACHIEVEMENTS = {
  // Distance-based achievements
  FIRST_KM: {
    id: 'FIRST_KM',
    title: 'First Step',
    description: 'Complete your first kilometer',
    xp: 100,
    icon: '🎯',
    check: (stats) => stats.totalDistance >= 1
  },
  DISTANCE_5K: {
    id: 'DISTANCE_5K',
    title: '5K Runner',
    description: 'Complete a 5K run',
    xp: 250,
    icon: '🏃',
    check: (stats) => stats.longestRun >= 5
  },
  DISTANCE_10K: {
    id: 'DISTANCE_10K',
    title: '10K Warrior',
    description: 'Complete a 10K run',
    xp: 500,
    icon: '🏃‍♂️',
    check: (stats) => stats.longestRun >= 10
  },
  HALF_MARATHON: {
    id: 'HALF_MARATHON',
    title: 'Half Marathon Hero',
    description: 'Complete a half marathon (21.1K)',
    xp: 1000,
    icon: '🏆',
    check: (stats) => stats.longestRun >= 21.1
  },
  MARATHON: {
    id: 'MARATHON',
    title: 'Marathon Master',
    description: 'Complete a full marathon (42.2K)',
    xp: 2000,
    icon: '👑',
    check: (stats) => stats.longestRun >= 42.2
  },

  // Streak-based achievements
  STREAK_3: {
    id: 'STREAK_3',
    title: 'Habit Forming',
    description: 'Maintain a 3-day running streak',
    xp: 150,
    icon: '🔥',
    check: (stats) => stats.currentStreak >= 3
  },
  STREAK_7: {
    id: 'STREAK_7',
    title: 'Week Warrior',
    description: 'Maintain a 7-day running streak',
    xp: 350,
    icon: '🔥🔥',
    check: (stats) => stats.currentStreak >= 7
  },
  STREAK_30: {
    id: 'STREAK_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day running streak',
    xp: 1500,
    icon: '🔥🔥🔥',
    check: (stats) => stats.currentStreak >= 30
  },

  // Speed-based achievements
  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    title: 'Speed Demon',
    description: 'Achieve a pace under 5 min/km',
    xp: 500,
    icon: '⚡',
    check: (stats) => stats.fastestPace < 5 && stats.fastestPace > 0
  },
  LIGHTNING_FAST: {
    id: 'LIGHTNING_FAST',
    title: 'Lightning Fast',
    description: 'Achieve a pace under 4 min/km',
    xp: 1000,
    icon: '⚡⚡',
    check: (stats) => stats.fastestPace < 4 && stats.fastestPace > 0
  },

  // Distance milestones
  TOTAL_50K: {
    id: 'TOTAL_50K',
    title: '50K Club',
    description: 'Accumulate 50K in total distance',
    xp: 300,
    icon: '🌟',
    check: (stats) => stats.totalDistance >= 50
  },
  TOTAL_100K: {
    id: 'TOTAL_100K',
    title: '100K Club',
    description: 'Accumulate 100K in total distance',
    xp: 600,
    icon: '🌟🌟',
    check: (stats) => stats.totalDistance >= 100
  },
  TOTAL_500K: {
    id: 'TOTAL_500K',
    title: '500K Club',
    description: 'Accumulate 500K in total distance',
    xp: 1500,
    icon: '🌟🌟🌟',
    check: (stats) => stats.totalDistance >= 500
  },

  // Social achievements
  FIRST_SHARE: {
    id: 'FIRST_SHARE',
    title: 'Social Runner',
    description: 'Share your first run on Nostr',
    xp: 100,
    icon: '📢',
    check: (stats) => stats.sharedRuns > 0
  },
  SOCIAL_BUTTERFLY: {
    id: 'SOCIAL_BUTTERFLY',
    title: 'Social Butterfly',
    description: 'Share 10 runs on Nostr',
    xp: 300,
    icon: '🦋',
    check: (stats) => stats.sharedRuns >= 10
  }
};

// Calculate current level based on XP
export function calculateLevel(xp) {
  return LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold) + 1;
}

// Calculate XP needed for next level
export function xpForNextLevel(currentXp) {
  const currentLevel = calculateLevel(currentXp);
  return LEVEL_THRESHOLDS[currentLevel - 1] - currentXp;
}

// Check for newly unlocked achievements
export function checkAchievements(stats, unlockedAchievements) {
  const newAchievements = [];

  Object.values(ACHIEVEMENTS).forEach((achievement) => {
    if (
      !unlockedAchievements.includes(achievement.id) &&
      achievement.check(stats)
    ) {
      newAchievements.push(achievement);
    }
  });

  return newAchievements;
}

// Calculate total XP from achievements
export function calculateTotalXP(unlockedAchievements) {
  return unlockedAchievements.reduce((total, achievementId) => {
    return total + (ACHIEVEMENTS[achievementId]?.xp || 0);
  }, 0);
}

// Get achievement progress
export function getAchievementProgress(stats) {
  return Object.values(ACHIEVEMENTS).map((achievement) => {
    const completed = achievement.check(stats);
    return {
      ...achievement,
      completed
    };
  });
}
