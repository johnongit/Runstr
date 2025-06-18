import { useState } from 'react';

export const DashboardWalletHeader = () => {
  // Temporary state for UI development - will be replaced with actual wallet integration
  const [balance] = useState(1250); // Mock balance for now
  const [isConnected] = useState(true); // Mock connection state

  const handleSend = () => {
    console.log('Send clicked');
    // Will wire up to send modal later
  };

  const handleReceive = () => {
    console.log('Receive clicked');
    // Will wire up to receive modal later
  };

  const handleHistory = () => {
    console.log('History clicked');
    // Will wire up to transaction history later
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
            <span className="status-text">Wallet Disconnected</span>
          </div>
          <button className="connect-button">
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wallet-header">
      <div className="wallet-card">
        <div className="balance-section">
          <div className="balance-amount">{formatBalance(balance)}</div>
          <div className="balance-unit">sats</div>
        </div>
        
        <div className="wallet-actions">
          <button className="action-button send-button" onClick={handleSend}>
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
  );
}; 