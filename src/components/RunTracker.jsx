import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishToNostr } from '../utils/nostr';
import { storeRunLocally } from '../utils/offline';
import { runTracker } from '../services/RunTracker';
import { convertDistance, formatPace, formatPaceWithUnit, formatTime } from '../utils/formatters';
import { PermissionDialog } from './PermissionDialog';

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
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [countdown, setCountdown] = useState(0); // Countdown timer value
  const [isCountingDown, setIsCountingDown] = useState(false); // Flag to indicate countdown is in progress
  const [countdownType, setCountdownType] = useState(''); // 'start' or 'stop'
  const navigate = useNavigate();

  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pace, setPace] = useState(0);
  const [splits, setSplits] = useState([]);
  // Add state for elevation data
  const [elevation, setElevation] = useState({
    current: null,
    gain: 0,
    loss: 0
  });

  // Check if permissions have been granted on component mount
  useEffect(() => {
    const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
    
    // If this is the first time the user opens the app, show the permission dialog
    if (!permissionsGranted) {
      setShowPermissionDialog(true);
    }
  }, []);

  useEffect(() => {
    runTracker.on('distanceChange', setDistance);
    runTracker.on('durationChange', setDuration);
    runTracker.on('paceChange', setPace);
    runTracker.on('splitRecorded', setSplits);
    // Add listener for elevation changes
    runTracker.on('elevationChange', setElevation);
    runTracker.on('stopped', (finalResults) => {
      const runData = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        splits: JSON.parse(JSON.stringify(finalResults.splits)), // clone splits obj
        duration: finalResults.duration,
        distance: finalResults.distance,
        pace: finalResults.pace,
        // Include elevation data in saved run
        elevation: finalResults.elevation || {
          gain: 0,
          loss: 0
        }
      };

      // todo: move this to utils
      const existingRuns = JSON.parse(
        localStorage.getItem('runHistory') || '[]'
      );
      const updatedRuns = [...existingRuns, runData];
      localStorage.setItem('runHistory', JSON.stringify(updatedRuns));

      // Store run locally for offline sync
      storeRunLocally(runData);

      setRunHistory((prev) => [...prev, runData]);
      updateLastRun(runData);
      setIsRunning(false);
      setIsPaused(false);

      setDistance(0);
      setDuration(0);
      setPace(0);
      setSplits([]);
    });

    return () => {
      runTracker.stop();
    };
  }, []);

  useEffect(() => {
    const storedProfile = localStorage.getItem('nostrProfile');
    if (storedProfile) {
      setUserProfile(JSON.parse(storedProfile));
    }
    loadRunHistory();
  }, []);

  const loadRunHistory = () => {
    const storedRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    setRunHistory(storedRuns);
    if (storedRuns.length > 0) {
      setLastRun(storedRuns[storedRuns.length - 1]);
    }
  };

  const initiateRun = () => {
    // Check if the user has already granted permissions
    const permissionsGranted = localStorage.getItem('permissionsGranted');
    
    if (permissionsGranted === 'true') {
      // If permissions already granted, start the run immediately
      startRun();
    } else {
      // Show the permission dialog first
      setShowPermissionDialog(true);
    }
  };

  const handlePermissionContinue = () => {
    // User has acknowledged the permission requirements
    localStorage.setItem('permissionsGranted', 'true');
    setShowPermissionDialog(false);
    startRun();
  };

  const handlePermissionCancel = () => {
    // User declined to proceed
    setShowPermissionDialog(false);
  };

  const startCountdown = (type) => {
    setCountdownType(type);
    setIsCountingDown(true);
    setCountdown(5);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(countdownInterval);
          
          // Add small delay before hiding overlay for better UX
          setTimeout(() => {
            setIsCountingDown(false);
            
            // Execute the appropriate action after countdown finishes
            if (type === 'start') {
              setIsRunning(true);
              setIsPaused(false);
              runTracker.start();
            } else if (type === 'stop') {
              runTracker.stop();
              setIsRunning(false);
              setIsPaused(false);
            }
          }, 200);
          
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
  };

  const startRun = () => {
    startCountdown('start');
  };

  const pauseRun = () => {
    setIsPaused(true);
    runTracker.pause();
  };

  const resumeRun = () => {
    setIsPaused(false);
    runTracker.resume();
  };

  const stopRun = () => {
    startCountdown('stop');
  };

  const updateLastRun = (runData) => {
    setLastRun(runData);
  };

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  // Format elevation for display
  const formatElevation = (meters) => {
    if (meters === null || isNaN(meters)) return '--';
    
    if (distanceUnit === 'mi') {
      // Convert to feet (1 meter = 3.28084 feet)
      return `${Math.round(meters * 3.28084)} ft`;
    } else {
      return `${Math.round(meters)} m`;
    }
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
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${convertDistance(run.distance, distanceUnit)} ${distanceUnit}
⚡ Pace: ${formatPaceWithUnit(run.pace, distanceUnit)}
${run.elevation ? `🏔️ Elevation Gain: ${formatElevation(run.elevation.gain)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss)}` : ''}
${
  run.splits.length > 0
    ? '\n📊 Splits:\n' +
      run.splits
        .map((split) => `${distanceUnit === 'km' ? `Km ${split.km}` : `Mile ${(split.km * 0.621371).toFixed(1)}`}: ${formatPace(split.pace, distanceUnit)}`)
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
      // const loadingToast = alert('Publishing your run...');

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
      {showPermissionDialog && (
        <PermissionDialog 
          onContinue={handlePermissionContinue}
          onCancel={handlePermissionCancel}
        />
      )}

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

      <h2 className="page-title">DASHBOARD</h2>

      {isCountingDown && (
        <div className="countdown-overlay">
          <div className="countdown-container">
            <div className="countdown-text">
              {countdownType === 'start' ? 'Starting in' : 'Stopping in'}
            </div>
            <div className="countdown-number">{countdown}</div>
          </div>
        </div>
      )}

      <div className="time-display">{formatTime(duration)}</div>

      <div className="distance-display">
        {convertDistance(distance, distanceUnit)} {distanceUnit}
      </div>

      {isRunning && !isPaused && (
        <div className="pace-display">
          Current Pace: {formatPaceWithUnit(pace, distanceUnit)}
        </div>
      )}

      {/* Add elevation display */}
      {isRunning && (
        <div className="elevation-display">
          <div className="elevation-current">
            Current: {formatElevation(elevation.current)}
          </div>
          <div className="elevation-stats">
            <div className="elevation-gain">↗️ {formatElevation(elevation.gain)}</div>
            <div className="elevation-loss">↘️ {formatElevation(elevation.loss)}</div>
          </div>
        </div>
      )}

      {splits.length > 0 && (
        <div className="splits-display">
          <h3>Splits</h3>
          {splits.map((split, i) => (
            <div key={i} className="split-item">
              {distanceUnit === 'km' ? `Km ${split.km}` : `Mile ${(split.km * 0.621371).toFixed(1)}`}: {formatPace(split.pace, distanceUnit)}
            </div>
          ))}
        </div>
      )}

      {/* {locationError && (
        <div className="error-message">GPS Error: {locationError}</div>
      )} */}

      <div className="controls-top">
        {!isRunning ? (
          <button className="primary-btn" onClick={initiateRun}>
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
              Distance: {convertDistance(lastRun.distance, distanceUnit)}{' '}
              {distanceUnit}
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
                      Distance: {convertDistance(run.distance, distanceUnit)}{' '}
                      {distanceUnit}
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
