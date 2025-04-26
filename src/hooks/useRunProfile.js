import { useState, useCallback } from 'react';

/**
 * Custom hook for managing user profile data
 * Optimized for Android
 */
export const useRunProfile = () => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Add unit preferences state
  const [unitPreferences, setUnitPreferences] = useState(() => {
    const storedPreferences = localStorage.getItem('unitPreferences');
    return storedPreferences
      ? JSON.parse(storedPreferences)
      : {
          weight: 'kg',
          height: 'imperial' // Default to imperial for backward compatibility
        };
  });
  
  // Load user profile from local storage with default values
  const [userProfile, setUserProfile] = useState(() => {
    const storedProfile = localStorage.getItem('userProfile');
    return storedProfile
      ? JSON.parse(storedProfile)
      : {
          weight: 70, // default weight in kg
          heightFeet: 5, // default height in feet
          heightInches: 7, // default height in inches
          heightCm: 170, // store equivalent in cm for calculations
          gender: 'male', // default gender
          age: 30, // default age
          fitnessLevel: 'intermediate' // default fitness level
        };
  });

  // Handle unit preference changes
  const handleUnitChange = useCallback((metric, value) => {
    setUnitPreferences(prev => {
      const updated = {
        ...prev,
        [metric]: value
      };
      
      // Save preferences to localStorage
      localStorage.setItem('unitPreferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Update a specific profile field
   */
  const handleProfileChange = useCallback((field, value) => {
    setUserProfile((prev) => {
      // Allow empty string for numeric inputs to enable proper deletion
      const parsedValue = value === '' ? '' : field === 'weight' || field === 'heightFeet' || field === 'heightInches' || field === 'heightCm' || field === 'age' 
        ? value === 0 || value ? Number(value) : ''  // Convert to number if not empty and is a numeric field
        : value;
      
      const updated = {
        ...prev,
        [field]: parsedValue
      };
      
      // If feet or inches are updated, also update the cm value
      if ((field === 'heightFeet' || field === 'heightInches') && parsedValue !== '') {
        const feet = field === 'heightFeet' ? parsedValue : prev.heightFeet || 0;
        const inches = field === 'heightInches' ? parsedValue : prev.heightInches || 0;
        updated.heightCm = Math.round((feet * 30.48) + (inches * 2.54));
      }
      
      // If cm is updated, also update feet and inches for consistency
      if (field === 'heightCm' && parsedValue !== '') {
        const totalInches = parsedValue / 2.54;
        updated.heightFeet = Math.floor(totalInches / 12);
        updated.heightInches = Math.round(totalInches % 12);
      }
      
      return updated;
    });
  }, []);

  /**
   * Save profile to local storage
   */
  const handleProfileSubmit = useCallback(() => {
    // Ensure all numeric values are numbers, not empty strings
    const finalProfile = {...userProfile};
    
    // Convert empty strings to appropriate defaults
    if (finalProfile.weight === '') finalProfile.weight = 70;
    if (finalProfile.heightCm === '') finalProfile.heightCm = 170;
    if (finalProfile.heightFeet === '') finalProfile.heightFeet = 5;
    if (finalProfile.heightInches === '') finalProfile.heightInches = 7;
    if (finalProfile.age === '') finalProfile.age = 30;
    
    // Save to local storage for persistence
    localStorage.setItem('userProfile', JSON.stringify(finalProfile));
    setUserProfile(finalProfile);
    setShowProfileModal(false);
  }, [userProfile]);

  return {
    userProfile,
    setUserProfile,
    showProfileModal,
    setShowProfileModal,
    handleProfileChange,
    handleProfileSubmit,
    unitPreferences,
    handleUnitChange
  };
}; 