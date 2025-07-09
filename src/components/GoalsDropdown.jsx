import { useState, useEffect } from 'react';
import { ButtonGroup } from "@/components/ui/button-group";
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Goals dropdown component for setting distance targets
 * Matches the styling of the Weekly Rewards Summary dropdown
 */
const GoalsDropdown = () => {
  const { distanceUnit } = useSettings();
  const { distance, isTracking, stopRun } = useRunTracker();
  
  // State for dropdown expansion and selected goal
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Convert goal value to meters for distance comparison
  const getGoalInMeters = (goalValue) => {
    // goalValue is stored as meters (e.g., "1000" = 1000 meters)
    const goalInMeters = parseInt(goalValue);
    
    // If user has miles selected, the display shows miles but the stored value
    // should still represent the actual distance in meters
    if (distanceUnit === 'mi') {
      // Convert the meter value to what it would be if interpreted as miles
      // For example: "1000" represents 1km, but for mile users we want 1 mile
      const milesEquivalent = goalInMeters / 1000; // Convert to "units" (1000m = 1 unit)
      return milesEquivalent * 1609.344; // Convert units to miles in meters
    }
    
    return goalInMeters; // Keep as meters for km users
  };

  // Format goal label for display (adjust for miles vs km)
  const formatGoalLabel = (goalValue) => {
    const goalUnits = parseInt(goalValue) / 1000; // Convert to display units
    if (distanceUnit === 'mi') {
      return `${goalUnits}mi`;
    }
    return `${goalUnits}k`;
  };

  // Check if goal is reached and auto-stop
  useEffect(() => {
    if (selectedGoal && isTracking && distance > 0) {
      const goalDistanceInMeters = getGoalInMeters(selectedGoal);
      
      if (distance >= goalDistanceInMeters) {
        console.log(`Goal reached! Distance: ${distance}m, Goal: ${goalDistanceInMeters}m`);
        stopRun();
        // Clear the goal after auto-stop
        setSelectedGoal(null);
      }
    }
  }, [distance, selectedGoal, isTracking, stopRun]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleGoalSelect = (goalValue) => {
    setSelectedGoal(goalValue);
    setIsExpanded(false); // Close dropdown after selection
  };

  return (
    <div className="bg-bg-secondary rounded-xl shadow-lg border border-border-secondary mb-4">
      {/* Compact Summary Header - Always Visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-tertiary transition-colors duration-200 rounded-xl"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-text-primary">Goals</span>
          {selectedGoal && (
            <span className="text-sm px-2 py-1 bg-primary/20 text-primary rounded-md">
              Target: {formatGoalLabel(selectedGoal)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <svg 
            className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Detailed Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border-secondary">
          <div className="mt-4">
            <h4 className="text-sm font-medium text-text-secondary mb-3">Distance Goals</h4>
            <ButtonGroup
              value={selectedGoal || ''}
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
                ? `Your run will automatically stop when you reach ${formatGoalLabel(selectedGoal)}.`
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