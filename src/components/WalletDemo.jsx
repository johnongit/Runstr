import { DashboardWalletHeader } from './DashboardWalletHeader';

export const WalletDemo = () => {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#1a1a1a', 
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ color: '#fff', textAlign: 'center', marginBottom: '30px' }}>
        RUNSTR Dashboard Wallet Header Demo
      </h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#ccc', fontSize: '1.2rem', marginBottom: '10px' }}>
          New Wallet Header (replaces #RUNSTR)
        </h2>
        <DashboardWalletHeader />
      </div>

      <div style={{ 
        backgroundColor: '#242424', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #333',
        color: '#ccc'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '15px' }}>Implementation Summary:</h3>
        <ul style={{ lineHeight: '1.6' }}>
          <li>✅ <strong>Removed:</strong> #RUNSTR branding from dashboard top</li>
          <li>✅ <strong>Added:</strong> Prominent balance display (2.2rem font size)</li>
          <li>✅ <strong>Minimalistic design:</strong> No emojis, clean typography</li>
          <li>✅ <strong>Action buttons:</strong> Send, Receive, Transaction History (hamburger menu)</li>
          <li>✅ <strong>Mobile responsive:</strong> Adapts to different screen sizes</li>
          <li>✅ <strong>Disconnected state:</strong> Shows connect button when wallet not connected</li>
          <li>✅ <strong>Ready for rewards:</strong> Balance will update when rewards are sent</li>
        </ul>
        
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #333' }}>
          <p><strong>Next Steps:</strong></p>
          <ol style={{ marginTop: '10px', lineHeight: '1.6' }}>
            <li>Wire up actual NIP60 wallet functionality (currently shows mock data)</li>
            <li>Connect send/receive modals</li>
            <li>Implement transaction history drawer</li>
            <li>Integrate with rewards payout system</li>
          </ol>
        </div>
      </div>
    </div>
  );
}; 