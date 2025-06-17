import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';

export const Wallet = () => {
  const navigate = useNavigate();
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());

  // Remove automatic redirect - let users choose their wallet type

  // Set the zapAmountInput whenever defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
    }
  };

  return (
    <div className="wallet-container">
      <div className="wallet-selection-section">
        <h2>Wallet Options</h2>
        <p>Choose your preferred wallet type for zaps, payments, and receiving rewards.</p>
        
        <div className="wallet-options">
          <div className="wallet-option">
            <h3>⚡ Lightning Wallet (NWC)</h3>
            <p>Connect your Lightning wallet using Nostr Wallet Connect. Send zaps and make instant Bitcoin payments.</p>
            <button 
              onClick={() => navigate('/nwc')}
              className="wallet-option-button"
            >
              Open Lightning Wallet
            </button>
          </div>

          <div className="wallet-option">
            <h3>🔒 Ecash Wallet (NIP-60)</h3>
            <p>Private ecash tokens with Cashu mints. Send and receive tokens privately with cross-device sync.</p>
            <button 
              onClick={() => navigate('/ecash')}
              className="wallet-option-button ecash-button"
            >
              Open Ecash Wallet
            </button>
          </div>
        </div>
      </div>

      <div className="zap-settings-section">
        <h3>Zap Settings</h3>
        <div className="zap-amount-setting">
          <label htmlFor="defaultZapAmount">Default Zap Amount (sats):</label>
          <div className="input-with-button">
            <input
              id="defaultZapAmount"
              type="number"
              min="1"
              value={zapAmountInput}
              onChange={(e) => setZapAmountInput(e.target.value)}
              placeholder="Default zap amount in sats"
            />
            <button 
              onClick={handleUpdateZapAmount} 
              disabled={!zapAmountInput || parseInt(zapAmountInput, 10) <= 0}
              className="save-button"
            >
              Save
            </button>
          </div>
          <p className="current-setting">Current default: {defaultZapAmount} sats</p>
        </div>
      </div>
    </div>
  );
};
