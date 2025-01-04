import { useState, useEffect } from 'react';

const POINTS = {
  perKilometer: 10,
  achievementComplete: 100,
  streakBonus: 50,
  personalBest: 200
};

const ACHIEVEMENT_GOALS = {
  beginner: [
    {
      id: 'first_run',
      name: 'First Run',
      description: 'Complete your first run',
      icon: '🎯',
      requirement: { runs: 1 },
      points: 100
    },
    {
      id: 'five_runs',
      name: 'Getting Started',
      description: 'Complete 5 runs',
      icon: '🏃',
      requirement: { runs: 5 },
      points: 200
    },
    {
      id: '5k',
      name: '5K Runner',
      description: 'Complete a 5K run',
      icon: '🥉',
      requirement: { distance: 5 },
      points: 300
    }
  ],
  intermediate: [
    {
      id: '10k',
      name: '10K Achievement',
      description: 'Complete a 10K run',
      icon: '🥈',
      requirement: { distance: 10 },
      points: 500
    },
    {
      id: 'twenty_runs',
      name: 'Regular Runner',
      description: 'Complete 20 runs',
      icon: '⭐',
      requirement: { runs: 20 },
      points: 400
    },
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: 'Run at a pace under 5:00 min/km',
      icon: '⚡',
      requirement: { pace: 5 },
      points: 600
    },
    {
      id: 'weekly_streak',
      name: 'Weekly Warrior',
      description: 'Complete runs for 7 consecutive days',
      icon: '🔥',
      requirement: { streak: 7 },
      points: 700
    }
  ],
  advanced: [
    {
      id: 'half_marathon',
      name: 'Half Marathon',
      description: 'Complete a 21.1K run',
      icon: '🥇',
      requirement: { distance: 21.1 },
      points: 1000
    },
    {
      id: 'fifty_runs',
      name: 'Dedicated Runner',
      description: 'Complete 50 runs',
      icon: '🌟',
      requirement: { runs: 50 },
      points: 800
    },
    {
      id: 'marathon',
      name: 'Marathon Runner',
      description: 'Complete a 42.2K run',
      icon: '👑',
      requirement: { distance: 42.2 },
      points: 2000
    },
    {
      id: 'monthly_streak',
      name: 'Monthly Master',
      description: 'Complete runs for 30 consecutive days',
      icon: '🏆',
      requirement: { streak: 30 },
      points: 1500
    }
  ]
};

export const Achievements = () => {
  const [achievements, setAchievements] = useState({});
  const [runHistory, setRunHistory] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState(1);

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
      let points = 0;
      
      // Calculate total runs and streaks
      const totalRuns = runHistory.length;
      const streakDays = calculateStreak(runHistory);
      
      // Add points for total distance
      const totalDistance = runHistory.reduce((sum, run) => sum + run.distance, 0);
      points += Math.floor(totalDistance * POINTS.perKilometer);
      
      // Process each run to check achievements
      runHistory.forEach(run => {
        // Check distance achievements
        if (run.distance >= 5 && !completed['5k']) {
          completed['5k'] = true;
          points += ACHIEVEMENT_GOALS.beginner.find(a => a.id === '5k').points;
        }
        if (run.distance >= 10 && !completed['10k']) {
          completed['10k'] = true;
          points += ACHIEVEMENT_GOALS.intermediate.find(a => a.id === '10k').points;
        }
        if (run.distance >= 21.1 && !completed['half_marathon']) {
          completed['half_marathon'] = true;
          points += ACHIEVEMENT_GOALS.advanced.find(a => a.id === 'half_marathon').points;
        }
        if (run.distance >= 42.2 && !completed['marathon']) {
          completed['marathon'] = true;
          points += ACHIEVEMENT_GOALS.advanced.find(a => a.id === 'marathon').points;
        }
        
        // Check pace achievements
        const paceMinKm = (run.duration / 60) / run.distance;
        if (paceMinKm < 5 && !completed['speed_demon']) {
          completed['speed_demon'] = true;
          points += ACHIEVEMENT_GOALS.intermediate.find(a => a.id === 'speed_demon').points;
        }
      });
      
      // Check run count achievements
      if (totalRuns >= 1 && !completed['first_run']) {
        completed['first_run'] = true;
        points += ACHIEVEMENT_GOALS.beginner.find(a => a.id === 'first_run').points;
      }
      if (totalRuns >= 5 && !completed['five_runs']) {
        completed['five_runs'] = true;
        points += ACHIEVEMENT_GOALS.beginner.find(a => a.id === 'five_runs').points;
      }
      if (totalRuns >= 20 && !completed['twenty_runs']) {
        completed['twenty_runs'] = true;
        points += ACHIEVEMENT_GOALS.intermediate.find(a => a.id === 'twenty_runs').points;
      }
      if (totalRuns >= 50 && !completed['fifty_runs']) {
        completed['fifty_runs'] = true;
        points += ACHIEVEMENT_GOALS.advanced.find(a => a.id === 'fifty_runs').points;
      }

      // Check streak achievements
      if (streakDays >= 7 && !completed['weekly_streak']) {
        completed['weekly_streak'] = true;
        points += ACHIEVEMENT_GOALS.intermediate.find(a => a.id === 'weekly_streak').points;
      }
      if (streakDays >= 30 && !completed['monthly_streak']) {
        completed['monthly_streak'] = true;
        points += ACHIEVEMENT_GOALS.advanced.find(a => a.id === 'monthly_streak').points;
      }
      
      setAchievements(completed);
      setTotalPoints(points);
      setLevel(Math.floor(points / 1000) + 1); // Level up every 1000 points
    };

    calculateAchievements();
  }, [runHistory]);

  const calculateStreak = (runs) => {
    if (!runs.length) return 0;
    
    const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 1;
    let currentDate = new Date(sortedRuns[0].date);
    
    for (let i = 1; i < sortedRuns.length; i++) {
      const prevDate = new Date(sortedRuns[i].date);
      const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }
    
    return streak;
  };

  return (
    <div className="achievements-container">
      <div className="achievements-header">
        <h2>Achievements</h2>
        <div className="stats">
          <div className="level">Level {level}</div>
          <div className="points">Total Points: {totalPoints}</div>
        </div>
      </div>
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