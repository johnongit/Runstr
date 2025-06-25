// src/services/BluetoothService.js
// BLE helper using @capacitor-community/bluetooth-le for native mobile performance.
import { BleClient } from '@capacitor-community/bluetooth-le';

const RUNSTR_SERVICE_UUID = '00000001-7275-6E73-7472-5F69645F3031';
const RUNSTR_DATA_CHAR_UUID = '00000002-7275-6E73-7472-5F69645F3031';

/**
 * Connects to the Bangle.js watch using the Capacitor BLE plugin and fetches run data.
 * Uses phone-initiated sync: writes to characteristic to trigger watch to send data via notifications.
 */
export async function fetchRunDataFromWatch() {
  console.log('[BluetoothService] Starting sync process...');
  await BleClient.initialize();

  // Request device scan
  console.log('[BluetoothService] Requesting device...');
  const device = await BleClient.requestDevice({
    services: [RUNSTR_SERVICE_UUID],
  });

  if (!device) {
    throw new Error('No device selected');
  }

  console.log('[BluetoothService] Device selected:', device.name || device.deviceId);

  // Connect to the device
  console.log('[BluetoothService] Connecting to device...');
  await BleClient.connect(device.deviceId);
  console.log('[BluetoothService] Connected successfully');

  // Set up notification listener BEFORE writing to trigger sync
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    const cleanup = async () => {
      try {
        console.log('[BluetoothService] Cleaning up connection...');
        // Stop notifications and disconnect
        await BleClient.stopNotifications(device.deviceId, RUNSTR_SERVICE_UUID, RUNSTR_DATA_CHAR_UUID);
        await BleClient.disconnect(device.deviceId);
        console.log('[BluetoothService] Cleanup completed');
      } catch (cleanupError) {
        console.warn('[BluetoothService] Cleanup error:', cleanupError);
      }
    };
    
    // Listen for notifications from the watch
    console.log('[BluetoothService] Setting up notifications...');
    BleClient.startNotifications(
      device.deviceId,
      RUNSTR_SERVICE_UUID,
      RUNSTR_DATA_CHAR_UUID,
      async (value) => {
        console.log('[BluetoothService] Notification received, data length:', value.buffer.byteLength);
        clearTimeout(timeoutId);
        
        const jsonString = new TextDecoder('utf-8').decode(value.buffer);
        console.log('[BluetoothService] Received data from watch:', jsonString);
        
        // Clean up connection
        await cleanup();
        
        if (!jsonString || jsonString.includes('no_run_data')) {
          reject(new Error('No run data available on the watch.'));
          return;
        }
        
        try {
          const parsedData = JSON.parse(jsonString);
          console.log('[BluetoothService] Successfully parsed watch data:', parsedData);
          resolve(parsedData);
        } catch (err) {
          console.error('[BluetoothService] Failed to parse watch JSON:', err);
          reject(new Error('Received invalid run data'));
        }
      }
    ).then(() => {
      // Once notifications are set up, write to characteristic to trigger sync
      console.log('[BluetoothService] Notifications set up, triggering sync...');
      
      // Write any value to trigger the watch to send data
      const triggerData = new DataView(new ArrayBuffer(1));
      triggerData.setUint8(0, 1); // Send a single byte with value 1
      
      return BleClient.write(
        device.deviceId,
        RUNSTR_SERVICE_UUID,
        RUNSTR_DATA_CHAR_UUID,
        triggerData
      );
    }).then(() => {
      console.log('[BluetoothService] Sync trigger sent to watch, waiting for response...');
      
      // Set timeout for sync operation (10 seconds)
      timeoutId = setTimeout(async () => {
        console.log('[BluetoothService] Sync timeout - no response received');
        await cleanup();
        reject(new Error('Sync timeout - no response from watch'));
      }, 10000);
      
    }).catch(async (error) => {
      console.error('[BluetoothService] Error setting up sync:', error);
      await cleanup();
      reject(error);
    });
  });
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