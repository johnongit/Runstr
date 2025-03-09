import { useState, useEffect, useCallback } from 'react';
import { publishToNostr } from '../utils/nostr';

export const RunHistory = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [distanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  const [userProfile, setUserProfile] = useState(() => {
    const storedProfile = localStorage.getItem('userProfile');
    return storedProfile
      ? JSON.parse(storedProfile)
      : {
          weight: 70, // default weight in kg
          heightFeet: 5, // default height in feet
          heightInches: 7, // default height in inches
          heightCm: 170, // store equivalent in cm for calculations
          gender: 'male', // default gender
          age: 30, // default age
          fitnessLevel: 'intermediate' // default fitness level
        };
  });
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    averagePace: 0,
    fastestPace: Infinity,
    longestRun: 0,
    currentStreak: 0,
    bestStreak: 0,
    thisWeekDistance: 0,
    thisMonthDistance: 0,
    totalCaloriesBurned: 0,
    averageCaloriesPerKm: 0,
    personalBests: {
      '5k': Infinity,
      '10k': Infinity,
      halfMarathon: Infinity,
      marathon: Infinity
    }
  });

  useEffect(() => {
    loadRunHistory();
  }, []);

  // Calculate calories burned based on user profile and run data
  const calculateCaloriesBurned = useCallback((distance, duration, userProfile) => {
    // MET (Metabolic Equivalent of Task) values for running at different intensities
    // The higher the pace, the higher the MET value
    const getPaceMET = (paceMinPerKm) => {
      if (paceMinPerKm < 4) return 11.5; // Very fast
      if (paceMinPerKm < 5) return 10.0; // Fast
      if (paceMinPerKm < 6) return 9.0; // Moderate to fast
      if (paceMinPerKm < 7) return 8.0; // Moderate
      if (paceMinPerKm < 8) return 7.0; // Moderate to slow
      return 6.0; // Slow
    };

    // Adjustments based on fitness level
    const fitnessAdjustment = {
      beginner: 1.0,
      intermediate: 0.95,
      advanced: 0.9
    };

    // Adjustments based on gender (due to different body compositions)
    const genderAdjustment = {
      male: 1.0,
      female: 0.9
    };

    // Age adjustment (generally, calorie burn decreases with age)
    const getAgeAdjustment = (age) => {
      if (age < 20) return 1.10;
      if (age < 30) return 1.05;
      if (age < 40) return 1.0;
      if (age < 50) return 0.95;
      if (age < 60) return 0.90;
      return 0.85;
    };

    // Calculate pace in minutes per km
    const pace = duration / 60 / distance;
    
    // Get MET value based on pace
    const met = getPaceMET(pace);
    
    // Calculate base calories
    // Formula: MET * weight in kg * duration in hours
    const durationHours = duration / 3600;
    const baseCalories = met * userProfile.weight * durationHours;
    
    // Apply adjustments
    const adjustedCalories = 
      baseCalories * 
      fitnessAdjustment[userProfile.fitnessLevel] * 
      genderAdjustment[userProfile.gender] * 
      getAgeAdjustment(userProfile.age);
    
    return Math.round(adjustedCalories);
  }, []);

  const calculateStats = useCallback(() => {
    const newStats = {
      totalDistance: 0,
      totalRuns: runHistory.length,
      averagePace: 0,
      fastestPace: Infinity,
      longestRun: 0,
      currentStreak: 0,
      bestStreak: 0,
      thisWeekDistance: 0,
      thisMonthDistance: 0,
      totalCaloriesBurned: 0,
      averageCaloriesPerKm: 0,
      personalBests: {
        '5k': Infinity,
        '10k': Infinity,
        halfMarathon: Infinity,
        marathon: Infinity
      }
    };

    let totalPace = 0;
    let totalCalories = 0;
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sort runs by date for streak calculation
    const sortedRuns = [...runHistory].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Calculate current streak
    let streak = 0;
    let currentDate =
      sortedRuns.length > 0 ? new Date(sortedRuns[0].date) : null;

    for (let i = 0; i < sortedRuns.length; i++) {
      const runDate = new Date(sortedRuns[i].date);
      if (
        i === 0 ||
        Math.floor((currentDate - runDate) / (1000 * 60 * 60 * 24)) === 1
      ) {
        streak++;
        currentDate = runDate;
      } else {
        break;
      }
    }
    newStats.currentStreak = streak;

    // Process each run
    runHistory.forEach((run) => {
      // Total distance
      newStats.totalDistance += run.distance;

      // Longest run
      if (run.distance > newStats.longestRun) {
        newStats.longestRun = run.distance;
      }

      // Pace calculations
      const pace = run.duration / 60 / run.distance;
      totalPace += pace;
      if (pace < newStats.fastestPace) {
        newStats.fastestPace = pace;
      }

      // Calculate calories burned for this run
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
      totalCalories += caloriesBurned;

      // This week and month distances
      const runDate = new Date(run.date);
      if (runDate >= weekStart) {
        newStats.thisWeekDistance += run.distance;
      }
      if (runDate >= monthStart) {
        newStats.thisMonthDistance += run.distance;
      }

      // Personal bests for standard distances
      if (run.distance >= 5) {
        const pace5k = run.duration / 60 / 5;
        if (pace5k < newStats.personalBests['5k']) {
          newStats.personalBests['5k'] = pace5k;
        }
      }
      if (run.distance >= 10) {
        const pace10k = run.duration / 60 / 10;
        if (pace10k < newStats.personalBests['10k']) {
          newStats.personalBests['10k'] = pace10k;
        }
      }
      if (run.distance >= 21.1) {
        const paceHalf = run.duration / 60 / 21.1;
        if (paceHalf < newStats.personalBests['halfMarathon']) {
          newStats.personalBests['halfMarathon'] = paceHalf;
        }
      }
      if (run.distance >= 42.2) {
        const paceMarathon = run.duration / 60 / 42.2;
        if (paceMarathon < newStats.personalBests['marathon']) {
          newStats.personalBests['marathon'] = paceMarathon;
        }
      }
    });

    // Calculate average pace
    newStats.averagePace = totalPace / runHistory.length || 0;
    
    // Set total calories burned
    newStats.totalCaloriesBurned = totalCalories;
    
    // Calculate average calories per km
    newStats.averageCaloriesPerKm = totalCalories / newStats.totalDistance || 0;

    setStats(newStats);
  }, [runHistory, calculateCaloriesBurned, userProfile]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const loadRunHistory = () => {
    const storedRuns = localStorage.getItem('runHistory');
    if (storedRuns) {
      setRunHistory(JSON.parse(storedRuns));
    }
  };

  const handleDeleteRun = (runId) => {
    if (window.confirm('Are you sure you want to delete this run?')) {
      const updatedRuns = runHistory.filter((run) => run.id !== runId);
      localStorage.setItem('runHistory', JSON.stringify(updatedRuns));
      setRunHistory(updatedRuns);
    }
  };

  const handlePostToNostr = (run) => {
    setSelectedRun(run);
    setAdditionalContent('');
    setShowModal(true);
  };

  const handlePostSubmit = async () => {
    if (!selectedRun) return;
    
    setIsPosting(true);
    
    try {
      const run = selectedRun;
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
      
      const content = `
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance)}
⚡ Pace: ${(run.duration / 60 / run.distance).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss)}` : ''}
${additionalContent ? `\n${additionalContent}` : ''}
#Runstr #Running
`.trim();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running']
        ],
        content: content
      };

      await publishToNostr(event);
      setShowModal(false);
      setAdditionalContent('');
      alert('Successfully posted to Nostr!');
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      alert('Failed to post to Nostr: ' + error.message);
    } finally {
      setIsPosting(false);
      setShowModal(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const displayDistance = (value) => {
    const converted = distanceUnit === 'mi' ? value * 0.621371 : value;
    return `${converted.toFixed(2)} ${distanceUnit}`;
  };

  const handleProfileSubmit = () => {
    // Convert feet and inches to cm for storage and calculations
    const heightCm = (userProfile.heightFeet * 30.48) + (userProfile.heightInches * 2.54);
    
    const updatedProfile = {
      ...userProfile,
      heightCm: Math.round(heightCm)
    };
    
    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    setUserProfile(updatedProfile);
    setShowProfileModal(false);
    // Recalculate stats with new profile data
    calculateStats();
  };

  const handleProfileChange = (field, value) => {
    console.log(`Updating ${field} to ${value}`); // Add logging for debugging
    
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If feet or inches are updated, also update the cm value
      if (field === 'heightFeet' || field === 'heightInches') {
        const feet = field === 'heightFeet' ? value : prev.heightFeet;
        const inches = field === 'heightInches' ? value : prev.heightInches;
        updated.heightCm = Math.round((feet * 30.48) + (inches * 2.54));
      }
      
      console.log('Updated profile:', updated); // Log the updated profile
      return updated;
    });
  };

  // Add a function to format elevation display
  const formatElevation = (meters) => {
    if (!meters || meters === null || isNaN(meters)) return '-- ';
    
    if (distanceUnit === 'mi') {
      // Convert to feet (1 meter = 3.28084 feet)
      return `${Math.round(meters * 3.28084)} ft`;
    } else {
      return `${Math.round(meters)} m`;
    }
  };

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>STATS</h2>
        <button 
          className="profile-btn" 
          onClick={() => setShowProfileModal(true)}
          title="Update your profile for accurate calorie calculations"
        >
          Update Profile
        </button>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p>{displayDistance(stats.totalDistance)}</p>
          </div>
          <div className="stat-card">
            <h3>Total Runs</h3>
            <p>{stats.totalRuns}</p>
          </div>
          <div className="stat-card">
            <h3>Current Streak</h3>
            <p>{stats.currentStreak} days</p>
          </div>
          <div className="stat-card">
            <h3>Average Pace</h3>
            <p>{stats.averagePace.toFixed(2)} min/km</p>
          </div>
          <div className="stat-card">
            <h3>Fastest Pace</h3>
            <p>
              {stats.fastestPace === Infinity
                ? '-'
                : stats.fastestPace.toFixed(2)}{' '}
              min/km
            </p>
          </div>
          <div className="stat-card">
            <h3>Longest Run</h3>
            <p>{displayDistance(stats.longestRun)}</p>
          </div>
        </div>

        <div className="calorie-stats">
          <h3>Calorie Tracking</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Calories Burned</h4>
              <p>{stats.totalCaloriesBurned.toLocaleString()} kcal</p>
            </div>
            <div className="stat-card">
              <h4>Avg. Calories per KM</h4>
              <p>{Math.round(stats.averageCaloriesPerKm)} kcal</p>
            </div>
          </div>
        </div>

        <div className="recent-stats">
          <h3>Recent Activity</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>This Week</h4>
              <p>{displayDistance(stats.thisWeekDistance)}</p>
            </div>
            <div className="stat-card">
              <h4>This Month</h4>
              <p>{displayDistance(stats.thisMonthDistance)}</p>
            </div>
          </div>
        </div>

        <div className="personal-bests">
          <h3>Personal Bests</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>5K</h4>
              <p>
                {stats.personalBests['5k'] === Infinity
                  ? '-'
                  : stats.personalBests['5k'].toFixed(2)}{' '}
                min/km
              </p>
            </div>
            <div className="stat-card">
              <h4>10K</h4>
              <p>
                {stats.personalBests['10k'] === Infinity
                  ? '-'
                  : stats.personalBests['10k'].toFixed(2)}{' '}
                min/km
              </p>
            </div>
            <div className="stat-card">
              <h4>Half Marathon</h4>
              <p>
                {stats.personalBests['halfMarathon'] === Infinity
                  ? '-'
                  : stats.personalBests['halfMarathon'].toFixed(2)}{' '}
                min/km
              </p>
            </div>
            <div className="stat-card">
              <h4>Marathon</h4>
              <p>
                {stats.personalBests['marathon'] === Infinity
                  ? '-'
                  : stats.personalBests['marathon'].toFixed(2)}{' '}
                min/km
              </p>
            </div>
          </div>
        </div>

        {/* Add elevation stats to overview */}
        <div className="elevation-stats-overview">
          <h3>Elevation Data</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Elevation Gain</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.gain || 0), 0)
                )}
              </p>
            </div>
            <div className="stat-card">
              <h4>Total Elevation Loss</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.loss || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2>Run History</h2>
      {runHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {runHistory.map((run) => {
            const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
            return (
              <li key={run.id} className="history-item">
                <div className="run-date">{run.date}</div>
                <div className="run-details">
                  <span>Duration: {formatTime(run.duration)}</span>
                  <span>Distance: {displayDistance(run.distance)}</span>
                  <span>
                    Pace:{' '}
                    {run.duration > 0
                      ? (run.duration / 60 / run.distance).toFixed(2)
                      : '0'}{' '}
                    min/{distanceUnit}
                  </span>
                  <span>Calories: {caloriesBurned} kcal</span>
                  {/* Add elevation data */}
                  {run.elevation && (
                    <>
                      <span>
                        Elevation Gain: {formatElevation(run.elevation.gain)}
                      </span>
                      <span>
                        Elevation Loss: {formatElevation(run.elevation.loss)}
                      </span>
                    </>
                  )}
                </div>
                <div className="run-actions">
                  <button
                    onClick={() => handlePostToNostr(run)}
                    className="share-btn"
                  >
                    Share to Nostr
                  </button>
                  <button
                    onClick={() => handleDeleteRun(run.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Post Run to Nostr</h3>
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder="Add any additional comments or hashtags..."
              rows={4}
              disabled={isPosting}
            />
            <div className="modal-buttons">
              <button onClick={handlePostSubmit} disabled={isPosting}>
                {isPosting ? 'Posting...' : 'Post'}
              </button>
              <button onClick={() => setShowModal(false)} disabled={isPosting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content profile-modal">
            <h3>User Profile</h3>
            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>
              <input
                id="weight"
                type="number"
                value={userProfile.weight}
                onChange={(e) => handleProfileChange('weight', Number(e.target.value))}
              />
            </div>
            <div className="form-group height-inputs">
              <label>Height</label>
              <div className="height-fields">
                <div className="height-field">
                  <input
                    id="heightFeet"
                    type="number"
                    min="0"
                    max="8"
                    value={userProfile.heightFeet}
                    onChange={(e) => handleProfileChange('heightFeet', Number(e.target.value))}
                  />
                  <label htmlFor="heightFeet">ft</label>
                </div>
                <div className="height-field">
                  <input
                    id="heightInches"
                    type="number"
                    min="0"
                    max="11"
                    value={userProfile.heightInches}
                    onChange={(e) => handleProfileChange('heightInches', Number(e.target.value))}
                  />
                  <label htmlFor="heightInches">in</label>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={userProfile.gender}
                onChange={(e) => handleProfileChange('gender', e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                value={userProfile.age}
                onChange={(e) => handleProfileChange('age', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fitnessLevel">Fitness Level</label>
              <select
                id="fitnessLevel"
                value={userProfile.fitnessLevel}
                onChange={(e) => handleProfileChange('fitnessLevel', e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="modal-buttons">
              <button onClick={handleProfileSubmit}>Save</button>
              <button onClick={() => setShowProfileModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
