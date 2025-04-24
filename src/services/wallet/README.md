# Wallet Implementation

## Overview

This directory contains the lightning wallet integration for the RUNSTR application, focusing on NWC (Nostr Wallet Connect) functionality using the Alby JS SDK.

## Key Components

- **AlbyWallet**: Core implementation using the Alby SDK for wallet operations
- **WalletContext**: React context managing wallet state and operations
- **NWCWalletConnector**: UI component for connecting to NWC wallets

## Features

- **Connection Management**: Connect with NWC URLs and authorization URLs
- **Persistent Connection**: Save and restore wallet connection between sessions
- **Auto-reconnection**: Automatically reconnect on connection loss
- **Balance Checking**: Fetch and display wallet balance
- **Payment Processing**: Pay lightning invoices
- **Invoice Generation**: Create invoices with support for zaps
- **Error Handling**: Comprehensive error handling with timeouts and fallbacks

## Usage

### Connecting a Wallet

```jsx
import { useWallet } from '../services/wallet';

function MyComponent() {
  const { connectWithUrl, isConnected } = useWallet();
  
  const handleConnect = async () => {
    const url = 'nostr+walletconnect://...';
    await connectWithUrl(url);
  };
  
  return (
    <div>
      {isConnected ? (
        <div>Wallet connected!</div>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Making Payments

```jsx
import { useWallet } from '../services/wallet';

function PaymentComponent() {
  const { wallet, isConnected, ensureConnected } = useWallet();
  
  const handlePayment = async (invoice) => {
    if (!isConnected) {
      await ensureConnected();
    }
    
    try {
      const result = await wallet.makePayment(invoice);
      console.log('Payment successful!', result);
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };
  
  return (
    <button onClick={() => handlePayment('lnbc...')}>
      Pay Invoice
    </button>
  );
}
```

### Creating Zap Invoices

```jsx
import { useWallet } from '../services/wallet';

function ZapComponent({ pubkey }) {
  const { generateZapInvoice, isConnected } = useWallet();
  
  const handleZap = async () => {
    if (!isConnected) return;
    
    try {
      const amount = 1000; // 1000 sats
      const comment = 'Great post!';
      const invoice = await generateZapInvoice(pubkey, amount, comment);
      console.log('Zap invoice created:', invoice);
    } catch (error) {
      console.error('Failed to create zap invoice:', error);
    }
  };
  
  return (
    <button onClick={handleZap} disabled={!isConnected}>
      Zap 1000 sats
    </button>
  );
}
```

## Implementation Notes

1. The wallet uses Alby's NWC and LN clients in combination for best functionality
2. Connection state is maintained in local storage for persistence
3. Multiple fallback methods for zap requests to handle different wallet implementations
4. Periodic connection checks ensure wallet stays connected
5. All wallet operations return Promises for flexible handling 