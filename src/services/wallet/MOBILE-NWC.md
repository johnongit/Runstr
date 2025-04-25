# Mobile NWC Implementation in RUNSTR

## Overview

RUNSTR is primarily a mobile application targeting Android and GrapheneOS platforms. This document explains how Nostr Wallet Connect (NWC) is implemented in the mobile context, specifically addressing the challenges of signing Nostr events on mobile devices.

## Key Components

### 1. Platform Detection

The application uses a React Native shim to detect the platform:

```javascript
import { Platform } from '../utils/react-native-shim';

// Check if running on Android
if (Platform.OS === 'android') {
  // Use mobile-specific implementation
}
```

### 2. Dual Authentication Strategy

RUNSTR implements a dual authentication strategy for Nostr:

- **Primary: Amber Integration (Mobile)**
  - Uses the [Amber](https://github.com/greenart7c3/Amber) Nostr signer app on Android
  - Communicates via deep linking using the `nostrsigner:` URI scheme
  - Handles callbacks through the `runstr://callback` URL scheme

- **Fallback: window.nostr (Web/Development)**
  - Used during development or when Amber is not available
  - Relies on browser extensions that provide the `window.nostr` object

### 3. AmberAuth Service

The `AmberAuth.js` service handles Android-specific Nostr operations:

- `isAmberInstalled()`: Checks if the Amber app is installed on the device
- `requestAuthentication()`: Opens Amber for user login via deep linking
- `signEvent()`: Sends events to Amber for signing via deep linking
- `setupDeepLinkHandling()`: Sets up listeners for callback URLs after signing

## NWC Wallet Implementation

The `AlbyWallet` class has been adapted for mobile use:

### Mobile-Aware Zap Request Signing

```javascript
// For Android, use Amber if available
if (Platform.OS === 'android') {
  const isAmberAvailable = await AmberAuth.isAmberInstalled();
  
  if (isAmberAvailable) {
    console.log('[AlbyWallet] Signing zap request with Amber');
    // Amber signing implementation
  }
}

// Web fallback
if (window.nostr) {
  // Use window.nostr for signing
}
```

### Graceful Fallbacks

The implementation includes multiple fallbacks to ensure functionality across environments:

1. Try Amber signing on Android
2. Fall back to window.nostr if Amber is unavailable
3. Fall back to non-zap invoices if no signing method is available
4. Handle different NWC server response formats and capabilities

## Implementation Challenges

### 1. Asynchronous Deep Linking

Amber integration requires handling asynchronous responses via deep links, which adds complexity:

- The app must maintain state between sending a signing request and receiving the callback
- Deep link handlers must be properly registered in the application

### 2. Development Testing

Testing the mobile implementation requires:
- An Android device with Amber installed
- OR an emulator with the ability to handle deep links between apps

### 3. Multiple Signing Methods

Supporting both Amber and window.nostr requires:
- Careful conditional logic
- Thorough error handling
- Proper fallback mechanisms

## Usage Guidelines

When working with RUNSTR's NWC implementation:

1. Always check the platform before using signing methods
2. Handle both successful and error cases from Amber deep linking
3. Provide user feedback during the signing process, which may involve app switching
4. Test thoroughly on both web and mobile environments

## Future Improvements

1. Implement a complete deep link handler specifically for zap requests
2. Add a caching mechanism for signed events to reduce app switching
3. Consider adding support for other mobile Nostr signers (like Noster or nos) 