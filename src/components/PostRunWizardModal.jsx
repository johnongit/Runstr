import React, { useState } from 'react';
import PropTypes from 'prop-types';
import runDataService from '../services/RunDataService';
import { publishRun } from '../utils/runPublisher';

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
      const results = await publishRun(run, unit);
      setPublishResults(results);
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
        <h3 className="text-lg font-semibold mb-4">Share to Nostr</h3>
        <p className="mb-3">The following data will be published:</p>
        <ul className="list-disc pl-6 mb-6">
          <li>Workout summary (distance, duration, elevation, calories) – NIP-101e</li>
          <li>Workout intensity – NIP-101h</li>
          <li>Calories burned – NIP-101h</li>
        </ul>
        {publishResults && (
          <div className="mb-4 text-sm">
            {allSuccess ? (
              <span className="text-green-400">Successfully published!</span>
            ) : (
              <span className="text-red-400">Some events failed. See console for details.</span>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="button-secondary" onClick={onClose} disabled={publishing}>Close</button>
          {!publishResults && (
            <button className="button-primary" onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish'}
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