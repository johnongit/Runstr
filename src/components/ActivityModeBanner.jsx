import { useContext } from 'react';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';

export const ActivityModeBanner = () => {
  const { mode, setMode, getActivityText } = useActivityMode();
  const { distanceUnit, toggleDistanceUnit } = useSettings();

  const activityModes = [
    { 
      mode: ACTIVITY_TYPES.RUN, 
      label: 'RUNSTR'
    },
    { 
      mode: ACTIVITY_TYPES.WALK, 
      label: 'WALKSTR'
    },
    { 
      mode: ACTIVITY_TYPES.CYCLE, 
      label: 'CYCLESTR'
    }
  ];

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleDistanceUnitToggle = () => {
    toggleDistanceUnit();
  };

  return (
    <div className="dashboard-wallet-header">
      <div className="wallet-card">
        <div className="wallet-actions">
          {activityModes.map((activity) => (
            <button
              key={activity.mode}
              className={`action-button ${mode === activity.mode ? 'active' : ''}`}
              onClick={() => handleModeChange(activity.mode)}
              style={{
                backgroundColor: mode === activity.mode ? '#ffffff' : '#000000',
                color: mode === activity.mode ? '#000000' : '#ffffff',
                border: `1px solid ${mode === activity.mode ? '#ffffff' : 'var(--border-color)'}`,
                fontSize: '0.8rem',
                fontWeight: '600',
                minWidth: '80px'
              }}
              title={`Switch to ${activity.label} mode`}
            >
              {activity.label}
            </button>
          ))}
          
          <button 
            className="action-button distance-unit-button"
            onClick={handleDistanceUnitToggle}
            title={`Switch to ${distanceUnit === 'km' ? 'miles' : 'kilometers'}`}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}
          >
            {distanceUnit.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}; 