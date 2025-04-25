import { useState } from 'react';
import PropTypes from 'prop-types';
import { useWallet } from '../contexts/WalletContext';
import { getLnurlForTrack, processWavlakeLnurlPayment } from '../utils/wavlake';
import { IonSpinner, IonIcon, IonToast } from '@ionic/react';
import { flash } from 'ionicons/icons';

/**
 * WavlakeZap Component
 * Handles zapping artists on Wavlake content via LNURL
 * This component is separate from NostrZap to avoid using window.nostr for mobile compatibility
 * 
 * @param {Object} props
 * @param {string} props.trackId - The Wavlake track ID to zap
 * @param {number} [props.amount=100] - Amount in sats to zap (default: 100)
 * @param {string} [props.buttonText="Zap Artist"] - Text to display on the button
 * @param {string} [props.buttonClass=""] - Additional CSS classes for the button
 * @param {Function} [props.onSuccess] - Callback for successful zap
 * @param {Function} [props.onError] - Callback for zap error
 */
const WavlakeZap = ({ 
  trackId, 
  amount = 100, 
  buttonText = "Zap Artist",
  buttonClass = "",
  onSuccess,
  onError
}) => {
  const { wallet, isConnected, connectWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState('success');

  const handleZap = async () => {
    if (!trackId) {
      console.error('[WavlakeZap] No track ID provided');
      showError('No track ID provided');
      return;
    }

    if (!isConnected || !wallet) {
      try {
        await connectWallet();
      } catch (error) {
        console.error('[WavlakeZap] Failed to connect wallet:', error);
        showError('Failed to connect wallet. Please try again.');
        return;
      }
    }

    setIsLoading(true);
    try {
      // 1. Get LNURL for track
      console.log('[WavlakeZap] Getting LNURL for track:', trackId);
      const lnurl = await getLnurlForTrack(trackId);
      
      if (!lnurl) {
        throw new Error('Failed to get LNURL for track');
      }
      
      // 2. Process the payment
      console.log('[WavlakeZap] Processing payment with amount:', amount);
      const result = await processWavlakeLnurlPayment(lnurl, wallet, amount);
      
      console.log('[WavlakeZap] Payment successful:', result);
      showSuccess('Artist zapped successfully! ⚡');
      
      // Call success callback if provided
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (error) {
      console.error('[WavlakeZap] Zap failed:', error);
      showError(`Zap failed: ${error.message || 'Unknown error'}`);
      
      // Call error callback if provided
      if (onError && typeof onError === 'function') {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (message) => {
    setToastColor('success');
    setToastMessage(message);
    setShowToast(true);
  };

  const showError = (message) => {
    setToastColor('danger');
    setToastMessage(message);
    setShowToast(true);
  };

  return (
    <>
      <button
        className={`wavlake-zap-button ${buttonClass}`}
        onClick={handleZap}
        disabled={isLoading}
      >
        {isLoading ? (
          <IonSpinner name="dots" />
        ) : (
          <>
            <IonIcon icon={flash} /> {buttonText}
          </>
        )}
      </button>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        color={toastColor}
        position="bottom"
      />
    </>
  );
};

WavlakeZap.propTypes = {
  trackId: PropTypes.string.isRequired,
  amount: PropTypes.number,
  buttonText: PropTypes.string,
  buttonClass: PropTypes.string,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default WavlakeZap; 