import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNip60 } from '../contexts/WalletContext';

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
    currentMint,
    refreshWallet
  } = useNip60();

  // Add debugging
  console.log('[DashboardWalletHeader] Wallet State:', {
    hasWallet: isConnected,
    balance,
    loading,
    isInitialized,
    currentMint: currentMint?.name,
    tokenCount: transactions?.length || 0,
    walletEvent: !!hasWallet,
    error: error
  });

  // Auto-refresh if we're initialized but don't have a wallet
  // This handles cases where different hook instances get different results
  useEffect(() => {
    if (isInitialized && !isConnected && !loading && !error) {
      console.log('[DashboardWalletHeader] Wallet state seems inconsistent, refreshing...');
      refreshWallet();
    }
  }, [isInitialized, isConnected, loading, error, refreshWallet]);

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
               'Wallet Not Initialized'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/ecash')}
            disabled={loading}
          >
            {loading ? '...' : 'Initialize Wallet'}
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
            <h3>Send</h3>
            <p>To send sats, you'll be redirected to the full wallet interface.</p>
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
            <h3>Receive</h3>
            <p>To receive sats, share your information or visit the full wallet page.</p>
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