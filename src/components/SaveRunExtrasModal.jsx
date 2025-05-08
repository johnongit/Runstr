import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../contexts/SettingsContext';
import { createWorkoutIntensityEvent, createCaloricDataEvent } from '../utils/nostrHealth';
import { createAndPublishEvent } from '../utils/nostr'; // Assuming createAndPublishEvent is here

import './SaveRunExtrasModal.css'; // We'll create this CSS file next

export const SaveRunExtrasModal = ({ run, workoutEventId, onClose, onPublishSuccess }) => {
  const { calorieIntensityPref } = useSettings();

  // State for inputs
  const [intensityValue, setIntensityValue] = useState('5'); // Default RPE
  const [intensityScale, setIntensityScale] = useState('rpe10'); // Default to RPE scale
  const [calories, setCalories] = useState('');

  // State for toggles
  const [postIntensity, setPostIntensity] = useState(true);
  const [postCalories, setPostCalories] = useState(true);

  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    // Pre-fill calories if possible (simple estimation)
    if (run && run.distance) {
      const estimatedCalories = Math.round(run.distance * 0.06); // km based, adjust if needed
      setCalories(String(estimatedCalories));
    }

    // Initialize toggle states based on settings
    if (calorieIntensityPref === 'autoAccept') {
      setPostIntensity(true);
      setPostCalories(true);
    } else if (calorieIntensityPref === 'autoIgnore') {
      setPostIntensity(false);
      setPostCalories(false);
    } else { // manual - retain current/default
      // Potentially load last manual choice here in a future iteration
    }
  }, [run, calorieIntensityPref]);

  const handlePublish = async () => {
    if (!run || !workoutEventId) {
      console.error("Run data or workoutEventId missing for publishing extras.");
      // Potentially show an error to the user
      return;
    }
    setIsPublishing(true);
    let intensityEventId = null;
    let caloricEventId = null;
    let errors = [];

    try {
      // 1. Publish Intensity Event (if toggled)
      if (postIntensity && intensityValue) {
        const intensityEvent = createWorkoutIntensityEvent(intensityValue, intensityScale, {
          timestamp: new Date().toISOString(),
          activityType: 'run', // Assuming 'run', could be passed in or derived
          workoutEventId: workoutEventId,
          source: 'RunstrApp' // Or your app's name
        });
        if (intensityEvent) {
          try {
            const publishedIntensity = await createAndPublishEvent(intensityEvent);
            intensityEventId = publishedIntensity?.id;
            console.log('Published intensity event:', publishedIntensity);
          } catch (e) {
            console.error('Error publishing intensity event:', e);
            errors.push('Failed to publish workout intensity.');
          }
        }
      }

      // 2. Publish Caloric Data Event (if toggled)
      if (postCalories && calories) {
        const caloricEvent = createCaloricDataEvent(calories, {
          timestamp: new Date().toISOString(),
          workoutEventId: workoutEventId,
          accuracy: 'estimated', // Or allow user to set
          source: 'RunstrApp'
        });
        if (caloricEvent) {
          try {
            const publishedCalories = await createAndPublishEvent(caloricEvent);
            caloricEventId = publishedCalories?.id;
            console.log('Published caloric event:', publishedCalories);
          } catch (e) {
            console.error('Error publishing caloric event:', e);
            errors.push('Failed to publish caloric data.');
          }
        }
      }

      if (onPublishSuccess) {
        onPublishSuccess({ intensityEventId, caloricEventId, errors });
      }

    } catch (error) {
      console.error('Error publishing workout extras:', error);
      if (onPublishSuccess) { // Still call, but pass errors
          onPublishSuccess({ intensityEventId, caloricEventId, errors: [...errors, 'An unexpected error occurred.'] });
      }
    } finally {
      setIsPublishing(false);
      onClose(); // Close modal regardless of individual success/failure of extras
    }
  };
  
  const isManualMode = calorieIntensityPref === 'manual';

  return (
    <div className="modal-overlay">
      <div className="modal-content save-run-extras-modal">
        <h3>Publish Workout Extras</h3>
        <p>Optionally publish your workout intensity and calories burned to Nostr.</p>

        {/* Intensity Input */}
        <div className="form-group">
          <label htmlFor="intensityValue">Workout Intensity</label>
          <div className="intensity-controls">
            <select 
              id="intensityScale" 
              value={intensityScale} 
              onChange={(e) => setIntensityScale(e.target.value)}
              disabled={!isManualMode && !postIntensity}
            >
              <option value="rpe10">RPE (1-10)</option>
              <option value="keyword">Keyword</option>
            </select>
            {intensityScale === 'rpe10' ? (
              <input
                type="number"
                id="intensityValueRPE"
                min="1"
                max="10"
                value={intensityValue}
                onChange={(e) => setIntensityValue(e.target.value)}
                disabled={!isManualMode && !postIntensity}
                placeholder="e.g., 7"
              />
            ) : (
              <select 
                id="intensityValueKeyword"
                value={intensityValue}
                onChange={(e) => setIntensityValue(e.target.value)}
                disabled={!isManualMode && !postIntensity}
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="max">Max</option>
              </select>
            )}
          </div>
          <div className="toggle-switch-container">
            <label htmlFor="postIntensityToggle">Post Intensity</label>
            <input
              type="checkbox"
              id="postIntensityToggle"
              checked={postIntensity}
              onChange={(e) => setPostIntensity(e.target.checked)}
              disabled={!isManualMode}
            />
             <span className="toggle-slider"></span>
          </div>
        </div>

        {/* Calories Input */}
        <div className="form-group">
          <label htmlFor="calories">Calories Burned (kcal)</label>
          <input
            type="number"
            id="calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            disabled={!isManualMode && !postCalories}
            placeholder="e.g., 350"
          />
          <div className="toggle-switch-container">
            <label htmlFor="postCaloriesToggle">Post Calories</label>
            <input
              type="checkbox"
              id="postCaloriesToggle"
              checked={postCalories}
              onChange={(e) => setPostCalories(e.target.checked)}
              disabled={!isManualMode}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} disabled={isPublishing} className="button-secondary">
            Skip / Close
          </button>
          <button onClick={handlePublish} disabled={isPublishing} className="button-primary">
            {isPublishing ? 'Publishing Extras...' : 'Publish Extras & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

SaveRunExtrasModal.propTypes = {
  run: PropTypes.object.isRequired,
  workoutEventId: PropTypes.string.isRequired, // ID of the main kind 1301 workout event
  onClose: PropTypes.func.isRequired,
  onPublishSuccess: PropTypes.func // Callback with results of extra publications
}; 