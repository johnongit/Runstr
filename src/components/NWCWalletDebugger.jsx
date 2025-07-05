import React, { useState } from 'react';
import { useNWCWallet } from '../contexts/NWCWalletContext';
import { getWalletInstance, getConnectionState, getWalletAPI } from '../services/wallet/WalletPersistenceService';

export const NWCWalletDebugger = () => {
  const {
    isConnected,
    isConnecting,
    balance,
    loading,
    error,
    isInitialized,
    checkConnection,
    refreshWallet,
    makePayment,
    generateInvoice
  } = useNWCWallet();

  const [debugInfo, setDebugInfo] = useState('');
  const [testInvoice, setTestInvoice] = useState('');
  const [testAmount, setTestAmount] = useState('100');
  const [testResult, setTestResult] = useState('');

  const runDebugCheck = async () => {
    console.log('[NWCWalletDebugger] Running comprehensive debug check...');
    
    try {
      const walletInstance = getWalletInstance();
      const connectionState = getConnectionState();
      const walletAPI = getWalletAPI();
      
      // Test connection
      const connectionTest = await checkConnection();
      
      // Get stored credentials
      const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
      const savedConnectionString = localStorage.getItem('nwcConnectionString');
      
      let balanceTest;
      try {
        balanceTest = await walletAPI.getBalance();
      } catch (balanceError) {
        balanceTest = `Error: ${balanceError.message}`;
      }
      
      const debugData = {
        // Context state
        contextState: {
          isConnected,
          isConnecting,
          balance,
          loading,
          error,
          isInitialized
        },
        
        // Service state
        serviceState: {
          hasWalletInstance: !!walletInstance,
          connectionState,
          hasWalletAPI: !!walletAPI
        },
        
        // Storage state
        storageState: {
          hasAuthUrl: !!savedAuthUrl,
          authUrlLength: savedAuthUrl ? savedAuthUrl.length : 0,
          hasConnectionString: !!savedConnectionString,
          connectionStringLength: savedConnectionString ? savedConnectionString.length : 0
        },
        
        // Test results
        testResults: {
          connectionTest,
          balanceTest
        },
        
        // Wallet instance details
        walletDetails: walletInstance ? {
          isConnected: walletInstance.isConnected,
          hasNwcClient: !!walletInstance.nwcClient,
          hasLnClient: !!walletInstance.lnClient,
          connectionString: walletInstance.connectionString ? 'Present' : 'Missing',
          authUrl: walletInstance.authUrl ? 'Present' : 'Missing'
        } : null,
        
        // Timestamps
        timestamp: new Date().toISOString()
      };
      
      setDebugInfo(JSON.stringify(debugData, null, 2));
      console.log('[NWCWalletDebugger] Debug data:', debugData);
      
    } catch (error) {
      console.error('[NWCWalletDebugger] Debug check error:', error);
      setDebugInfo(`Debug check failed: ${error.message}`);
    }
  };

  const testInvoiceGeneration = async () => {
    if (!testAmount || isNaN(parseInt(testAmount))) {
      setTestResult('Please enter a valid amount');
      return;
    }
    
    try {
      setTestResult('Generating invoice...');
      const invoice = await generateInvoice(parseInt(testAmount), 'Test invoice');
      setTestResult(`Invoice generated successfully:\n${invoice}`);
      console.log('[NWCWalletDebugger] Invoice generated:', invoice);
    } catch (error) {
      console.error('[NWCWalletDebugger] Invoice generation error:', error);
      setTestResult(`Invoice generation failed: ${error.message}`);
    }
  };

  const testPayment = async () => {
    if (!testInvoice) {
      setTestResult('Please enter an invoice to test');
      return;
    }
    
    try {
      setTestResult('Testing payment...');
      const result = await makePayment(testInvoice);
      setTestResult(`Payment test successful:\n${JSON.stringify(result, null, 2)}`);
      console.log('[NWCWalletDebugger] Payment test result:', result);
    } catch (error) {
      console.error('[NWCWalletDebugger] Payment test error:', error);
      setTestResult(`Payment test failed: ${error.message}`);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem('nwcAuthUrl');
    localStorage.removeItem('nwcConnectionString');
    setTestResult('Storage cleared. Please refresh the page.');
  };

  return (
    <div className="nwc-wallet-debugger" style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #333',
      borderRadius: '8px',
      backgroundColor: '#1a1a1a',
      color: '#ffffff'
    }}>
      <h3>NWC Wallet Debugger</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <h4>Quick Status</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>Connected: {isConnected ? '✅' : '❌'}</div>
          <div>Loading: {loading ? '🔄' : '✅'}</div>
          <div>Balance: {balance} sats</div>
          <div>Error: {error || 'None'}</div>
          <div>Initialized: {isInitialized ? '✅' : '❌'}</div>
          <div>Connecting: {isConnecting ? '🔄' : '✅'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Actions</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={runDebugCheck}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Run Debug Check
          </button>
          <button 
            onClick={refreshWallet}
            style={{
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Wallet
          </button>
          <button 
            onClick={clearStorage}
            style={{
              padding: '8px 16px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Storage
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Test Invoice Generation</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            placeholder="Amount in sats"
            style={{
              padding: '8px',
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px'
            }}
          />
          <button 
            onClick={testInvoiceGeneration}
            disabled={!isConnected}
            style={{
              padding: '8px 16px',
              background: isConnected ? '#17a2b8' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed'
            }}
          >
            Generate Test Invoice
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Test Payment</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={testInvoice}
            onChange={(e) => setTestInvoice(e.target.value)}
            placeholder="BOLT11 Invoice"
            style={{
              padding: '8px',
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              minWidth: '200px'
            }}
          />
          <button 
            onClick={testPayment}
            disabled={!isConnected || !testInvoice}
            style={{
              padding: '8px 16px',
              background: (isConnected && testInvoice) ? '#ffc107' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (isConnected && testInvoice) ? 'pointer' : 'not-allowed'
            }}
          >
            Test Payment
          </button>
        </div>
      </div>

      {testResult && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Test Result</h4>
          <pre style={{
            background: '#333',
            padding: '10px',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            fontSize: '12px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {testResult}
          </pre>
        </div>
      )}

      {debugInfo && (
        <div>
          <h4>Debug Information</h4>
          <pre style={{
            background: '#333',
            padding: '10px',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            fontSize: '12px',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {debugInfo}
          </pre>
        </div>
      )}
    </div>
  );
}; 