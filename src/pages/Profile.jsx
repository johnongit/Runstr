import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunProfile } from '../hooks/useRunProfile';
import { publishHealthProfile } from '../utils/nostrHealth';
import '../assets/styles/profile.css';

export const Profile = () => {
  const navigate = useNavigate();
  
  // State for Nostr publishing
  const [isPublishing, setIsPublishing] = useState(false);
  const [unitPreferences, setUnitPreferences] = useState({
    weight: 'kg',
    height: 'metric'
  });
  
  // Get user profile from custom hook
  const { 
    userProfile: profile,
    handleProfileChange, 
    handleProfileSubmit: saveProfile
  } = useRunProfile();

  // Handle unit toggle
  const handleUnitChange = useCallback((metric, value) => {
    setUnitPreferences(prev => ({
      ...prev,
      [metric]: value
    }));
  }, []);

  // Custom submit handler that navigates back after saving
  const handleProfileSubmit = () => {
    saveProfile();
    navigate('/history'); // Navigate back to RunHistory after saving
  };

  // Handle publishing health profile to Nostr
  const handlePublishToNostr = async () => {
    setIsPublishing(true);
    
    try {
      // Publish health profile to Nostr
      const result = await publishHealthProfile(profile, unitPreferences);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Health profile published to Nostr! (${result.published}/${result.totalMetrics} metrics)`);
      } else {
        alert(`Health profile published to Nostr! (${result.published}/${result.totalMetrics} metrics)`);
      }
    } catch (error) {
      console.error('Error publishing health profile to Nostr:', error);
      
      // Show error message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to publish profile: ' + error.message);
      } else {
        alert('Failed to publish profile: ' + error.message);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="profile-page">
      <h2 className="text-2xl font-bold mb-6">User Profile</h2>
      <p className="text-gray-400 mb-6">Update your profile for accurate calorie calculations</p>
      
      <div className="form-container">
        <div className="form-group">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="weight">Weight</label>
            <div className="unit-toggle">
              <button
                type="button"
                className={`unit-button ${unitPreferences.weight === 'kg' ? 'active' : ''}`}
                onClick={() => handleUnitChange('weight', 'kg')}
              >
                kg
              </button>
              <button
                type="button"
                className={`unit-button ${unitPreferences.weight === 'lb' ? 'active' : ''}`}
                onClick={() => handleUnitChange('weight', 'lb')}
              >
                lb
              </button>
            </div>
          </div>
          <input
            id="weight"
            type="number"
            value={profile.weight}
            onChange={(e) => handleProfileChange('weight', Number(e.target.value))}
          />
        </div>
        
        <div className="form-group height-inputs">
          <div className="flex justify-between items-center mb-2">
            <label>Height</label>
            <div className="unit-toggle">
              <button
                type="button"
                className={`unit-button ${unitPreferences.height === 'metric' ? 'active' : ''}`}
                onClick={() => handleUnitChange('height', 'metric')}
              >
                cm
              </button>
              <button
                type="button"
                className={`unit-button ${unitPreferences.height === 'imperial' ? 'active' : ''}`}
                onClick={() => handleUnitChange('height', 'imperial')}
              >
                ft/in
              </button>
            </div>
          </div>
          <div className="height-fields">
            <div className="height-field">
              <input
                id="heightFeet"
                type="number"
                min="0"
                max="8"
                value={profile.heightFeet}
                onChange={(e) => handleProfileChange('heightFeet', Number(e.target.value))}
              />
              <label htmlFor="heightFeet">ft</label>
            </div>
            <div className="height-field">
              <input
                id="heightInches"
                type="number"
                min="0"
                max="11"
                value={profile.heightInches}
                onChange={(e) => handleProfileChange('heightInches', Number(e.target.value))}
              />
              <label htmlFor="heightInches">in</label>
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            value={profile.gender}
            onChange={(e) => handleProfileChange('gender', e.target.value)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            value={profile.age}
            onChange={(e) => handleProfileChange('age', Number(e.target.value))}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="fitnessLevel">Fitness Level</label>
          <select
            id="fitnessLevel"
            value={profile.fitnessLevel}
            onChange={(e) => handleProfileChange('fitnessLevel', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        
        <div className="form-buttons">
          <button 
            className="save-button"
            onClick={handleProfileSubmit}
          >
            Save Profile
          </button>
          <button 
            className="nostr-button"
            onClick={handlePublishToNostr}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Save Health Profile to Nostr'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => navigate('/history')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}; 