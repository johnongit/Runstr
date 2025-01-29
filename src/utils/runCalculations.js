// Constants for accuracy thresholds
const MINIMUM_ACCURACY = 30; // meters - increased to be less strict
const SPEED_THRESHOLD = 15; // meters/second (~54 km/h) - increased to allow sprints
const MINIMUM_DISTANCE = 0.1; // meters - minimum distance between points
const PACE_WINDOW = 30; // Calculate pace over the last 30 seconds - reduced for more sensitivity
const ELEVATION_SMOOTHING = 3; // Reduced for more responsive elevation changes

/**
 * Calculate a moving average for elevation data
 */
function smoothElevation(positions, windowSize = ELEVATION_SMOOTHING) {
  if (positions.length < windowSize) return null;
  
  const recentPositions = positions.slice(-windowSize);
  const validElevations = recentPositions
    .map(pos => pos.coords.altitude)
    .filter(alt => alt !== null && !isNaN(alt));
    
  if (validElevations.length < windowSize / 2) return null;
  
  return validElevations.reduce((sum, alt) => sum + alt, 0) / validElevations.length;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Filter location data for accuracy
 */
export function filterLocation(location, lastLocation) {
  // Check for minimum accuracy
  if (location.coords.accuracy > MINIMUM_ACCURACY) {
    return false;
  }

  if (!lastLocation) {
    return true;
  }

  // Calculate speed between points
  const distance = calculateDistance(
    lastLocation.coords.latitude,
    lastLocation.coords.longitude,
    location.coords.latitude,
    location.coords.longitude
  );
  const timeDiff = (location.timestamp - lastLocation.timestamp) / 1000;
  
  // Don't filter out very small time differences
  if (timeDiff <= 0) {
    return false;
  }
  
  const speed = distance / timeDiff;

  // Filter out only clearly unrealistic speeds
  if (speed > SPEED_THRESHOLD) {
    return false;
  }

  // Allow closer points for better accuracy
  if (distance < MINIMUM_DISTANCE) { // Only filter extremely close points
    return false;
  }

  return true;
}

/**
 * Calculate current pace in minutes per kilometer
 * More sensitive to variations
 */
export function calculatePace(distance, duration, positions = []) {
  if (distance <= 0 || duration <= 0) return 0;

  // If we have positions, calculate pace over recent window
  if (positions.length > 1) {
    const now = positions[positions.length - 1].timestamp;
    const windowStart = now - (PACE_WINDOW * 1000);
    
    // Find positions within our window
    const recentPositions = positions.filter(pos => pos.timestamp >= windowStart);
    
    if (recentPositions.length > 1) {
      let recentDistance = 0;
      let lastValidPosition = null;
      
      // Calculate distance in the recent window
      for (const position of recentPositions) {
        if (lastValidPosition) {
          const segmentDistance = calculateDistance(
            lastValidPosition.coords.latitude,
            lastValidPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude
          );
          
          const timeDiff = (position.timestamp - lastValidPosition.timestamp) / 1000;
          if (timeDiff > 0) {
            recentDistance += segmentDistance;
          }
        }
        lastValidPosition = position;
      }
      
      const recentDuration = (recentPositions[recentPositions.length - 1].timestamp - 
                            recentPositions[0].timestamp) / 1000;
      
      if (recentDuration > 0 && recentDistance > 0) {
        // Convert to minutes per kilometer
        const speedKmH = (recentDistance / 1000) / (recentDuration / 3600);
        return speedKmH > 0 ? 60 / speedKmH : 0;
      }
    }
  }
  
  // Fallback to overall pace
  const speedKmH = (distance / 1000) / (duration / 3600);
  return speedKmH > 0 ? 60 / speedKmH : 0;
}

/**
 * Calculate split times for each kilometer
 */
export function calculateSplits(positions) {
  if (!positions.length) return [];
  
  const splits = [];
  let currentSplit = {
    distance: 0,
    duration: 0,
    startTime: positions[0].timestamp
  };

  for (let i = 1; i < positions.length; i++) {
    const distance = calculateDistance(
      positions[i-1].coords.latitude,
      positions[i-1].coords.longitude,
      positions[i].coords.latitude,
      positions[i].coords.longitude
    );

    currentSplit.distance += distance;
    currentSplit.duration = positions[i].timestamp - currentSplit.startTime;

    // When we reach 1km, record the split
    if (currentSplit.distance >= 1000) {
      splits.push({
        pace: calculatePace(currentSplit.distance, currentSplit.duration),
        duration: currentSplit.duration,
        distance: currentSplit.distance
      });

      currentSplit = {
        distance: currentSplit.distance - 1000,
        duration: 0,
        startTime: positions[i].timestamp
      };
    }
  }

  // Add current incomplete split if we've covered some distance
  if (currentSplit.distance > 0) {
    splits.push({
      pace: calculatePace(currentSplit.distance, currentSplit.duration),
      duration: currentSplit.duration,
      distance: currentSplit.distance,
      incomplete: true
    });
  }

  return splits;
}

/**
 * Calculate workout statistics
 */
export function calculateStats(positions, elapsedTime = null) {
  if (!positions.length) {
    return {
      distance: 0,
      duration: 0,
      pace: 0,
      splits: [],
      positions: [],
      elevation: {
        current: null,
        gain: 0,
        loss: 0
      }
    };
  }

  let totalDistance = 0;
  const filteredPositions = positions.filter((pos, i) => 
    i === 0 || filterLocation(pos, positions[i-1])
  );

  // Calculate total distance with improved accuracy
  let lastValidPosition = null;
  for (const position of filteredPositions) {
    if (lastValidPosition) {
      const distance = calculateDistance(
        lastValidPosition.coords.latitude,
        lastValidPosition.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      );
      
      // Only add reasonable distances
      if (distance > 0 && distance < SPEED_THRESHOLD) {
        totalDistance += distance;
      }
    }
    lastValidPosition = position;
  }

  // Use provided elapsed time if available, otherwise calculate from timestamps
  const duration = elapsedTime !== null ? elapsedTime :
    (filteredPositions[filteredPositions.length - 1].timestamp - 
     filteredPositions[0].timestamp) / 1000;

  // Calculate current elevation (smoothed)
  const currentElevation = smoothElevation(filteredPositions);

  return {
    distance: totalDistance,
    duration: duration,
    pace: calculatePace(totalDistance, duration, filteredPositions),
    splits: calculateSplits(filteredPositions),
    positions: filteredPositions,
    elevation: {
      current: currentElevation,
      gain: 0, // This will be updated by the useLocation hook
      loss: 0  // This will be updated by the useLocation hook
    }
  };
} 