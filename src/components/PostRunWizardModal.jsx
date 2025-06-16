import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { publishRun } from '../utils/runPublisher';
import { NostrContext } from '../contexts/NostrContext';
import { useSettings } from '../contexts/SettingsContext';

export const PostRunWizardModal = ({ run, onClose }) => {
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState(null);

  const { lightningAddress, publicKey } = useContext(NostrContext);
  const settings = useSettings();

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const unit = localStorage.getItem('distanceUnit') || 'km';
      // Only publish the main workout record (NIP101e), no extras
      const results = await publishRun(run, unit, { 
        ...settings,
        // Override all NIP101h options to false, only publish main workout
        publishIntensity: false,
        publishCalories: false,
        publishDurationMetric: false,
        publishDistanceMetric: false,
        publishPaceMetric: false,
        publishElevationMetric: false,
        publishSteps: false,
        publishSplits: false
      });
      setPublishResults(results);

      const allSuccess = results && results.every(r => r.success);
      if (allSuccess) {
        try {
          const { rewardUserActivity } = await import('../services/rewardService');
          if (publicKey) {
            const res = await rewardUserActivity(publicKey, 'workout_record', settings.publishMode === 'private', lightningAddress);
            const toastMsg = res.success ? `Reward sent: ${res.message}` : `Reward failed: ${res.error || res.message}`;
            if (window.Android && window.Android.showToast) {
              window.Android.showToast(toastMsg);
            } else {
              alert(toastMsg);
            }
          }
        } catch (errReward) {
          console.warn('reward zap failed', errReward);
        }
      }
    } catch (err) {
      console.error('PostRunWizardModal publish error', err);
      setPublishResults([{ success: false, error: err.message }]);
    } finally {
      setPublishing(false);
    }
  };

  // Helper function to format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const allSuccess = publishResults && publishResults.every(r => r.success);

  return (
    <div className="modal-overlay">
      <div className="modal-content post-run-wizard w-full max-w-md">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-purple-300">Save Workout to Nostr</h3>
          <p className="mb-4 text-gray-300">
            Your workout summary will be published to Nostr as a workout record.
          </p>
          
          <div className="mb-4 p-3 bg-gray-700 rounded-md text-sm">
            <p><strong>Distance:</strong> {run.distance ? `${(run.distance / 1000).toFixed(2)} km` : 'N/A'}</p>
            <p><strong>Duration:</strong> {run.duration ? formatTime(run.duration) : 'N/A'}</p>
            <p><strong>Activity:</strong> {run.activityType || 'Run'}</p>
          </div>
          
          {publishResults && (
            <div className="mb-4 text-sm">
              {allSuccess ? (
                <span className="text-green-400">✅ Successfully published workout record!</span>
              ) : (
                <span className="text-red-400">❌ Failed to publish workout record. Check console for details.</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button 
              className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 transition-colors" 
              onClick={onClose} 
              disabled={publishing && !publishResults}
            >
              {publishResults ? 'Close' : 'Cancel'}
            </button>
            {!publishResults && (
              <button 
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handlePublish} 
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish Workout'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

PostRunWizardModal.propTypes = {
  run: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
}; 