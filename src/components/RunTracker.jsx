import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishToNostr } from '../utils/nostr';
import { storeRunLocally } from '../utils/offline';
import { runTracker } from '../services/RunTracker';
import { convertDistance, formatPace, formatTime } from '../utils/formatters';
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
  const navigate = useNavigate();

  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pace, setPace] = useState(0);
  const [splits, setSplits] = useState([]);

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
    runTracker.on('stopped', (finalResults) => {
      const runData = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        splits: JSON.parse(JSON.stringify(finalResults.splits)), // clone splits obj
        duration: finalResults.duration,
        distance: finalResults.distance,
        pace: finalResults.pace
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

  const startRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    runTracker.start();
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
    runTracker.stop();
    setIsRunning(false);
    setIsPaused(false);
  };

  const updateLastRun = (runData) => {
    setLastRun(runData);
  };

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
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
📏 Distance: ${convertDistance(run.distance, distanceUnit)} ${distanceUnit}
⚡️ Pace: ${formatPace(run.pace)} min/km
${
  run.splits.length > 0
    ? '\n📊 Splits:\n' +
      run.splits
        .map((split) => `Km ${split.km}: ${formatPace(split.pace)}`)
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

      <div className="time-display">{formatTime(duration)}</div>

      <div className="distance-display">
        {convertDistance(distance, distanceUnit)} {distanceUnit}
      </div>

      {isRunning && !isPaused && (
        <div className="pace-display">
          Current Pace: {formatPace(pace)} min/km
        </div>
      )}

      {splits.length > 0 && (
        <div className="splits-display">
          <h3>Splits</h3>
          {splits.map((split, i) => (
            <div key={i} className="split-item">
              Km {split.km}: {formatPace(split.pace)}
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
