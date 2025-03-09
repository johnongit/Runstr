import { useState, useEffect, useCallback } from 'react';
import { publishToNostr } from '../utils/nostr';

export const RunHistory = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [distanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
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
      personalBests: {
        '5k': Infinity,
        '10k': Infinity,
        halfMarathon: Infinity,
        marathon: Infinity
      }
    };

    let totalPace = 0;
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

    setStats(newStats);
  }, [runHistory]);

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
    setShowModal(true);
  };

  const handlePostSubmit = async () => {
    // todo: handle signing

    setIsPosting(true);

    const content = `
🏃‍♂️ Run Completed!
⏱️ Duration: ${formatTime(selectedRun.duration)}
📏 Distance: ${selectedRun.distance.toFixed(2)} km
⚡️ Pace: ${selectedRun.duration > 0 ? (selectedRun.duration / 60 / selectedRun.distance).toFixed(2) : '0'} min/km

${additionalContent}

#Runstr #Running
`;

    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'Runstr'],
        ['t', 'Running']
      ],
      content: content
    };

    try {
      await publishToNostr(event);
      setShowModal(false);
      setAdditionalContent('');
      alert('Successfully posted to Nostr!');
    } catch (error) {
      alert('Failed to post to Nostr. Please try again.');
      console.error('Error posting to Nostr:', error);
    } finally {
      setIsPosting(false);
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

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>STATS</h2>
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
      </div>

      <h2>Run History</h2>
      {runHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {runHistory.map((run) => (
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
                  min/km
                </span>
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
          ))}
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
    </div>
  );
};
