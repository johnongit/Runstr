import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import type { PedometerData, PedometerSensorInfo } from './PedometerService'; // Import interfaces

export interface PedometerPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  getCurrentStepCount(): Promise<PedometerData>;
  getSensorInfo(): Promise<PedometerSensorInfo>;
  addListener(eventName: 'step', listenerFunc: (data: PedometerData) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

const Pedometer = registerPlugin<PedometerPlugin>('Pedometer');

export { Pedometer }; 