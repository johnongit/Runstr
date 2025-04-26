import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { WalletContext } from '../contexts/WalletContext';
import { getLnurlForTrack, processWavlakeLnurlPayment } from '../utils/wavlake';
import '../assets/styles/WavlakeZap.css';

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
  const { wallet, isConnected, ensureConnected } = useContext(WalletContext);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);

  const handleZap = async () => {
    if (!trackId) {
      console.error('[WavlakeZap] No track ID provided');
      if (onError) onError(new Error('No track ID provided'));
      return;
    }

    if (!wallet) {
      console.error('[WavlakeZap] No wallet available');
      if (onError) onError(new Error('Lightning wallet not connected. Connect wallet in settings.'));
      return;
    }

    // Immediately assume success (optimistic UI)
    setIsProcessing(true);
    setHasErrored(false);
    
    // If onSuccess callback is provided, call it immediately for parent components to update UI
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess({ optimistic: true });
    }

    try {
      // Run the payment process in the background
      // First ensure wallet is connected
      if (!isConnected) {
        console.log('[WavlakeZap] Wallet not connected, attempting to connect...');
        const connected = await ensureConnected();
        if (!connected) {
          throw new Error('Failed to connect wallet. Please try again.');
        }
      }
      
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
      
      // Call success callback again with actual result (for components that might need the real response)
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess({ ...result, optimistic: false });
      }
    } catch (error) {
      console.error('[WavlakeZap] Zap failed:', error);
      
      // Revert optimistic UI update
      setHasErrored(true);
      
      // Call error callback if provided
      if (onError && typeof onError === 'function') {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Different button states
  const buttonContent = () => {
    if (hasErrored) {
      return <span className="zap-error">⚠️</span>;
    }
    
    if (isProcessing) {
      return <span className="zap-success-icon">⚡</span>;
    }
    
    return (
      <>
        <span className="zap-icon">⚡</span> {buttonText}
      </>
    );
  };

  return (
    <button
      className={`wavlake-zap-button ${buttonClass} ${hasErrored ? 'zap-error-state' : ''} ${isProcessing ? 'zap-success-state' : ''}`}
      onClick={handleZap}
      disabled={isProcessing}
    >
      {buttonContent()}
    </button>
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