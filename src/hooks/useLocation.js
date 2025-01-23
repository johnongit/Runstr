import { useState, useEffect, useCallback } from 'react';
import { calculateStats } from '../utils/runCalculations';

export const useLocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    pace: 0,
    splits: []
  });
  const [startTime, setStartTime] = useState(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [lastPauseTime, setLastPauseTime] = useState(null);

  // Update stats whenever positions change or pause state changes
  useEffect(() => {
    if (positions.length > 0 && startTime) {
      const currentTime = Date.now();
      const totalPausedTime = pausedDuration + (lastPauseTime ? currentTime - lastPauseTime : 0);
      const effectiveDuration = (currentTime - startTime - totalPausedTime) / 1000;
      
      const newStats = calculateStats(positions);
      setStats({
        ...newStats,
        duration: effectiveDuration
      });
    }
  }, [positions, isPaused, startTime, pausedDuration, lastPauseTime]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setIsPaused(false);
    setPositions([]);
    setError(null);
    setStartTime(Date.now());
    setPausedDuration(0);
    setLastPauseTime(null);

    // Request wake lock to prevent device sleep
    try {
      navigator.wakeLock?.request('screen');
    } catch (err) {
      console.warn('Wake Lock not available:', err);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isPaused) {
          setLocation(position);
          setPositions(prev => [...prev, position]);
        }
      },
      (error) => {
        setError(error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
        ...options
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [options, isPaused]);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
    setLastPauseTime(Date.now());
  }, []);

  const resumeTracking = useCallback(() => {
    if (lastPauseTime) {
      setPausedDuration(prev => prev + (Date.now() - lastPauseTime));
    }
    setLastPauseTime(null);
    setIsPaused(false);
  }, [lastPauseTime]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setIsPaused(false);
    if (lastPauseTime) {
      setPausedDuration(prev => prev + (Date.now() - lastPauseTime));
    }
  }, [lastPauseTime]);

  return {
    location,
    error,
    isTracking,
    isPaused,
    positions,
    stats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking
  };
}; 