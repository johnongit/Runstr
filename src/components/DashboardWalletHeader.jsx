import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNip60Wallet } from '../hooks/useNip60Wallet';

export const DashboardWalletHeader = () => {
  const navigate = useNavigate();
  const { 
    balance, 
    hasWallet: isConnected, 
    loading,
    error,
    isInitialized,
    tokenEvents: transactions,
    SUPPORTED_MINTS,
    currentMint
  } = useNip60Wallet();

  // Add debugging
  console.log('[DashboardWalletHeader] Wallet State:', {
    hasWallet: isConnected,
    balance,
    loading,
    isInitialized,
    currentMint: currentMint?.name,
    tokenCount: transactions?.length || 0
  });

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

  // Handle sending tokens from dashboard - redirect to full wallet
  const handleSendTokens = async () => {
    // Close modal and navigate to full wallet for sending
    setShowSendModal(false);
    navigate('/ecash');
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
              {loading ? 'Checking for wallet...' : 
               'Ecash Wallet Disconnected'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/ecash')}
            disabled={loading}
          >
            {loading ? '...' : 'Connect'}
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
            <p>To send tokens, you'll be redirected to the full NIP-60 wallet interface.</p>
            <p><strong>Balance:</strong> {balance.toLocaleString()} sats</p>
            
            <div className="modal-buttons">
              <button 
                onClick={() => setShowSendModal(false)}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendTokens}
                className="send-confirm-button"
              >
                Open Full Wallet
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