import { useContext } from 'react';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';

export const ActivityModeBanner = () => {
  const { mode, setMode, getActivityText } = useActivityMode();
  const { distanceUnit, toggleDistanceUnit } = useSettings();

  const activityModes = [
    { 
      mode: ACTIVITY_TYPES.RUN, 
      icon: '🏃‍♂️', 
      label: 'Run',
      color: '#22c55e' // green
    },
    { 
      mode: ACTIVITY_TYPES.WALK, 
      icon: '🚶‍♂️', 
      label: 'Walk',
      color: '#3b82f6' // blue
    },
    { 
      mode: ACTIVITY_TYPES.CYCLE, 
      icon: '🚴‍♂️', 
      label: 'Cycle',
      color: '#f59e0b' // amber
    }
  ];

  const currentActivity = activityModes.find(activity => activity.mode === mode);

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleDistanceUnitToggle = () => {
    toggleDistanceUnit();
  };

  return (
    <div className="dashboard-wallet-header">
      <div className="wallet-card">
        <div className="balance-section">
          <div className="balance-amount" style={{ color: currentActivity?.color }}>
            {currentActivity?.icon}
          </div>
          <div className="balance-unit">{currentActivity?.label}</div>
        </div>
        
        <div className="wallet-actions">
          {activityModes.map((activity) => (
            <button
              key={activity.mode}
              className={`action-button ${mode === activity.mode ? 'active' : ''}`}
              onClick={() => handleModeChange(activity.mode)}
              style={{
                backgroundColor: mode === activity.mode ? activity.color : 'transparent',
                color: mode === activity.mode ? '#000' : 'var(--text-secondary)',
                border: `1px solid ${mode === activity.mode ? activity.color : 'var(--border-color)'}`
              }}
              title={`Switch to ${activity.label} mode`}
            >
              {activity.icon}
            </button>
          ))}
          
          <button 
            className="action-button distance-unit-button"
            onClick={handleDistanceUnitToggle}
            title={`Switch to ${distanceUnit === 'km' ? 'miles' : 'kilometers'}`}
          >
            {distanceUnit.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}; 