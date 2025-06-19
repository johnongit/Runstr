import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcashWallet } from '../contexts/EcashWalletContext';

export const DashboardWalletHeader = () => {
  const navigate = useNavigate();
  const { 
    balance, 
    isConnected, 
    isConnecting,
    isLoadingExisting,
    sendTokens,
    transactions,
    SUPPORTED_MINTS,
    getEffectiveMintUrl
  } = useEcashWallet();

  // Send Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Receive Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const handleSend = () => {
    if (!isConnected) {
      navigate('/ecash');
      return;
    }
    setShowSendModal(true);
  };

  const handleReceive = () => {
    if (!isConnected) {
      navigate('/ecash');
      return;
    }
    setShowReceiveModal(true);
  };

  const handleHistory = () => {
    navigate('/ecash');
  };

  // Handle sending tokens from dashboard
  const handleSendTokens = async () => {
    if (!sendAmount || !sendRecipient) {
      setSendError('Please fill in all required fields');
      return;
    }

    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      setSendError('Insufficient balance');
      return;
    }

    setIsSending(true);
    setSendError('');

    try {
      await sendTokens(sendRecipient, amount, sendMemo);
      
      // Reset form and close modal
      setSendAmount('');
      setSendRecipient('');
      setSendMemo('');
      setShowSendModal(false);
      
    } catch (error) {
      setSendError(`Failed to send tokens: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const formatBalance = (sats) => {
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k`;
    }
    return sats.toString();
  };

  if (!isConnected) {
    return (
      <div className="dashboard-wallet-header">
        <div className="wallet-card disconnected">
          <div className="wallet-status">
            <span className="status-text">
              {isLoadingExisting ? 'Checking for wallet...' : 
               isConnecting ? 'Connecting...' : 
               'Ecash Wallet Disconnected'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/ecash')}
            disabled={isLoadingExisting || isConnecting}
          >
            {isLoadingExisting || isConnecting ? '...' : 'Connect'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-wallet-header">
        <div className="wallet-card">
          <div className="balance-section">
            <div className="balance-amount">{formatBalance(balance)}</div>
            <div className="balance-unit">sats</div>
          </div>
          
          <div className="wallet-actions">
            <button 
              className="action-button send-button" 
              onClick={handleSend}
              disabled={balance <= 0}
            >
              Send
            </button>
            <button className="action-button receive-button" onClick={handleReceive}>
              Receive
            </button>
            <button className="action-button history-button" onClick={handleHistory}>
              <span className="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Send Ecash Tokens</h3>
            
            <div className="form-group">
              <label>Recipient (pubkey/npub):</label>
              <input
                type="text"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="npub... or hex pubkey"
                className="modal-input"
              />
            </div>

            <div className="form-group">
              <label>Amount (sats):</label>
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0"
                min="1"
                max={balance}
                className="modal-input"
              />
              <small>Available: {balance.toLocaleString()} sats</small>
            </div>

            <div className="form-group">
              <label>Memo (optional):</label>
              <input
                type="text"
                value={sendMemo}
                onChange={(e) => setSendMemo(e.target.value)}
                placeholder="Payment description"
                className="modal-input"
              />
            </div>

            {sendError && (
              <div className="error-message">{sendError}</div>
            )}

            <div className="modal-buttons">
              <button 
                onClick={() => setShowSendModal(false)}
                className="cancel-button"
                disabled={isSending}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTokens}
                className="send-confirm-button"
                disabled={isSending || !sendAmount || !sendRecipient}
              >
                {isSending ? 'Sending...' : `Send ${sendAmount || 0} sats`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Receive Ecash Tokens</h3>
            <p>To receive tokens, share your information or visit the full wallet page.</p>
            <div className="modal-buttons">
              <button 
                onClick={() => setShowReceiveModal(false)}
                className="cancel-button"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setShowReceiveModal(false);
                  navigate('/ecash');
                }}
                className="receive-full-button"
              >
                Open Full Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 