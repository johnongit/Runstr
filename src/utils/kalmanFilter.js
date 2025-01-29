/**
 * Simple Kalman filter implementation for GPS tracking
 * This helps smooth out GPS readings and reduce noise
 */
export class KalmanFilter {
  constructor() {
    // State estimate
    this.lat = 0;
    this.lng = 0;
    this.variance = 100; // Initial estimate of position variance

    // Kalman filter parameters - adjusted for less smoothing
    this.Q = 0.00001; // Increased process noise to allow more movement
    this.R = 0.5; // Reduced measurement noise to trust GPS more
  }

  /**
   * Update the filter with a new measurement
   */
  update(lat, lng, accuracy) {
    // Skip update if this is the first measurement
    if (this.lat === 0 && this.lng === 0) {
      this.lat = lat;
      this.lng = lng;
      this.variance = accuracy * accuracy; // Convert accuracy to variance
      return { lat, lng };
    }

    // Predict step
    // (In this simple model, we assume the position stays the same)
    this.variance += this.Q;

    // Measurement noise based on GPS accuracy
    const R = accuracy * accuracy;

    // Update step
    const K = this.variance / (this.variance + R); // Kalman gain

    // Update state estimate
    this.lat += K * (lat - this.lat);
    this.lng += K * (lng - this.lng);

    // Update error covariance
    this.variance = (1 - K) * this.variance;

    return {
      lat: this.lat,
      lng: this.lng,
      accuracy: Math.sqrt(this.variance)
    };
  }

  /**
   * Reset the filter
   */
  reset() {
    this.lat = 0;
    this.lng = 0;
    this.variance = 100;
  }
} 