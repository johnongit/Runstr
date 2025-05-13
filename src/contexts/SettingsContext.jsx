import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create the context
const SettingsContext = createContext(null);

// Custom hook to use the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    console.error('useSettings must be used within a SettingsProvider');
    // Return fallback object to prevent crashes
    return {
      distanceUnit: 'km',
      toggleDistanceUnit: () => console.warn('Settings not initialized'),
      setDistanceUnit: () => console.warn('Settings not initialized'),
      calorieIntensityPref: 'manual',
      setCalorieIntensityPref: () => console.warn('Settings not initialized'),
      healthEncryptionPref: 'encrypted',
      setHealthEncryptionPref: () => console.warn('Settings not initialized'),
      isHealthEncryptionEnabled: () => true
    };
  }
  return context;
};

// Provider component
export const SettingsProvider = ({ children }) => {
  // Initialize distanceUnit state from localStorage
  const [distanceUnit, setDistanceUnit] = useState(() => {
    try {
      return localStorage.getItem('distanceUnit') || 'km';
    } catch (error) {
      console.error('Error initializing distance unit state:', error);
      return 'km';
    }
  });

  // Initialize calorieIntensityPref state from localStorage
  const [calorieIntensityPref, setCalorieIntensityPref] = useState(() => {
    try {
      const storedPref = localStorage.getItem('calorieIntensityPref');
      return storedPref && ['autoAccept', 'autoIgnore', 'manual'].includes(storedPref) ? storedPref : 'manual';
    } catch (error) {
      console.error('Error initializing calorie/intensity preference state:', error);
      return 'manual';
    }
  });

  // Initialize healthEncryptionPref state from localStorage ("encrypted" | "plaintext")
  const [healthEncryptionPref, setHealthEncryptionPref] = useState(() => {
    try {
      const stored = localStorage.getItem('healthEncryptionPref');
      return stored === 'plaintext' ? 'plaintext' : 'encrypted';
    } catch (e) {
      console.error('Error initializing health encryption pref:', e);
      return 'encrypted';
    }
  });

  // Toggle between km and mi units
  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
  };

  // Save distanceUnit to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('distanceUnit', distanceUnit);
      
      // Dispatch an event so other components can listen for changes
      const event = new CustomEvent('distanceUnitChanged', { detail: distanceUnit });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving distance unit:', error);
    }
  }, [distanceUnit]);

  // Save calorieIntensityPref to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('calorieIntensityPref', calorieIntensityPref);
      
      // Dispatch an event so other components can listen for changes
      const event = new CustomEvent('calorieIntensityPrefChanged', { detail: calorieIntensityPref });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving calorie/intensity preference:', error);
    }
  }, [calorieIntensityPref]);

  // Save healthEncryptionPref to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('healthEncryptionPref', healthEncryptionPref);
      
      // Dispatch an event so other components can listen for changes
      const event = new CustomEvent('healthEncryptionPrefChanged', { detail: healthEncryptionPref });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving health encryption preference:', error);
    }
  }, [healthEncryptionPref]);

  return (
    <SettingsContext.Provider value={{ 
      distanceUnit, 
      setDistanceUnit,
      toggleDistanceUnit,
      calorieIntensityPref,
      setCalorieIntensityPref,
      healthEncryptionPref,
      setHealthEncryptionPref,
      isHealthEncryptionEnabled: () => healthEncryptionPref === 'encrypted'
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

SettingsProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 