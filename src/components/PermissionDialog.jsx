import { useState, useContext, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext';

export const PermissionDialog = ({ onContinue, onCancel }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { requestNostrPermissions } = useContext(NostrContext);

  const handleContinue = async () => {
    setIsProcessing(true);
    
    try {
      // This will show the Amber Signer dialog
      if (window.nostr) {
        const nostrSuccess = await requestNostrPermissions();
        if (!nostrSuccess) {
          console.warn('Failed to get Nostr permissions');
        }
      }
      
      // Mark dialog as completed regardless of Nostr result
      // Location permissions will be requested by the BackgroundGeolocation plugin
      setIsVisible(false);
      if (onContinue) onContinue();
    } catch (error) {
      console.error('Error during permission request:', error);
      alert('There was an error requesting permissions. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCancel = useCallback(() => {
    setIsVisible(false);
    if (onCancel) onCancel();
  }, [onCancel]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) handleCancel();
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [handleCancel]);

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content permission-dialog">
        <h3>Welcome to Runstr!</h3>
        
        <p>This privacy-focused app keeps your data private and under your control.</p>
        
        <p>To use the app, we need these permissions:</p>
        
        <div className="permission-item">
          <h4>1. Location Access</h4>
          <p>This allows us to accurately track your runs, measure your distance, calculate your pace, and map your routes. Your location data is stored ONLY on your device and is never sold or shared with third parties.</p>
        </div>
        
        <div className="permission-item">
          <h4>2. Amber Signer Trust</h4>
          <p>The app requires basic permission in Amber Signer when prompted. This secure connection lets you safely share your runs on Nostr only when YOU choose to do so. Only minimal permissions are needed - you don&apos;t need to grant full trust.</p>
        </div>
        
        <p>We do not harvest or sell your data. Your privacy is our priority - all tracking information remains on your device unless you explicitly choose to share it.</p>
        
        <p>Without these permissions, key features like complete run tracking, route mapping, and optional social sharing won&apos;t be available.</p>
        
        <p className="permission-footer">Ready to run with Nostr?</p>
        
        <div className="modal-buttons">
          <button 
            className="primary-btn" 
            onClick={handleContinue}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Continue'}
          </button>
          <button 
            className="secondary-btn" 
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

PermissionDialog.propTypes = {
  onContinue: PropTypes.func,
  onCancel: PropTypes.func
}; 