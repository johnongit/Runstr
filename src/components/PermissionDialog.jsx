import { useState, useContext, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Optional battery-optimisation plugin is loaded at runtime so tests / web build won't fail if it's absent
const ensureBatteryWhitelist = async () => {
  try {
    const platform = navigator.userAgent.toLowerCase().includes('android') ? 'android' : 'other';
    if (platform !== 'android') return;
    const { BatteryOptimization } = await import('@capawesome-team/capacitor-android-battery-optimization');
    if (!BatteryOptimization?.isIgnoringBatteryOptimizations) return;

    const status = await BatteryOptimization.isIgnoringBatteryOptimizations();
    if (!status?.value) {
      await BatteryOptimization.requestIgnoreBatteryOptimizations();
    }
  } catch (err) {
    // Gracefully ignore if plugin not available (e.g. web / test env)
    console.warn('Battery optimisation plugin not available or failed', err?.message || err);
  }
};

export const PermissionDialog = ({ onContinue, onCancel }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { requestNostrPermissions } = useContext(NostrContext);

  const handleContinue = async () => {
    setIsProcessing(true);
    
    try {
      // This will show the Amber Signer dialog
      if (window.nostr) {
        const nostrSuccess = await requestNostrPermissions();
        if (!nostrSuccess) {
          console.warn('Failed to get Nostr permissions');
        }
      }
      
      // Request location permissions immediately after Amber permissions
      try {
        // Create a temporary watcher to trigger permission request
        // Use a unique ID for this temporary watcher
        const tempWatcherId = 'permissionRequest_' + Date.now();
        
        // Request location permissions using BackgroundGeolocation
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            id: tempWatcherId,
            backgroundMessage: 'Tracking your runs',
            backgroundTitle: 'Runstr',
            requestPermissions: true,
            distanceFilter: 10,
            highAccuracy: true,
            staleLocationThreshold: 30000,
            // Add these specific settings for better compatibility
            notificationTitle: 'Runstr',
            notificationText: 'Location tracking is active',
            interval: 5000, // Check every 5 seconds
            fastestInterval: 5000,
            activitiesInterval: 10000,
            stopOnTerminate: false,
            startOnBoot: false,
            locationProvider: 'gps', // Explicitly use GPS provider
            saveBatteryOnBackground: false
          },
          (location, error) => {
            if (error) {
              console.warn('Location permission error:', error);
              
              // If permission was denied, show a more helpful message
              if (error.code === 'NOT_AUTHORIZED' || error.message?.includes('permission')) {
                alert('Location permission is required for tracking runs. Please go to Settings > Apps > Runstr > Permissions and enable Location access.');
                
                // Try to open app settings directly
                BackgroundGeolocation.openSettings();
              }
              return;
            }
            
            // Successfully got location permission
            console.log('Location permission granted successfully');
          }
        );
        
        // Clean up the temporary watcher after a short delay
        // This ensures the permission request completes
        setTimeout(async () => {
          try {
            await BackgroundGeolocation.removeWatcher({
              id: watcherId
            });
          } catch (cleanupError) {
            console.warn('Error cleaning up temporary watcher:', cleanupError);
          }
        }, 2000);
        
      } catch (locationError) {
        console.error('Error requesting location permissions:', locationError);
        
        // Show a more helpful error message for GrapheneOS users
        if (locationError.message?.includes('permission') || locationError.code === 'NOT_AUTHORIZED') {
          alert('Location permission was not granted. Runstr requires location access to track your runs. Please enable location permission in your device settings and restart the app.');
          
          // Try to open settings
          try {
            await BackgroundGeolocation.openSettings();
          } catch (settingsError) {
            console.warn('Could not open settings:', settingsError);
          }
        }
      }
      
      // Ask user to whitelist the app from battery optimisations (GrapheneOS & Android)
      await ensureBatteryWhitelist();
      
      // Mark dialog as completed regardless of results
      localStorage.setItem('permissionsGranted', 'true');
      setIsVisible(false);
      if (onContinue) onContinue();
    } catch (error) {
      console.error('Error during permission request:', error);
      alert('There was an error requesting permissions. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCancel = useCallback(() => {
    setIsVisible(false);
    if (onCancel) onCancel();
  }, [onCancel]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) handleCancel();
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [handleCancel]);

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content permission-dialog">
        <h3>Welcome to Runstr!</h3>
        
        <p>This privacy-focused app keeps your data private and under your control.</p>
        
        <p>To use the app, we need these permissions:</p>
        
        <div className="permission-item">
          <h4>1. Location Access</h4>
          <p>This allows us to accurately track your runs, measure your distance, calculate your pace, and map your routes. Your location data is stored ONLY on your device and is never sold or shared with third parties.</p>
        </div>
        
        <div className="permission-item">
          <h4>2. Amber Signer Trust</h4>
          <p>The app requires basic permission in Amber Signer when prompted. This secure connection lets you safely share your runs on Nostr only when YOU choose to do so. Only minimal permissions are needed - you don&apos;t need to grant full trust.</p>
        </div>
        
        <p>We do not harvest or sell your data. Your privacy is our priority - all tracking information remains on your device unless you explicitly choose to share it.</p>
        
        <p>Without these permissions, key features like complete run tracking, route mapping, and optional social sharing won&apos;t be available.</p>
        
        <p className="permission-footer">Ready to run with Nostr?</p>
        
        <div className="modal-buttons">
          <button 
            className="primary-btn" 
            onClick={handleContinue}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Continue'}
          </button>
          <button 
            className="secondary-btn" 
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

PermissionDialog.propTypes = {
  onContinue: PropTypes.func,
  onCancel: PropTypes.func
}; 