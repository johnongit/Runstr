import { Capacitor } from '@capacitor/core';
import { Pedometer as NativePedometer } from './native-pedometer'; // This will be our typed interface

export interface PedometerData {
  count: number;
}

export interface PedometerSensorInfo {
  stepCounterAvailable: boolean;
  stepDetectorAvailable: boolean;
}

class PedometerService {
  private isSupported = false;
  private isListening = false;
  private listeners: Array<(data: PedometerData) => void> = [];

  constructor() {
    if (Capacitor.isNativePlatform()) {
      // Check for plugin availability. 
      // NativePedometer.getSensorInfo() could be used here if we want to know specifics
      // For now, we assume if it's native, the plugin *should* be there.
      // The actual check for sensor availability will happen in the start() method on native side.
      this.isSupported = true; 
    }
  }

  async checkAvailability(): Promise<PedometerSensorInfo> {
    if (!this.isSupported) {
      return { stepCounterAvailable: false, stepDetectorAvailable: false };
    }
    try {
      const info = await NativePedometer.getSensorInfo();
      return info;
    } catch (error) {
      console.error('Error checking pedometer availability:', error);
      return { stepCounterAvailable: false, stepDetectorAvailable: false };
    }
  }

  async start(): Promise<void> {
    if (!this.isSupported) {
      console.warn('Pedometer not supported on this platform.');
      return Promise.reject('Pedometer not supported.');
    }
    if (this.isListening) {
      console.warn('Pedometer already listening.');
      return Promise.resolve();
    }

    try {
      // The native `start` method now handles permission requests.
      await NativePedometer.start();
      NativePedometer.addListener('step', (data: PedometerData) => {
        this.listeners.forEach(listener => listener(data));
      });
      this.isListening = true;
      console.log('Pedometer service started and listening for steps.');
      return Promise.resolve();
    } catch (error) {
      console.error('Error starting pedometer:', error);
      this.isListening = false; // Ensure state is correct on failure
      return Promise.reject(error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isSupported || !this.isListening) {
      return Promise.resolve();
    }
    try {
      await NativePedometer.stop();
      NativePedometer.removeAllListeners(); // Clean up all listeners for 'step'
      this.isListening = false;
      console.log('Pedometer service stopped.');
      return Promise.resolve();
    } catch (error) {
      console.error('Error stopping pedometer:', error);
      return Promise.reject(error);
    }
  }

  addListener(callback: (data: PedometerData) => void): () => void {
    this.listeners.push(callback);
    // Return an unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  removeAllListeners(): void {
    this.listeners = [];
  }

  async getCurrentStepCount(): Promise<PedometerData> {
    if (!this.isSupported) {
        return Promise.reject('Pedometer not supported.');
    }
    // No need to check isListening here, as we might want to get count even if not actively listening to events (though native might require start)
    // The native implementation might need to be active to return a meaningful count.
    // For now, let's assume `getCurrentStepCount` can be called if plugin is available.
    try {
        const result = await NativePedometer.getCurrentStepCount();
        return result;
    } catch (error) {
        console.error('Error getting current step count:', error);
        return Promise.reject(error);
    }
  }

  get supported(): boolean {
    return this.isSupported;
  }

  get listening(): boolean {
    return this.isListening;
  }
}

// Export a singleton instance
export const Pedometer = new PedometerService(); 