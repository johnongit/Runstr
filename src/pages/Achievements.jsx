import { useAchievements } from '../hooks/useAchievements';
import { ACHIEVEMENTS } from '../utils/achievements';

export const Achievements = () => {
  const { unlockedAchievements, totalXP, level, xpToNext } = useAchievements();

  // Group achievements by category
  const achievementCategories = {
    Distance: Object.values(ACHIEVEMENTS).filter(
      (a) => a.id.includes('DISTANCE_') || a.id.includes('TOTAL_')
    ),
    Streaks: Object.values(ACHIEVEMENTS).filter((a) =>
      a.id.includes('STREAK_')
    ),
    Speed: Object.values(ACHIEVEMENTS).filter((a) => a.id.includes('SPEED_')),
    Social: Object.values(ACHIEVEMENTS).filter((a) => a.id.includes('SHARE')),
    Special: Object.values(ACHIEVEMENTS).filter(
      (a) =>
        !a.id.includes('DISTANCE_') &&
        !a.id.includes('STREAK_') &&
        !a.id.includes('SPEED_') &&
        !a.id.includes('SHARE') &&
        !a.id.includes('TOTAL_')
    )
  };

  return (
    <div className="achievements-container">
      {/* Level Progress Section */}
      <div className="level-progress">
        <div className="level-info">
          <h2>Level {level}</h2>
          <div className="xp-info">
            <span>{totalXP} XP</span>
            <span>{xpToNext} XP to next level</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress"
              style={{
                width: `${(totalXP % 1000) / 10}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Achievements Sections */}
      {Object.entries(achievementCategories).map(([category, achievements]) => (
        <div key={category} className="achievement-section">
          <h3 className="achievement-level">{category} Achievements</h3>
          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`achievement-card ${unlockedAchievements.includes(achievement.id) ? 'completed' : ''}`}
              >
                <span className="achievement-icon">{achievement.icon}</span>
                <h4>{achievement.title}</h4>
                <p>{achievement.description}</p>
                <span className="achievement-points">+{achievement.xp} XP</span>
                {unlockedAchievements.includes(achievement.id) && (
                  <div className="completion-badge">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
