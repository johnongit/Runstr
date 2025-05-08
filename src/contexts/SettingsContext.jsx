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
      setDistanceUnit: () => console.warn('Settings not initialized')
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

  return (
    <SettingsContext.Provider value={{ 
      distanceUnit, 
      setDistanceUnit,
      toggleDistanceUnit,
      calorieIntensityPref,
      setCalorieIntensityPref
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

SettingsProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 