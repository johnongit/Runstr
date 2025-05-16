import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { saveLeaderboardParticipation, getLeaderboardParticipation } from '../utils/leaderboardUtils';
import { getRewardsSettings, saveRewardsSettings } from '../utils/rewardsSettings';

const Settings = () => {
  const { 
    distanceUnit, 
    setDistanceUnit,
    setIsMetric,
    calorieIntensityPref,
    setCalorieIntensityPref,
    healthEncryptionPref,
    setHealthEncryptionPref
  } = useSettings();
  
  const [showPaceInMinutes, setShowPaceInMinutes] = useState(true);
  const [autoSaveRuns, setAutoSaveRuns] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [leaderboardParticipation, setLeaderboardParticipation] = useState(true);
  const [autoClaimRewards, setAutoClaimRewards] = useState(false);
  const [rewardsEnabled, setRewardsEnabled] = useState(true);
  
  // Load settings from localStorage
  useEffect(() => {
    try {
      // Load standard settings
      const savedPaceSetting = localStorage.getItem('showPaceInMinutes');
      if (savedPaceSetting !== null) {
        setShowPaceInMinutes(JSON.parse(savedPaceSetting));
      }
      
      const savedAutoSave = localStorage.getItem('autoSaveRuns');
      if (savedAutoSave !== null) {
        setAutoSaveRuns(JSON.parse(savedAutoSave));
      }
      
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode !== null) {
        setDarkMode(JSON.parse(savedDarkMode));
      }
      
      const savedNotifications = localStorage.getItem('showNotifications');
      if (savedNotifications !== null) {
        setShowNotifications(JSON.parse(savedNotifications));
      }
      
      // Load leaderboard participation
      setLeaderboardParticipation(getLeaderboardParticipation());
      
      // Load rewards settings
      const rewardsSettings = getRewardsSettings();
      setRewardsEnabled(rewardsSettings.enabled);
      setAutoClaimRewards(rewardsSettings.autoClaimRewards);
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);
  
  // Save pace setting to localStorage
  const handlePaceToggle = (e) => {
    const value = e.target.checked;
    setShowPaceInMinutes(value);
    localStorage.setItem('showPaceInMinutes', JSON.stringify(value));
  };
  
  // Handle distance unit changes
  const handleDistanceUnitChange = (unit) => {
    setDistanceUnit(unit);
    setIsMetric(unit === 'km');
  };
  
  // Save auto-save setting to localStorage
  const handleAutoSaveToggle = (e) => {
    const value = e.target.checked;
    setAutoSaveRuns(value);
    localStorage.setItem('autoSaveRuns', JSON.stringify(value));
  };
  
  // Save dark mode setting to localStorage
  const handleDarkModeToggle = (e) => {
    const value = e.target.checked;
    setDarkMode(value);
    localStorage.setItem('darkMode', JSON.stringify(value));
    
    // Apply dark mode to the body element
    if (value) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };
  
  // Save notifications setting to localStorage
  const handleNotificationsToggle = (e) => {
    const value = e.target.checked;
    setShowNotifications(value);
    localStorage.setItem('showNotifications', JSON.stringify(value));
  };
  
  // Save leaderboard participation setting
  const handleLeaderboardToggle = (e) => {
    const value = e.target.checked;
    setLeaderboardParticipation(value);
    saveLeaderboardParticipation(value);
  };
  
  // Save rewards settings
  const handleRewardsEnabledToggle = (e) => {
    const value = e.target.checked;
    setRewardsEnabled(value);
    saveRewardsSettings({
      enabled: value,
      autoClaimRewards,
      showNotifications
    });
  };
  
  // Save auto-claim rewards setting
  const handleAutoClaimToggle = (e) => {
    const value = e.target.checked;
    setAutoClaimRewards(value);
    saveRewardsSettings({
      enabled: rewardsEnabled,
      autoClaimRewards: value,
      showNotifications
    });
  };

  const handleCalorieIntensityChange = (preference) => {
    setCalorieIntensityPref(preference);
  };
  
  const handleHealthEncryptionToggle = async (e) => {
    const enable = e.target.checked;
    if (!enable) {
      const confirmDisable = window.confirm(
        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
      );
      if (!confirmDisable) {
        // Revert toggle
        e.preventDefault();
        return;
      }
    }
    setHealthEncryptionPref(enable ? 'encrypted' : 'plaintext');
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      
      <div className="settings-section">
        <h3>Display Settings</h3>
        
        <div className="setting-item">
          <label>Distance Units</label>
          <div className="unit-toggle">
            <button 
              className={distanceUnit === 'km' ? 'active' : ''}
              onClick={() => handleDistanceUnitChange('km')}
            >
              Kilometers
            </button>
            <button 
              className={distanceUnit === 'mi' ? 'active' : ''}
              onClick={() => handleDistanceUnitChange('mi')}
            >
              Miles
            </button>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="paceToggle">Show Pace in Minutes</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="paceToggle"
              checked={showPaceInMinutes}
              onChange={handlePaceToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="darkModeToggle">Dark Mode</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="darkModeToggle"
              checked={darkMode}
              onChange={handleDarkModeToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="encryptionToggle">Encrypt Health Data (NIP-44)</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="encryptionToggle"
              checked={healthEncryptionPref === 'encrypted'}
              onChange={handleHealthEncryptionToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
      </div>
      
      <div className="settings-section">
        <h3>App Behavior</h3>
        
        <div className="setting-item">
          <label htmlFor="autoSaveToggle">Auto-save Runs</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="autoSaveToggle"
              checked={autoSaveRuns}
              onChange={handleAutoSaveToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="notificationsToggle">Show Notifications</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="notificationsToggle"
              checked={showNotifications}
              onChange={handleNotificationsToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-item">
          <label>Workout Extras Publishing (Calories/Intensity)</label>
          <div className="unit-toggle">
            <button 
              className={calorieIntensityPref === 'autoAccept' ? 'active' : ''}
              onClick={() => handleCalorieIntensityChange('autoAccept')}
            >
              Auto-Accept
            </button>
            <button 
              className={calorieIntensityPref === 'manual' ? 'active' : ''}
              onClick={() => handleCalorieIntensityChange('manual')}
            >
              Manual
            </button>
            <button 
              className={calorieIntensityPref === 'autoIgnore' ? 'active' : ''}
              onClick={() => handleCalorieIntensityChange('autoIgnore')}
            >
              Auto-Ignore
            </button>
          </div>
          <p className="setting-description">
            Choose how to handle publishing workout intensity and caloric data to Nostr.
          </p>
        </div>
      </div>
      
      <div className="settings-section">
        <h3>Leaderboards & Rewards</h3>
        
        <div className="setting-item">
          <label htmlFor="leaderboardToggle">Participate in Leaderboards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="leaderboardToggle"
              checked={leaderboardParticipation}
              onChange={handleLeaderboardToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="rewardsToggle">Enable Bitcoin Rewards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="rewardsToggle"
              checked={rewardsEnabled}
              onChange={handleRewardsEnabledToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="autoClaimToggle">Auto-claim Streak Rewards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="autoClaimToggle"
              checked={autoClaimRewards}
              onChange={handleAutoClaimToggle}
              disabled={!rewardsEnabled}
            />
            <span className="toggle-slider"></span>
          </div>
          <p className="setting-description">
            When enabled, streak rewards will be automatically claimed when you reach milestones.
          </p>
        </div>
      </div>
      
      <div className="settings-section">
        <h3>About</h3>
        <p>Runstr App Version 1.1.0</p>
        <p>A Bitcoin-powered running app</p>
      </div>
    </div>
  );
};

export default Settings; 