import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import runDataService from '../services/RunDataService';
import { publishRun } from '../utils/runPublisher';
import { NostrContext } from '../contexts/NostrContext';
import { useSettings, PUBLISHABLE_METRICS } from '../contexts/SettingsContext';

const intensities = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' }
];

export const PostRunWizardModal = ({ run, onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedIntensity, setSelectedIntensity] = useState(run.intensity || 'moderate');
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState(null);

  const { lightningAddress, publicKey } = useContext(NostrContext);
  const settings = useSettings();

  // helper save intensity into run record once selected
  const persistIntensity = (value) => {
    if (!run) return;
    run.intensity = value;
    runDataService.updateRun(run.id, { intensity: value });
  };

  const handleNext = () => {
    persistIntensity(selectedIntensity);
    setStep(2);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const unit = localStorage.getItem('distanceUnit') || 'km';
      const results = await publishRun(run, unit, settings);
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

  const renderStep1 = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Workout Finished!</h3>
      <p className="mb-3">How hard was this workout?</p>
      <div className="flex flex-col gap-2 mb-6">
        {intensities.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="intensity"
              value={opt.value}
              checked={selectedIntensity === opt.value}
              onChange={() => setSelectedIntensity(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button className="button-secondary" onClick={onClose}>Skip</button>
        <button className="button-primary" onClick={handleNext}>Next</button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const allSuccess = publishResults && publishResults.every(r => r.success);
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Save to Nostr</h3>
        <p className="mb-3">The following data will be (or was) published:</p>
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-300">Workout Record (Summary)</span>
            <div className="toggle-switch opacity-50">
              <input type="checkbox" checked readOnly disabled />
              <span className="toggle-slider"></span>
            </div>
          </div>
          {PUBLISHABLE_METRICS.map(metric => {
            const settingKey = `publish${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`;
            const setSettingKey = `setPublish${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`;
            const isChecked = settings[settingKey];
            const setter = settings[setSettingKey];

            return (
              <div key={metric.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-300">{metric.label}</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id={`publish-${metric.key}-toggle`}
                    checked={isChecked}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={publishing || !!publishResults}
                  />
                  <span className="toggle-slider"></span>
                </div>
              </div>
            );
          })}
        </div>
        
        {publishResults && (
          <div className="mb-4 text-sm">
            {allSuccess ? (
              <span className="text-green-400">Successfully published selected events!</span>
            ) : (
              <span className="text-red-400">Some selected events may have failed. See console.</span>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="button-secondary" onClick={onClose} disabled={publishing && !publishResults}>Close</button>
          {!publishResults && (
            <button className="button-primary" onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish Selected'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content post-run-wizard w-full max-w-md">
        {step === 1 ? renderStep1() : renderStep2()}
      </div>
    </div>
  );
};

PostRunWizardModal.propTypes = {
  run: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
}; 