import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateStats, calculateDistance } from '../utils/runCalculations';

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
    splits: [],
    positions: []
  });

  const startTimeRef = useRef(null);
  const pausedDurationRef = useRef(0);
  const lastPauseTimeRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const lastStatsUpdateRef = useRef(0);

  // Update stats with proper timing
  useEffect(() => {
    let intervalId;
    
    if (isTracking && startTimeRef.current) {
      intervalId = setInterval(() => {
        const currentTime = Date.now();
        
        // Only update if we have new data since last update
        if (currentTime - lastStatsUpdateRef.current >= 1000) {
          const totalPausedTime = pausedDurationRef.current + 
            (lastPauseTimeRef.current ? currentTime - lastPauseTimeRef.current : 0);
          const effectiveDuration = (currentTime - startTimeRef.current - totalPausedTime) / 1000;
          
          const newStats = calculateStats(positions, Math.max(0, Math.floor(effectiveDuration)));
          setStats({
            ...newStats,
            duration: Math.max(0, Math.floor(effectiveDuration))
          });
          
          lastStatsUpdateRef.current = currentTime;
        }
      }, 1000); // Update every second
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTracking, isPaused, positions]);

  // Filter and add new positions
  const addPosition = useCallback((position) => {
    if (!lastPositionRef.current) {
      lastPositionRef.current = position;
      setPositions(prev => [...prev, position]);
      return;
    }

    // Calculate time and distance since last position
    const timeDiff = (position.timestamp - lastPositionRef.current.timestamp) / 1000;
    
    // Only process if we have a reasonable time difference (> 0 and < 30 seconds)
    if (timeDiff <= 0 || timeDiff > 30) {
      return;
    }

    const distance = calculateDistance(
      lastPositionRef.current.coords.latitude,
      lastPositionRef.current.coords.longitude,
      position.coords.latitude,
      position.coords.longitude
    );

    // Filter out erroneous readings:
    // 1. Must have moved some distance (> 1 meter)
    // 2. Speed must be reasonable (< 45 km/h or 12.5 m/s)
    // 3. Must have reasonable accuracy (< 20 meters)
    if (distance > 1 && 
        distance < (timeDiff * 12.5) && 
        position.coords.accuracy < 20) {
      lastPositionRef.current = position;
      setPositions(prev => [...prev, position]);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setIsPaused(false);
    setPositions([]);
    setError(null);
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    lastPauseTimeRef.current = null;
    lastPositionRef.current = null;
    lastStatsUpdateRef.current = 0;

    // Request wake lock to prevent device sleep
    try {
      navigator.wakeLock?.request('screen');
    } catch (err) {
      console.warn('Wake Lock not available:', err);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isPaused) {
          setLocation(position);
          addPosition({
            ...position,
            timestamp: Date.now() // Use current time instead of GPS time
          });
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
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [options, isPaused, addPosition]);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
    lastPauseTimeRef.current = Date.now();
  }, []);

  const resumeTracking = useCallback(() => {
    if (lastPauseTimeRef.current) {
      pausedDurationRef.current += Date.now() - lastPauseTimeRef.current;
    }
    lastPauseTimeRef.current = null;
    lastPositionRef.current = null; // Reset last position to avoid jumps
    setIsPaused(false);
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (lastPauseTimeRef.current) {
      pausedDurationRef.current += Date.now() - lastPauseTimeRef.current;
    }
    setIsTracking(false);
    setIsPaused(false);
  }, []);

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