import { useState } from 'react';
import { ButtonGroup } from "@/components/ui/button-group";
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Goals dropdown component for setting distance targets
 * Uses RunTracker service for simple, reliable goal management
 */
const GoalsDropdown = () => {
  const { distanceUnit } = useSettings();
  const { setDistanceGoal, clearDistanceGoal, getDistanceGoal } = useRunTracker();
  
  // State for dropdown expansion only
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current selected goal from the service
  const selectedGoal = getDistanceGoal();

  // Handle goal selection
  const handleGoalSelect = (goalValue) => {
    if (goalValue && goalValue !== '') {
      // Convert goal to meters based on user's unit preference
      let goalInMeters;
      const goalNumber = parseInt(goalValue);
      
      if (distanceUnit === 'mi') {
        // For mile users, convert goal to actual miles then to meters
        const goalInMiles = goalNumber / 1000; // Convert '1000' to 1 mile
        goalInMeters = goalInMiles * 1609.344;
      } else {
        // For km users, goal is already in meters
        goalInMeters = goalNumber;
      }
      
      setDistanceGoal(goalInMeters);
    } else {
      clearDistanceGoal();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-text-primary">Goals</h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-muted transition-colors hover:text-text-primary"
        >
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-4">
          <div className="space-y-3">
            <ButtonGroup
              value={selectedGoal ? selectedGoal.toString() : ''}
              onValueChange={handleGoalSelect}
              options={[
                { value: '1000', label: distanceUnit === 'mi' ? '1mi' : '1k' },
                { value: '5000', label: distanceUnit === 'mi' ? '5mi' : '5k' },
                { value: '10000', label: distanceUnit === 'mi' ? '10mi' : '10k' },
                { value: '20000', label: distanceUnit === 'mi' ? '20mi' : '20k' }
              ]}
              size="default"
              className="mb-2"
            />
            
            <p className="text-xs text-text-muted mt-2">
              {selectedGoal 
                ? `Your run will automatically stop when you reach ${distanceUnit === 'mi' ? `${(selectedGoal/1609.344).toFixed(0)}mi` : `${(selectedGoal/1000).toFixed(0)}k`}.`
                : 'Select a distance goal to automatically stop your run when reached.'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsDropdown; 