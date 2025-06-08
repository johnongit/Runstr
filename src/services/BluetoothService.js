// src/services/BluetoothService.js
// BLE helper using @capacitor-community/bluetooth-le for native mobile performance.
import { BleClient } from '@capacitor-community/bluetooth-le';

const RUNSTR_SERVICE_UUID = '00000001-7275-6E73-7472-5F69645F3031';
const RUNSTR_DATA_CHAR_UUID = '00000002-7275-6E73-7472-5F69645F3031';

/**
 * Connects to the Bangle.js watch using the Capacitor BLE plugin and fetches run data.
 */
export async function fetchRunDataFromWatch() {
  await BleClient.initialize();

  // Request device scan
  const device = await BleClient.requestDevice({
    services: [RUNSTR_SERVICE_UUID],
  });

  if (!device) {
    throw new Error('No device selected');
  }

  // Connect to the device
  await BleClient.connect(device.deviceId);

  // Read the characteristic value
  const value = await BleClient.read(
    device.deviceId,
    RUNSTR_SERVICE_UUID,
    RUNSTR_DATA_CHAR_UUID
  );

  // Disconnect after reading
  await BleClient.disconnect(device.deviceId);

  const jsonString = new TextDecoder('utf-8').decode(value.buffer);
  
  if (!jsonString || jsonString.includes('no_run_data')) {
    throw new Error('No run data available on the watch.');
  }

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('[BluetoothService] Failed to parse watch JSON:', err);
    throw new Error('Received invalid run data');
  }
}

/**
 * Convert the raw watch JSON structure to the internal Run object.
 */
export function mapWatchDataToRun(watchData, distanceUnit = 'km') {
  const durationSeconds = Math.round((watchData.duration || 0) / 1000);

  return {
    timestamp: watchData.startTime || Date.now(),
    distance: watchData.distance || 0,
    duration: durationSeconds,
    estimatedTotalSteps: watchData.steps ?? null,
    unit: distanceUnit,
    positions: watchData.gpsCoordinates || [],
    device: watchData.device || 'Bangle.js RUNSTR App'
  };
}