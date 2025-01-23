// Constants for accuracy thresholds
const MINIMUM_ACCURACY = 20; // meters
const SPEED_THRESHOLD = 12.5; // meters/second (~45 km/h)
const DISTANCE_FILTER = 10; // meters

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
 */
export function calculatePace(distance, duration) {
  if (distance <= 0 || duration <= 0) return 0;
  const speedKmH = (distance / 1000) / (duration / 3600);
  return speedKmH > 0 ? 60 / speedKmH : 0;
}

/**
 * Calculate split times for each kilometer
 */
export function calculateSplits(positions) {
  const splits = [];
  let currentSplit = {
    distance: 0,
    duration: 0,
    startTime: positions[0]?.timestamp || 0
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

  return splits;
}

/**
 * Calculate workout statistics
 */
export function calculateStats(positions) {
  if (!positions.length) {
    return {
      distance: 0,
      duration: 0,
      pace: 0,
      splits: []
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

  const duration = (filteredPositions[filteredPositions.length - 1].timestamp - 
                   filteredPositions[0].timestamp) / 1000;

  return {
    distance: totalDistance,
    duration: duration,
    pace: calculatePace(totalDistance, duration),
    splits: calculateSplits(filteredPositions)
  };
} 