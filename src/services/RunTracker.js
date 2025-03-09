import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

class RunTracker extends EventEmitter {
  constructor() {
    super();

    this.distance = 0; // in meters
    this.duration = 0; // in seconds
    this.pace = 0; // in seconds per meter
    this.splits = []; // Array to store split objects { km, time, pace }
    this.positions = [];

    this.isTracking = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pausedTime = 0; // Total time paused in milliseconds
    this.lastPauseTime = 0; // Timestamp when the run was last paused
    this.lastSplitDistance = 0; // Track last split milestone

    this.watchId = null; // For geolocation watch id
    this.timerInterval = null; // For updating duration every second
    this.paceInterval = null; // For calculating pace at regular intervals
  }

  toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1); // Difference in latitude converted to radians
    const dLon = this.toRadians(lon2 - lon1); // Difference in longitude converted to radians

    // Calculate the square of half the chord length between the points
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    // Calculate the angular distance in radians using the arctan function
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Multiply by Earth's radius to get the distance in meters.
    return R * c; // Distance in meters
  }

  calculatePace(distance, duration) {
    if (distance === 0) return 0;
    return duration / distance; // Pace in seconds per meter
  }

  addPosition(newPosition) {
    if (this.positions.length > 0) {
      const lastPosition = this.positions[this.positions.length - 1];
      const distanceIncrement = this.calculateDistance(
        lastPosition.latitude,
        lastPosition.longitude,
        newPosition.latitude,
        newPosition.longitude
      );
      this.distance += distanceIncrement;

      this.emit('distanceChange', this.distance); // Emit distance change

      // Check if a new full kilometer has been completed
      if (
        Math.floor(this.distance / 1000) >
        Math.floor(this.lastSplitDistance / 1000)
      ) {
        // Calculate the current km split (e.g., 1, 2, 3, ...)
        const currentKm = Math.floor(this.distance / 1000);

        // Determine the elapsed time at the previous split (or 0 at start)
        const previousSplitTime = this.splits.length
          ? this.splits[this.splits.length - 1].time
          : 0;
        // Calculate the duration for this split (time difference)
        const splitDuration = this.duration - previousSplitTime;
        // For a full km, the split pace is simply the split duration divided by 1000 meters
        const splitPace = this.calculatePace(1000, splitDuration); // seconds per km

        // Record the split with the km count, cumulative time, and split pace
        this.splits.push({
          km: currentKm,
          time: this.duration,
          pace: splitPace
        });
        // Update lastSplitDistance to the current total distance
        this.lastSplitDistance = this.distance;

        // Emit an event with updated splits array
        this.emit('splitRecorded', this.splits);
      }
    }

    this.positions.push(newPosition);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        const now = Date.now();
        this.duration = (now - this.startTime - this.pausedTime) / 1000; // Subtract paused time
        this.emit('durationChange', this.duration); // Emit duration change
      }
    }, 1000); // Update every second
  }

  startPaceCalculator() {
    this.paceInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        this.pace = this.calculatePace(this.distance, this.duration);
        this.emit('paceChange', this.pace); // Emit pace change
      }
    }, 5000); // Update pace every 5 seconds
  }

  async startTracking() {
    try {
      this.watchId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking your run...',
          backgroundTitle: 'Runstr',
          requestPermissions: true,
          distanceFilter: 10
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              if (
                window.confirm(
                  'This app needs your location, ' +
                    'but does not have permission.\n\n' +
                    'Open settings now?'
                )
              ) {
                BackgroundGeolocation.openSettings();
              }
            }
            return console.error(error);
          }

          this.addPosition(location);
        }
      );
    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }

  async start() {
    if (this.isTracking && !this.isPaused) return;

    this.isTracking = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedTime = 0; // Reset paused time
    this.positions = [];
    this.distance = 0;
    this.duration = 0;
    this.pace = 0;
    this.splits = [];
    this.lastSplitDistance = 0;

    this.startTracking();
    this.startTimer(); // Start the timer
    this.startPaceCalculator(); // Start the pace calculator
  }

  async pause() {
    if (!this.isTracking || this.isPaused) return;

    this.isPaused = true;
    this.lastPauseTime = Date.now(); // Record the time when paused
    BackgroundGeolocation.removeWatcher({
      id: this.watchId
    });

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator
  }

  async resume() {
    if (!this.isTracking || !this.isPaused) return;

    this.isPaused = false;
    this.pausedTime += Date.now() - this.lastPauseTime; // Add the time spent paused
    this.startTracking();
    this.startTimer(); // Restart the timer
    this.startPaceCalculator(); // Restart the pace calculator
  }

  stop() {
    if (!this.isTracking) return;

    this.isTracking = false;
    BackgroundGeolocation.removeWatcher({
      id: this.watchId
    });

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator

    // If there's an incomplete split (current split distance > 0), calculate its pace.
    const incompleteSplitDistance = this.distance - this.lastSplitDistance;
    if (incompleteSplitDistance > 0) {
      const lastSplitTime = this.splits.length
        ? this.splits[this.splits.length - 1].time
        : 0;
      const incompleteSplitTime = this.duration - lastSplitTime;
      const incompleteSplitPace = this.calculatePace(
        incompleteSplitDistance,
        incompleteSplitTime
      );

      const currentKm = Math.ceil(this.distance / 1000);

      this.splits.push({
        km: currentKm,
        time: this.duration,
        pace: incompleteSplitPace
      });
    }

    // Emit final values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('stopped', {
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: this.splits
    });
  }
}

export const runTracker = new RunTracker();
