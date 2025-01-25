// Constants for accuracy thresholds
const MINIMUM_ACCURACY = 20; // meters
const SPEED_THRESHOLD = 12.5; // meters/second (~45 km/h)
const DISTANCE_FILTER = 10; // meters
const PACE_WINDOW = 60; // Calculate pace over the last 60 seconds

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
  const speed = distance / timeDiff;

  // Filter out unrealistic speeds
  if (speed > SPEED_THRESHOLD) {
    return false;
  }

  // Filter out points that are too close
  if (distance < DISTANCE_FILTER) {
    return false;
  }

  return true;
}

/**
 * Calculate current pace in minutes per kilometer
 * Uses a moving window to smooth out fluctuations
 */
export function calculatePace(distance, duration, positions = []) {
  if (distance <= 0 || duration <= 0) return 0;

  // If we have positions, calculate pace over recent window
  if (positions.length > 1) {
    const now = positions[positions.length - 1].timestamp;
    const windowStart = now - (PACE_WINDOW * 1000); // Look at last PACE_WINDOW seconds
    
    // Find positions within our window
    const recentPositions = positions.filter(pos => pos.timestamp >= windowStart);
    
    if (recentPositions.length > 1) {
      let recentDistance = 0;
      
      // Calculate distance in the recent window
      for (let i = 1; i < recentPositions.length; i++) {
        const segmentDistance = calculateDistance(
          recentPositions[i-1].coords.latitude,
          recentPositions[i-1].coords.longitude,
          recentPositions[i].coords.latitude,
          recentPositions[i].coords.longitude
        );
        
        // Only include reasonable distances
        if (segmentDistance > 0 && segmentDistance < SPEED_THRESHOLD) {
          recentDistance += segmentDistance;
        }
      }
      
      const recentDuration = (recentPositions[recentPositions.length - 1].timestamp - 
                            recentPositions[0].timestamp) / 1000;
      
      if (recentDuration > 0 && recentDistance > 0) {
        // Convert to minutes per kilometer
        const speedKmH = (recentDistance / 1000) / (recentDuration / 3600);
        const pace = speedKmH > 0 ? 60 / speedKmH : 0;
        
        // Return reasonable pace or fallback to overall pace
        if (pace > 0 && pace < 30) { // Paces between 0 and 30 min/km
          return pace;
        }
      }
    }
  }
  
  // Fallback to overall pace if we can't calculate recent pace
  const speedKmH = (distance / 1000) / (duration / 3600);
  const overallPace = speedKmH > 0 ? 60 / speedKmH : 0;
  
  // Only return reasonable paces
  return overallPace > 0 && overallPace < 30 ? overallPace : 0;
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
 * @param {Array} positions - Array of GPS positions
 * @param {number} elapsedTime - Actual elapsed time in seconds (excluding pauses)
 */
export function calculateStats(positions, elapsedTime = null) {
  if (!positions.length) {
    return {
      distance: 0,
      duration: 0,
      pace: 0,
      splits: [],
      positions: []
    };
  }

  let totalDistance = 0;
  const filteredPositions = positions.filter((pos, i) => 
    i === 0 || filterLocation(pos, positions[i-1])
  );

  // Calculate total distance
  for (let i = 1; i < filteredPositions.length; i++) {
    totalDistance += calculateDistance(
      filteredPositions[i-1].coords.latitude,
      filteredPositions[i-1].coords.longitude,
      filteredPositions[i].coords.latitude,
      filteredPositions[i].coords.longitude
    );
  }

  // Use provided elapsed time if available, otherwise calculate from timestamps
  const duration = elapsedTime !== null ? elapsedTime :
    (filteredPositions[filteredPositions.length - 1].timestamp - 
     filteredPositions[0].timestamp) / 1000;

  return {
    distance: totalDistance,
    duration: duration,
    pace: calculatePace(totalDistance, duration, filteredPositions),
    splits: calculateSplits(filteredPositions),
    positions: filteredPositions
  };
} 