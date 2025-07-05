import { useContext } from 'react';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';

export const ActivityModeBanner = () => {
  const { mode, setMode, getActivityText } = useActivityMode();
  const { distanceUnit, toggleDistanceUnit } = useSettings();

  const activityModes = [
    { 
      mode: ACTIVITY_TYPES.RUN, 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17l5-5-5-5M11 17l5-5-5-5" />
        </svg>
      ), 
      label: 'RUNSTR'
    },
    { 
      mode: ACTIVITY_TYPES.WALK, 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17l5-5-5-5" />
        </svg>
      ), 
      label: 'WALKSTR'
    },
    { 
      mode: ACTIVITY_TYPES.CYCLE, 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18a3 3 0 100-6 3 3 0 000 6zM18 18a3 3 0 100-6 3 3 0 000 6zM9 12h6" />
        </svg>
      ), 
      label: 'CYCLESTR'
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
          <div className="balance-amount">
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
                backgroundColor: mode === activity.mode ? '#ffffff' : 'transparent',
                color: mode === activity.mode ? '#000000' : 'var(--text-secondary)',
                border: `1px solid ${mode === activity.mode ? '#ffffff' : 'var(--border-color)'}`
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