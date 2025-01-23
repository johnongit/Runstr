import { useState, useEffect, useCallback } from 'react';
import { calculateStats } from '../utils/runCalculations';

export const useLocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    pace: 0,
    splits: []
  });

  // Update stats whenever positions change
  useEffect(() => {
    if (positions.length > 0) {
      const newStats = calculateStats(positions);
      setStats(newStats);
    }
  }, [positions]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setPositions([]);
    setError(null);

    // Request wake lock to prevent device sleep
    try {
      navigator.wakeLock?.request('screen');
    } catch (err) {
      console.warn('Wake Lock not available:', err);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation(position);
        setPositions(prev => [...prev, position]);
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
  }, [options]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  return {
    location,
    error,
    isTracking,
    positions,
    stats,
    startTracking,
    stopTracking
  };
}; 