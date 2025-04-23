import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';
import runDataService, { ACTIVITY_TYPES } from './RunDataService';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

class RunTracker extends EventEmitter {
  constructor() {
    super();

    this.distance = 0; // in meters
    this.duration = 0; // in seconds
    this.pace = 0; // in seconds per meter
    this.splits = []; // Array to store split objects { km, time, pace }
    this.splitsKm = []; // Array to store kilometer splits
    this.splitsMi = []; // Array to store mile splits
    this.positions = [];
    
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
    this.lastSplitDistanceKm = 0; // Track last km split milestone
    this.lastSplitDistanceMi = 0; // Track last mile split milestone
    this.activityType = localStorage.getItem('activityMode') || ACTIVITY_TYPES.RUN; // Get current activity type

    this.watchId = null; // For geolocation watch id
    this.timerInterval = null; // For updating duration every second
    this.paceInterval = null; // For calculating pace at regular intervals
  }

  // Helper method to get the current distance unit from localStorage
  getDistanceUnit() {
    return localStorage.getItem('distanceUnit') || 'km';
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
    // Use the centralized pace calculation method
    return runDataService.calculatePace(distance, duration, this.getDistanceUnit());
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
    // Only process position updates if actively tracking (not paused and tracking is on)
    if (!this.isTracking || this.isPaused) {
      // Don't process position updates when not actively tracking
      return;
    }
    
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
      const MOVEMENT_THRESHOLD = 1.5; // 1.5 meters (reduced from 3m)
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

      // Process split updates for both units using the new handleSplit method
      this.handleSplit(distanceIncrement);
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
      
      // First, ensure any existing watchers are cleaned up
      await this.cleanupWatchers();
      
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

  async cleanupWatchers() {
    try {
      // If we have an existing watchId, clean it up
      if (this.watchId) {
        await BackgroundGeolocation.removeWatcher({
          id: this.watchId
        });
        this.watchId = null;
      }
    } catch (error) {
      console.error('Error cleaning up watchers:', error);
    }
  }

  async start() {
    if (this.isTracking && !this.isPaused) return;
    
    // Update activityType from localStorage in case it changed
    this.activityType = localStorage.getItem('activityMode') || ACTIVITY_TYPES.RUN;
    
    this.isTracking = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedTime = 0; // Reset paused time
    this.positions = [];
    this.distance = 0;
    this.duration = 0;
    this.pace = 0;
    this.splits = [];
    this.splitsKm = [];
    this.splitsMi = [];
    this.lastSplitDistance = 0;
    this.lastSplitDistanceKm = 0;
    this.lastSplitDistanceMi = 0;
    
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
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async pause() {
    if (!this.isTracking || this.isPaused) return;

    this.isPaused = true;
    this.lastPauseTime = Date.now(); // Record the time when paused
    
    // Use our centralized method to clean up watchers
    await this.cleanupWatchers();

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async resume() {
    if (!this.isTracking || !this.isPaused) return;

    this.isPaused = false;
    this.pausedTime += Date.now() - this.lastPauseTime; // Add the time spent paused
    this.startTracking();
    this.startTimer(); // Restart the timer
    this.startPaceCalculator(); // Restart the pace calculator
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async stop() {
    if (!this.isTracking) return;

    this.isTracking = false;
    this.isPaused = false;
    
    // Final calculations
    this.duration = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
    
    // Calculate speed and pace one last time
    if (this.distance > 0 && this.duration > 0) {
      this.pace = runDataService.calculatePace(this.distance, this.duration, this.getDistanceUnit());
    }
    
    // Create the final run data object
    const finalResults = {
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: this.splits, // For backward compatibility
      splitsKm: this.splitsKm,
      splitsMi: this.splitsMi,
      elevation: { 
        gain: this.elevation.gain,
        loss: this.elevation.loss
      },
      unit: this.getDistanceUnit(),
      activityType: this.activityType
    };
    
    // Save to run history using RunDataService instead of directly to localStorage
    runDataService.saveRun(finalResults);
    
    // Clean up resources
    this.stopTracking();
    this.stopTimer();
    this.stopPaceCalculator();
    
    // Emit status change and completed event
    this.emit('statusChange', { isTracking: false, isPaused: false });
    this.emit('runCompleted', finalResults);
    
    return finalResults;
  }

  // Restore an active tracking session that was not paused
  restoreTracking(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.splitsKm = savedState.splitsKm ? [...savedState.splitsKm] : [...savedState.splits];
    this.splitsMi = savedState.splitsMi ? [...savedState.splitsMi] : [];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    this.activityType = savedState.activityType || ACTIVITY_TYPES.RUN; // Add activity type or default
    
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
    
    // Initialize last split distances
    if (this.splitsKm.length > 0) {
      const lastKmSplit = this.splitsKm[this.splitsKm.length - 1];
      this.lastSplitDistanceKm = lastKmSplit.km * 1000;
    }
    
    if (this.splitsMi.length > 0) {
      const lastMiSplit = this.splitsMi[this.splitsMi.length - 1];
      this.lastSplitDistanceMi = lastMiSplit.km * 1609.344;
    }
    
    // For backward compatibility
    if (this.splits.length > 0) {
      const lastSplit = this.splits[this.splits.length - 1];
      const distanceUnit = savedState.unit || this.getDistanceUnit();
      this.lastSplitDistance = lastSplit.km * (distanceUnit === 'km' ? 1000 : 1609.344);
    }
    
    // Start the tracking services
    this.startTracking();
    this.startTimer();
    this.startPaceCalculator();
    
    // Emit updated values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('splitRecordedKm', this.splitsKm);
    this.emit('splitRecordedMi', this.splitsMi);
    this.emit('elevationChange', {...this.elevation});
  }
  
  // Restore an active tracking session that was paused
  restoreTrackingPaused(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.splitsKm = savedState.splitsKm ? [...savedState.splitsKm] : [...savedState.splits];
    this.splitsMi = savedState.splitsMi ? [...savedState.splitsMi] : [];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    this.activityType = savedState.activityType || ACTIVITY_TYPES.RUN; // Add activity type or default
    
    // Initialize last split distances
    if (this.splitsKm.length > 0) {
      const lastKmSplit = this.splitsKm[this.splitsKm.length - 1];
      this.lastSplitDistanceKm = lastKmSplit.km * 1000;
    }
    
    if (this.splitsMi.length > 0) {
      const lastMiSplit = this.splitsMi[this.splitsMi.length - 1];
      this.lastSplitDistanceMi = lastMiSplit.km * 1609.344;
    }
    
    // For backward compatibility
    if (this.splits.length > 0) {
      const lastSplit = this.splits[this.splits.length - 1];
      const distanceUnit = savedState.unit || this.getDistanceUnit();
      this.lastSplitDistance = lastSplit.km * (distanceUnit === 'km' ? 1000 : 1609.344);
    }
    
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
    this.emit('splitRecordedKm', this.splitsKm);
    this.emit('splitRecordedMi', this.splitsMi);
    this.emit('elevationChange', {...this.elevation});
  }

  // Make sure the off method is properly documented
  // This is inherited from EventEmitter but we'll add a simple wrapper
  // for clarity and to ensure it's not overridden
  off(event, callback) {
    return super.off(event, callback);
  }

  // New method to handle splits for both km and miles
  handleSplit(distanceIncrement) {
    // Handle kilometer splits
    const distanceUnitKm = 1000; // 1km in meters
    const currentDistanceInKm = this.distance / 1000;
    const lastSplitDistanceInKm = this.lastSplitDistanceKm / 1000;
    
    if (Math.floor(currentDistanceInKm) > Math.floor(lastSplitDistanceInKm)) {
      const currentSplitNumber = Math.floor(currentDistanceInKm);
      const previousSplitTime = this.splitsKm.length
        ? this.splitsKm[this.splitsKm.length - 1].time
        : 0;
      const splitDuration = this.duration - previousSplitTime;
      const splitPace = splitDuration / distanceUnitKm; 
      
      this.splitsKm.push({
        km: currentSplitNumber,
        time: this.duration,
        pace: splitPace,
        isPartial: false
      });
      
      this.lastSplitDistanceKm = currentSplitNumber * distanceUnitKm;
      this.emit('splitRecordedKm', this.splitsKm);
    }
    
    // Handle mile splits
    const distanceUnitMi = 1609.344; // 1mi in meters
    const currentDistanceInMi = this.distance / 1609.344;
    const lastSplitDistanceInMi = this.lastSplitDistanceMi / 1609.344;
    
    if (Math.floor(currentDistanceInMi) > Math.floor(lastSplitDistanceInMi)) {
      const currentSplitNumber = Math.floor(currentDistanceInMi);
      const previousSplitTime = this.splitsMi.length
        ? this.splitsMi[this.splitsMi.length - 1].time
        : 0;
      const splitDuration = this.duration - previousSplitTime;
      const splitPace = splitDuration / distanceUnitMi; 
      
      this.splitsMi.push({
        km: currentSplitNumber, // keep km field name for compatibility
        time: this.duration,
        pace: splitPace,
        isPartial: false
      });
      
      this.lastSplitDistanceMi = currentSplitNumber * distanceUnitMi;
      this.emit('splitRecordedMi', this.splitsMi);
    }
    
    // For backward compatibility - update the unified splits array based on current unit
    const distanceUnit = this.getDistanceUnit();
    this.splits = distanceUnit === 'km' ? [...this.splitsKm] : [...this.splitsMi];
    this.emit('splitRecorded', this.splits);
  }
}

// Create and export an instance of the tracker
export const runTracker = new RunTracker();

// Also export the class for type checking and testing
export default RunTracker;
