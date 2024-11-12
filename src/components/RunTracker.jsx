import { useState, useEffect } from 'react';

export const RunTracker = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [runHistory, setRunHistory] = useState([]);

  useEffect(() => {
    let interval;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

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
    setDistance(value);
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
    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    setDistance(0);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="run-tracker">
      <div className="time-display">{formatTime(time)}</div>
      <div className="distance-input">
        <label htmlFor="distance">Distance (km): </label>
        <input
          type="number"
          id="distance"
          value={distance}
          onChange={handleDistanceChange}
          step="0.1"
          min="0"
          disabled={!isRunning}
        />
      </div>
      <div className="controls">
        {!isRunning && <button onClick={startRun}>Start Run</button>}
        {isRunning && !isPaused && <button onClick={pauseRun}>Pause</button>}
        {isRunning && isPaused && <button onClick={resumeRun}>Resume</button>}
        {isRunning && <button onClick={stopRun}>Stop</button>}
      </div>
    </div>
  );
} 