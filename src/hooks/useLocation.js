import { useState, useEffect, useCallback } from 'react';

export const useLocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [positions, setPositions] = useState([]);

  // Listen for location updates from service worker
  useEffect(() => {
    const handleLocationUpdate = (event) => {
      if (event.data.type === 'LOCATION_UPDATE') {
        setLocation(event.data.position);
        setPositions(prev => [...prev, event.data.position]);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleLocationUpdate);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleLocationUpdate);
    };
  }, []);

  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  const calculateTotalDistance = useCallback(() => {
    let total = 0;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      total += calculateDistance(
        prev.coords.latitude,
        prev.coords.longitude,
        curr.coords.latitude,
        curr.coords.longitude
      );
    }
    return total;
  }, [positions, calculateDistance]);

  const startTracking = useCallback(() => {
    if (!navigator.serviceWorker?.controller) {
      setError('Service Worker not available');
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

    // Start background tracking via service worker
    navigator.serviceWorker.controller.postMessage({
      type: 'START_TRACKING',
      options: options
    });

    // Register for background sync
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('syncLocation').catch(err => {
        console.warn('Background sync registration failed:', err);
      });
    });
  }, [options]);

  const stopTracking = useCallback(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_TRACKING'
      });
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [isTracking, stopTracking]);

  return {
    location,
    error,
    isTracking,
    positions,
    totalDistance: calculateTotalDistance(),
    startTracking,
    stopTracking
  };
}; 