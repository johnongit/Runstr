import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishToNostr } from '../utils/nostr';

export const RunTracker = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [runHistory, setRunHistory] = useState([]);
  const [distanceUnit, setDistanceUnit] = useState(() => 
    localStorage.getItem('distanceUnit') || 'km'
  );
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedProfile = localStorage.getItem('nostrProfile');
    if (storedProfile) {
      setUserProfile(JSON.parse(storedProfile));
    }
    loadRunHistory();
  }, []);

  useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
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
  };

  const pauseRun = () => {
    setIsPaused(true);
  };

  const resumeRun = () => {
    setIsPaused(false);
  };

  const handleDistanceChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    const converted = distanceUnit === 'mi' ? convertDistance(value, 'mi', 'km') : value;
    setDistance(converted);
  };

  const stopRun = () => {
    const runData = {
      id: Date.now(),
      duration: time,
      distance: distance,
      date: new Date().toLocaleDateString(),
    };
    
    const existingRuns = JSON.parse(localStorage.getItem('runHistory') || '[]');
    const updatedRuns = [...existingRuns, runData];
    localStorage.setItem('runHistory', JSON.stringify(updatedRuns));
    
    setRunHistory([...runHistory, runData]);
    updateLastRun(runData);
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setDistance(0);
  };

  const updateLastRun = (runData) => {
    setLastRun(runData);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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
    const converted = distanceUnit === 'mi' ? convertDistance(value, 'km', 'mi') : value;
    return converted.toFixed(2);
  };

  const handlePostToNostr = async (run) => {
    if (!window.nostr) {
      const confirmLogin = window.confirm('Please login with Nostr to share your run');
      if (confirmLogin) {
        navigate('/login');
      }
      return;
    }

    try {
      const content = `
🏃‍♂️ Run Completed!
⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${run.distance.toFixed(2)} km
⚡️ Pace: ${run.duration > 0 ? ((run.duration / 60) / run.distance).toFixed(2) : '0'} min/km

#Runstr #Running
`;

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'Runstr'], ['t', 'Running']],
        content: content,
      };

      await publishToNostr(event);
      alert('Successfully posted to Nostr!');
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      alert('Failed to post to Nostr. Please try again.');
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
      
      <div className="time-display">
        {formatTime(time)}
      </div>

      <div className="controls-top">
        {!isRunning ? (
          <button className="primary-btn" onClick={startRun}>Start Run</button>
        ) : (
          <>
            {isPaused ? (
              <button className="primary-btn" onClick={resumeRun}>Resume</button>
            ) : (
              <button className="secondary-btn" onClick={pauseRun}>Pause</button>
            )}
            <button className="danger-btn" onClick={stopRun}>End Run</button>
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

      <div className="distance-input">
        <input
          type="number"
          value={displayDistance(distance)}
          onChange={handleDistanceChange}
          placeholder={`Distance (${distanceUnit})`}
          step="0.01"
        />
      </div>

      {lastRun && (
        <div className="last-run">
          <h3>Previous Run</h3>
          <div className="last-run-details">
            <span>Date: {lastRun.date}</span>
            <span>Duration: {formatTime(lastRun.duration)}</span>
            <span>Distance: {displayDistance(lastRun.distance)} {distanceUnit}</span>
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
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Run History</h2>
            <div className="history-list">
              {runHistory.map((run) => (
                <div key={run.id} className="history-item">
                  <div className="run-date">{run.date}</div>
                  <div className="run-details">
                    <span>Duration: {formatTime(run.duration)}</span>
                    <span>Distance: {displayDistance(run.distance)} {distanceUnit}</span>
                    <span>
                      Pace: {run.duration > 0 ? 
                        ((run.duration / 60) / run.distance).toFixed(2) : '0'
                      } min/km
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button 
              className="close-modal-btn"
              onClick={() => setShowHistoryModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 