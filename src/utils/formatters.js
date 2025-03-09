/**
 * Formats a given number of seconds into a string in HH:MM:SS format.
 *
 * @param {number} seconds - The total number of seconds to format.
 * @returns {string} The formatted time string.
 */
export function formatTime(seconds) {
  // Ensure we have a positive integer value of seconds
  const totalSeconds = Math.max(0, Math.floor(seconds));

  // Calculate the number of hours
  const hours = Math.floor(totalSeconds / 3600);

  // Calculate the number of minutes from the remaining seconds after hours are accounted for
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  // The remaining seconds after removing hours and minutes
  const remainingSeconds = totalSeconds % 60;

  // Format hours, minutes, and seconds to always have at least two digits (with leading zeros if needed)
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

  // Return the formatted time string in the format HH:MM:SS
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Convert a distance in meters to kilometers or miles.
 *
 * @param {number} meters - The distance in meters.
 * @param {string} unit - The unit to convert to ("km" or "mi").
 * @returns {number} The converted distance.
 */
export function convertDistance(meters, unit) {
  if (typeof meters !== 'number' || meters < 0) {
    throw new Error('Please provide a valid distance in meters.');
  }

  switch (unit.toLowerCase()) {
    case 'km':
      return (meters / 1000).toFixed(2);
    case 'mi':
      // 1 mile = 1609.344 meters
      return (meters / 1609.344).toFixed(2);
    default:
      throw new Error('Invalid unit. Please use "km" or "miles".');
  }
}

/**
 * Converts a pace from seconds per meter to a human-readable pace format (minutes per kilometer).
 *
 * @param {number} pace - The pace in seconds per meter.
 * @returns {string} A formatted pace string in "MM:SS" per kilometer format.
 */
export function formatPace(pace) {
  // Handle invalid or non-positive pace values
  if (!pace || pace <= 0) return '--:--';

  // Convert the pace from seconds per meter to seconds per kilometer
  const secondsPerKm = pace * 1000;

  // Extract the number of whole minutes from the total seconds
  const minutes = Math.floor(secondsPerKm / 60);

  // Get the remaining seconds after extracting the minutes
  const seconds = Math.round(secondsPerKm % 60);

  // Format the output as "MM:SS", ensuring two-digit seconds
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
