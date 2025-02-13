import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishToNostr } from '../utils/nostr';
import { useLocation } from '../hooks/useLocation';
import { storeRunLocally } from '../utils/offline';

export const RunTracker = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runHistory, setRunHistory] = useState([]);
  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();

  const {
    error: locationError,
    stats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking
  } = useLocation();

  useEffect(() => {
    const storedProfile = localStorage.getItem('nostrProfile');
    if (storedProfile) {
      setUserProfile(JSON.parse(storedProfile));
    }
    loadRunHistory();
  }, []);

  useEffect(() => {
    if (isRunning && !isPaused) {
      // Request wake lock to prevent device sleep
      try {
        navigator.wakeLock?.request('screen');
      } catch (err) {
        console.warn('Wake Lock not available:', err);
      }
    }
  }, [isRunning, isPaused]);

  const loadRunHistory = () => {
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    setRunHistory(storedRuns);
    if (storedRuns.length > 0) {
      setLastRun(storedRuns[storedRuns.length - 1]);
    }
  };

  const startRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    startTracking();
  };

  const pauseRun = () => {
    setIsPaused(true);
    pauseTracking();
  };

  const resumeRun = () => {
    setIsPaused(false);
    resumeTracking();
  };

  const stopRun = () => {
    stopTracking();

    const runData = {
      id: Date.now(),
      duration: stats.duration,
      distance: stats.distance / 1000, // Convert to kilometers
      date: new Date().toLocaleDateString(),
      pace: stats.pace,
      splits: stats.splits,
      gpsData: stats.positions
    };

    const existingRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    const updatedRuns = [...existingRuns, runData];
    localStorage.setItem('runHistory', JSON.stringify(updatedRuns));

    // Store run locally for offline sync
    storeRunLocally(runData);

    setRunHistory([...runHistory, runData]);
    updateLastRun(runData);
    setIsRunning(false);
    setIsPaused(false);
  };

  const updateLastRun = (runData) => {
    setLastRun(runData);
  };

  const formatTime = (seconds) => {
    // Ensure we have a positive integer
    const totalSeconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    // Format with leading zeros
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  };

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  const convertDistance = (value, from, to) => {
    if (from === to) return value;
    return from === 'km' ? value * 0.621371 : value * 1.60934;
  };

  const displayDistance = (value) => {
    const converted =
      distanceUnit === 'mi' ? convertDistance(value, 'km', 'mi') : value;
    return converted.toFixed(2);
  };

  const formatPace = (pace) => {
    if (!pace || pace <= 0) return '--:--';

    // Round to 2 decimal places first
    const roundedPace = Math.round(pace * 100) / 100;

    // Extract minutes and seconds
    const minutes = Math.floor(roundedPace);
    const seconds = Math.round((roundedPace - minutes) * 60);

    // Handle case where seconds round to 60
    if (seconds === 60) {
      return `${minutes + 1}:00`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePostToNostr = async (run) => {
    if (!window.nostr) {
      const confirmLogin = window.confirm(
        'Please login with Nostr to share your run'
      );
      if (confirmLogin) {
        navigate('/login');
      }
      return;
    }

    try {
      // Verify we can get the public key first
      const pubkey = await window.nostr.getPublicKey();
      if (!pubkey) {
        throw new Error('Could not get Nostr public key');
      }

      // Format the content with emojis and proper spacing
      const content = `
🏃‍♂️ Run Completed!
⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance)} ${distanceUnit}
⚡️ Pace: ${formatPace(run.pace)} min/km
${
  run.splits.length > 0
    ? '\n📊 Splits:\n' +
      run.splits
        .map((split, i) => `Km ${i + 1}: ${formatPace(split.pace)}`)
        .join('\n')
    : ''
}

#Runstr #Running
`.trim();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running'],
          ['t', 'run']
        ],
        content: content,
        pubkey: pubkey
      };

      console.log('Attempting to publish run to Nostr:', event);

      // Show loading state
      const loadingToast = alert('Publishing your run...');

      try {
        await publishToNostr(event);
        alert('Successfully posted your run to Nostr! 🎉');
      } catch (error) {
        console.error('Failed to publish to Nostr:', error);
        if (error.message.includes('timeout')) {
          alert(
            'Publication is taking longer than expected. Your run may still be published.'
          );
        } else if (error.message.includes('No relays connected')) {
          alert(
            'Could not connect to Nostr relays. Please check your connection and try again.'
          );
        } else {
          alert('Failed to post to Nostr. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in handlePostToNostr:', error);
      if (error.message.includes('public key')) {
        alert(
          'Could not access your Nostr account. Please try logging in again.'
        );
        navigate('/login');
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="run-tracker">
      {userProfile?.banner && (
        <div className="dashboard-banner">
          <img
            src={userProfile.banner}
            alt="Profile Banner"
            className="banner-image"
          />
          {userProfile.picture && (
            <img
              src={userProfile.picture}
              alt="Profile"
              className="profile-overlay"
            />
          )}
        </div>
      )}

      <h2 className="page-title">Dashboard</h2>

      <div className="time-display">{formatTime(stats.duration)}</div>

      <div className="distance-display">
        {displayDistance(stats.distance / 1000)} {distanceUnit}
      </div>

      {isRunning && !isPaused && (
        <div className="pace-display">
          Current Pace: {formatPace(stats.pace)} min/km
        </div>
      )}

      {stats.splits.length > 0 && (
        <div className="splits-display">
          <h3>Splits</h3>
          {stats.splits.map((split, i) => (
            <div key={i} className="split-item">
              Km {i + 1}: {formatPace(split.pace)}
            </div>
          ))}
        </div>
      )}

      {locationError && (
        <div className="error-message">GPS Error: {locationError}</div>
      )}

      <div className="controls-top">
        {!isRunning ? (
          <button className="primary-btn" onClick={startRun}>
            Start Run
          </button>
        ) : (
          <>
            {isPaused ? (
              <button className="primary-btn" onClick={resumeRun}>
                Resume
              </button>
            ) : (
              <button className="secondary-btn" onClick={pauseRun}>
                Pause
              </button>
            )}
            <button className="danger-btn" onClick={stopRun}>
              End Run
            </button>
          </>
        )}
      </div>

      <div className="distance-unit-toggle">
        <button
          className={`unit-btn ${distanceUnit === 'km' ? 'active' : ''}`}
          onClick={toggleDistanceUnit}
        >
          KM
        </button>
        <button
          className={`unit-btn ${distanceUnit === 'mi' ? 'active' : ''}`}
          onClick={toggleDistanceUnit}
        >
          MI
        </button>
      </div>

      {lastRun && (
        <div className="last-run">
          <h3>Previous Run</h3>
          <div className="last-run-details">
            <span>Date: {lastRun.date}</span>
            <span>Duration: {formatTime(lastRun.duration)}</span>
            <span>
              Distance: {displayDistance(lastRun.distance)} {distanceUnit}
            </span>
            <span>Pace: {formatPace(lastRun.pace)} min/km</span>
          </div>
          <div className="run-actions">
            <button
              className="view-history-btn"
              onClick={() => setShowHistoryModal(true)}
            >
              View All Runs
            </button>
            <button
              className="share-btn"
              onClick={() => handlePostToNostr(lastRun)}
            >
              Share to Nostr
            </button>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowHistoryModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Run History</h2>
            <div className="history-list">
              {runHistory.map((run) => (
                <div key={run.id} className="history-item">
                  <div className="run-date">{run.date}</div>
                  <div className="run-details">
                    <span>Duration: {formatTime(run.duration)}</span>
                    <span>
                      Distance: {displayDistance(run.distance)} {distanceUnit}
                    </span>
                    <span>Pace: {formatPace(run.pace)} min/km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
