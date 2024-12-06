import { useState, useEffect } from 'react';

const ACHIEVEMENT_GOALS = {
  beginner: [
    {
      id: 'first_run',
      name: 'First Run',
      description: 'Complete your first run',
      icon: '🎯',
      requirement: { runs: 1 }
    },
    {
      id: 'five_runs',
      name: 'Getting Started',
      description: 'Complete 5 runs',
      icon: '🏃',
      requirement: { runs: 5 }
    },
    {
      id: '5k',
      name: '5K Runner',
      description: 'Complete a 5K run',
      icon: '🥉',
      requirement: { distance: 5 }
    }
  ],
  intermediate: [
    {
      id: '10k',
      name: '10K Achievement',
      description: 'Complete a 10K run',
      icon: '🥈',
      requirement: { distance: 10 }
    },
    {
      id: 'twenty_runs',
      name: 'Regular Runner',
      description: 'Complete 20 runs',
      icon: '⭐',
      requirement: { runs: 20 }
    },
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Run at a pace under 5:00 min/km',
      icon: '⚡',
      requirement: { pace: 5 }
    }
  ],
  advanced: [
    {
      id: 'half_marathon',
      name: 'Half Marathon',
      description: 'Complete a 21.1K run',
      icon: '🥇',
      requirement: { distance: 21.1 }
    },
    {
      id: 'fifty_runs',
      name: 'Dedicated Runner',
      description: 'Complete 50 runs',
      icon: '🌟',
      requirement: { runs: 50 }
    },
    {
      id: 'marathon',
      name: 'Marathon Runner',
      description: 'Complete a 42.2K run',
      icon: '👑',
      requirement: { distance: 42.2 }
    }
  ]
};

export const Achievements = () => {
  const [achievements, setAchievements] = useState({});
  const [runHistory, setRunHistory] = useState([]);

  useEffect(() => {
    const loadRunHistory = () => {
      const storedRuns = localStorage.getItem('runHistory');
      if (storedRuns) {
        setRunHistory(JSON.parse(storedRuns));
      }
    };

    loadRunHistory();
  }, []);

  useEffect(() => {
    const calculateAchievements = () => {
      const completed = {};
      
      // Calculate total runs
      const totalRuns = runHistory.length;
      
      // Process each run to check achievements
      runHistory.forEach(run => {
        // Check distance achievements
        if (run.distance >= 5 && !completed['5k']) completed['5k'] = true;
        if (run.distance >= 10 && !completed['10k']) completed['10k'] = true;
        if (run.distance >= 21.1 && !completed['half_marathon']) completed['half_marathon'] = true;
        if (run.distance >= 42.2 && !completed['marathon']) completed['marathon'] = true;
        
        // Check pace achievements
        const paceMinKm = (run.duration / 60) / run.distance;
        if (paceMinKm < 5 && !completed['speed_demon']) completed['speed_demon'] = true;
      });
      
      // Check run count achievements
      if (totalRuns >= 1) completed['first_run'] = true;
      if (totalRuns >= 5) completed['five_runs'] = true;
      if (totalRuns >= 20) completed['twenty_runs'] = true;
      if (totalRuns >= 50) completed['fifty_runs'] = true;
      
      setAchievements(completed);
    };

    calculateAchievements();
  }, [runHistory]);

  return (
    <div className="achievements-container">
      <h2>Achievements</h2>
      <p>Track your running milestones</p>

      {Object.entries(ACHIEVEMENT_GOALS).map(([level, goals]) => (
        <div key={level} className="achievement-section">
          <h3 className="achievement-level">{level.charAt(0).toUpperCase() + level.slice(1)}</h3>
          <div className="achievements-grid">
            {goals.map(goal => (
              <div 
                key={goal.id}
                className={`achievement-card ${achievements[goal.id] ? 'completed' : ''}`}
              >
                <span className="achievement-icon">{goal.icon}</span>
                <h4>{goal.name}</h4>
                <p>{goal.description}</p>
                {achievements[goal.id] && (
                  <span className="completion-badge">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}; 