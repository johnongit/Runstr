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
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km'; // Get user's preferred unit
    
    // Add elevation tracking data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

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

  updateElevation(altitude) {
    if (altitude === null || altitude === undefined || isNaN(altitude)) {
      return;
    }
    
    // Set current elevation
    this.elevation.current = altitude;
    
    // Calculate gain and loss if we have a previous altitude reading
    if (this.elevation.lastAltitude !== null) {
      const diff = altitude - this.elevation.lastAltitude;
      
      // Filter out small fluctuations (less than 1 meter)
      if (Math.abs(diff) >= 1) {
        if (diff > 0) {
          this.elevation.gain += diff;
        } else {
          this.elevation.loss += Math.abs(diff);
        }
      }
    }
    
    this.elevation.lastAltitude = altitude;
    
    // Emit elevation change
    this.emit('elevationChange', {...this.elevation});
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
      
      // Add a minimum threshold to filter out GPS noise (e.g., 3 meters)
      // Only count movement if it's above the threshold
      const MOVEMENT_THRESHOLD = 3; // 3 meters
      if (distanceIncrement >= MOVEMENT_THRESHOLD) {
        this.distance += distanceIncrement;
        this.emit('distanceChange', this.distance); // Emit distance change
      } else {
        // GPS noise detected, not adding to distance
        console.log(`Filtered out small movement: ${distanceIncrement.toFixed(2)}m`);
      }

      // Check for altitude data and update elevation
      if (newPosition.altitude !== undefined && newPosition.altitude !== null) {
        this.updateElevation(newPosition.altitude);
      }

      // Define the split distance in meters based on selected unit
      const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
      
      // Check if a new full unit (km or mile) has been completed
      if (
        Math.floor(this.distance / splitDistance) >
        Math.floor(this.lastSplitDistance / splitDistance)
      ) {
        // Calculate the current split number (e.g., 1, 2, 3, ...)
        const currentSplit = Math.floor(this.distance / splitDistance);

        // Determine the elapsed time at the previous split (or 0 at start)
        const previousSplitTime = this.splits.length
          ? this.splits[this.splits.length - 1].time
          : 0;
        // Calculate the duration for this split (time difference)
        const splitDuration = this.duration - previousSplitTime;
        // Calculate pace for this split
        const splitPace = this.calculatePace(splitDistance, splitDuration); // seconds per unit

        // Record the split with the unit count, cumulative time, and split pace
        this.splits.push({
          km: currentSplit, // We keep the field name as 'km' for backward compatibility
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
      // We should have already requested permissions by this point
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (!permissionsGranted) {
        console.warn('Attempting to start tracking without permissions. This should not happen.');
        return;
      }
      
      this.watchId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking your run...',
          backgroundTitle: 'Runstr',
          // Never request permissions here - we've already done it in the permission dialog
          requestPermissions: false, 
          distanceFilter: 10,
          // Add high accuracy mode for better GPS precision
          highAccuracy: true,
          // Increase stale location threshold to get fresher GPS data
          staleLocationThreshold: 30000 // 30 seconds
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              // Permissions were revoked after being initially granted
              localStorage.setItem('permissionsGranted', 'false');
              alert('Location permission is required for tracking. Please enable it in your device settings.');
              BackgroundGeolocation.openSettings();
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

    // Update distanceUnit from localStorage in case it changed
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km';
    
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
    
    // Reset elevation data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

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

    // Stop tracking location
    if (BackgroundGeolocation) {
      BackgroundGeolocation.stopTracking();
    } else if (navigator && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    // Stop timers
    clearInterval(this.timerInterval);
    clearInterval(this.paceInterval);

    // Define the split distance based on selected unit
    const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
    
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

      const currentSplit = Math.ceil(this.distance / splitDistance);

      this.splits.push({
        km: currentSplit,
        time: this.duration,
        pace: incompleteSplitPace
      });
    }

    // Reset state
    this.isTracking = false;
    this.isPaused = false;

    // Emit final results
    const finalResults = {
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: [...this.splits],
      elevation: {
        gain: this.elevation.gain,
        loss: this.elevation.loss
      }
    };

    this.emit('stopped', finalResults);

    // Dispatch a global event to ensure UI components update
    // This helps ensure consistency across the app
    try {
      const runCompletedEvent = new CustomEvent('runCompleted', {
        detail: { finalResults }
      });
      document.dispatchEvent(runCompletedEvent);
    } catch (error) {
      console.error('Error dispatching runCompleted event:', error);
    }

    // Reset tracked values
    this.distance = 0;
    this.duration = 0;
    this.pace = 0;
    this.splits = [];
    this.positions = [];
    this.startTime = 0;
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    this.lastSplitDistance = 0;
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };
  }

  // Restore an active tracking session that was not paused
  restoreTracking(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    
    // Calculate time difference since the run was saved
    const timeDifference = (new Date().getTime() - savedState.timestamp) / 1000;
    
    // Update duration with elapsed time
    this.duration += timeDifference;
    
    // Set tracking state
    this.isTracking = true;
    this.isPaused = false;
    
    // Set start time to account for elapsed duration
    this.startTime = Date.now() - (this.duration * 1000);
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    
    // Start the tracking services
    this.startTracking();
    this.startTimer();
    this.startPaceCalculator();
    
    // Emit updated values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('elevationChange', {...this.elevation});
  }
  
  // Restore an active tracking session that was paused
  restoreTrackingPaused(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    
    // Set tracking state
    this.isTracking = true;
    this.isPaused = true;
    
    // Set start time and pause time
    this.startTime = Date.now() - (this.duration * 1000);
    this.pausedTime = 0;
    this.lastPauseTime = Date.now();
    
    // Emit updated values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('elevationChange', {...this.elevation});
  }
}

export const runTracker = new RunTracker();
