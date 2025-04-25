# Lightning Wallet Integration for RUNSTR

This directory contains the lightning wallet integration for the RUNSTR application, focusing on NWC (Nostr Wallet Connect) functionality using the Alby JS SDK.

## Components

- **AlbyWallet**: Core wallet implementation using both the NWC and LN clients from the Alby SDK
- **NWCWalletConnector**: UI component for connecting to NWC wallets

## Features

- **Connection Management**: Connect with NWC URLs and authorization URLs
- **Zap Support**: Create and pay Lightning invoices, including zap requests
- **Persistence**: Automatically reconnect to previously connected wallets
- **Connection Monitoring**: Periodically check connection status and handle reconnection

## AlbyWallet Class

The `AlbyWallet` class is designed to provide a reliable Lightning wallet implementation with several key features:

### Key Methods

- `connect(url)`: Connect to a wallet using a NWC URL or authorization URL
- `disconnect()`: Disconnect from the wallet
- `makePayment(invoice)`: Pay a BOLT11 invoice
- `generateInvoice(amount, memo)`: Create a new Lightning invoice
- `generateZapInvoice(pubkey, amount, content)`: Create a zap invoice for a specific Nostr pubkey
- `getBalance()`: Get the wallet balance in sats
- `checkConnection()`: Verify the wallet connection is still active
- `ensureConnected()`: Check connection and attempt reconnection if needed

### Connection Types

The wallet supports two connection methods:

1. **Direct NWC URLs** (`nostr+walletconnect://...`): Standard NWC connection URLs
2. **Authorization URLs** (`https://...`): Used by some wallets like Alby

### Design Decisions

1. **Dual-Client Approach**: The wallet uses Alby's NWC and LN clients in combination for best functionality
2. **Fallback Mechanisms**: If primary payment methods fail, alternative approaches are used
3. **Auto-Reconnection**: The wallet attempts to reconnect automatically when connection is lost
4. **Multiple Zap Invoice Formats**: Supports various zap request formats for wider wallet compatibility

## NWCWalletConnector Component

The `NWCWalletConnector` component provides a user interface for:

1. Connecting to NWC-compatible wallets
2. Managing default zap amounts
3. Supporting the RUNSTR project with donations
4. Checking wallet connection status 