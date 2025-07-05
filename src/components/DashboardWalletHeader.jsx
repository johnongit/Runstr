import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNWCWallet } from '../contexts/NWCWalletContext';
import { NostrContext } from '../contexts/NostrContext';

export const DashboardWalletHeader = () => {
  const navigate = useNavigate();
  const { ndk, publicKey } = useContext(NostrContext);
  const { 
    balance, 
    isConnected, 
    loading,
    error,
    isInitialized,
    refreshWallet,
    makePayment,
    generateInvoice
  } = useNWCWallet();

  // Add debugging
  console.log('[DashboardWalletHeader] NWC Wallet State:', {
    isConnected,
    balance,
    loading,
    isInitialized,
    error: error
  });

  // Auto-refresh if we're initialized but don't have a wallet
  useEffect(() => {
    if (isInitialized && !isConnected && !loading && !error) {
      console.log('[DashboardWalletHeader] Wallet state seems inconsistent, refreshing...');
      refreshWallet();
    }
  }, [isInitialized, isConnected, loading, error, refreshWallet]);

  // Send Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendInvoice, setSendInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  // Receive Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveInvoice, setReceiveInvoice] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveSuccess, setReceiveSuccess] = useState('');

  const handleSend = () => {
    if (!isConnected) {
      navigate('/nwc');
      return;
    }
    setShowSendModal(true);
  };

  const handleReceive = () => {
    if (!isConnected) {
      navigate('/nwc');
      return;
    }
    setShowReceiveModal(true);
  };

  const handleHistory = () => {
    navigate('/nwc');
  };

  // Handle sending Lightning payments
  const handleSendLightning = async () => {
    if (!sendAmount || !sendInvoice) {
      setSendError('Please enter both amount and invoice');
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
    setSendSuccess('');

    try {
      console.log('[DashboardWalletHeader] Making Lightning payment...');
      const result = await makePayment(sendInvoice);
      
      if (result) {
        setSendSuccess(`Successfully sent ${amount} sats!`);
        
        // Refresh wallet after sending
        setTimeout(() => {
          refreshWallet();
          setShowSendModal(false);
          setSendAmount('');
          setSendInvoice('');
          setSendSuccess('');
        }, 2000);
      } else {
        throw new Error('Payment failed');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Send error:', error);
      setSendError(`Failed to send payment: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle receiving Lightning payments
  const handleRequestInvoice = async () => {
    if (!receiveAmount) {
      setReceiveError('Please enter an amount');
      return;
    }

    const amount = parseInt(receiveAmount);
    if (isNaN(amount) || amount <= 0) {
      setReceiveError('Please enter a valid amount');
      return;
    }

    setIsReceiving(true);
    setReceiveError('');

    try {
      console.log('[DashboardWalletHeader] Generating Lightning invoice...');
      const invoice = await generateInvoice(amount, `Invoice for ${amount} sats`);
      
      if (invoice) {
        setReceiveInvoice(invoice);
        setReceiveSuccess(`Invoice created for ${amount} sats`);
      } else {
        throw new Error('Failed to generate invoice');
      }

    } catch (error) {
      console.error('[DashboardWalletHeader] Invoice error:', error);
      setReceiveError(`Failed to create invoice: ${error.message}`);
    } finally {
      setIsReceiving(false);
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
              {loading ? 'Checking for wallet...' : 'NWC Wallet Not Connected'}
            </span>
          </div>
          <button 
            className="connect-button"
            onClick={() => navigate('/nwc')}
            disabled={loading}
          >
            {loading ? '...' : 'Connect Wallet'}
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
            <h3>Send Lightning Payment</h3>
            <p><strong>Available Balance:</strong> {balance.toLocaleString()} sats</p>
            
            {sendError && (
              <div className="error-message" style={{ 
                background: 'rgba(255, 99, 99, 0.2)', 
                color: '#ff6363', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}>
                {sendError}
              </div>
            )}

            {sendSuccess && (
              <div className="success-message" style={{ 
                background: 'rgba(99, 255, 99, 0.2)', 
                color: '#63ff63', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}>
                {sendSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Lightning Invoice (BOLT11):
              </label>
              <textarea
                value={sendInvoice}
                onChange={(e) => setSendInvoice(e.target.value)}
                placeholder="lnbc..."
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Amount (sats):
              </label>
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0"
                min="1"
                max={balance}
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div className="modal-actions" style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <button 
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
                style={{ 
                  padding: '8px 16px', 
                  background: 'var(--background-secondary)', 
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendLightning}
                disabled={isSending || !sendAmount || !sendInvoice}
                style={{ 
                  padding: '8px 16px', 
                  background: '#ff6b35', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isSending ? 'Sending...' : 'Send Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Receive Lightning Payment</h3>
            
            {receiveError && (
              <div className="error-message" style={{ 
                background: 'rgba(255, 99, 99, 0.2)', 
                color: '#ff6363', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}>
                {receiveError}
              </div>
            )}

            {receiveSuccess && (
              <div className="success-message" style={{ 
                background: 'rgba(99, 255, 99, 0.2)', 
                color: '#63ff63', 
                padding: '8px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                fontSize: '0.9rem'
              }}>
                {receiveSuccess}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                Amount (sats):
              </label>
              <input
                type="number"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                placeholder="0"
                min="1"
                disabled={isReceiving}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {receiveInvoice && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                  Lightning Invoice:
                </label>
                <textarea
                  value={receiveInvoice}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--background-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(receiveInvoice)}
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    background: 'var(--background-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Copy Invoice
                </button>
              </div>
            )}

            <div className="modal-actions" style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <button 
                onClick={() => setShowReceiveModal(false)}
                disabled={isReceiving}
                style={{ 
                  padding: '8px 16px', 
                  background: 'var(--background-secondary)', 
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button 
                onClick={handleRequestInvoice}
                disabled={isReceiving || !receiveAmount}
                style={{ 
                  padding: '8px 16px', 
                  background: '#4CAF50', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isReceiving ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 