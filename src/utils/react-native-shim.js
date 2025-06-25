/**
 * React Native Shim for Web.
 * Provides minimal stubs for RN modules that are not available in a web environment.
 * This allows components to import from 'react-native' without breaking the web build.
 * The native mobile build (via Metro) will use the real 'react-native' modules.
 */

// Platform detection
export const Platform = {
  OS: 'web',
  select: (options) => {
    return options.web || options.default;
  },
};

// Basic Linking implementation for web
export const Linking = {
  canOpenURL: async () => false,
  openURL: async (url) => {
    console.warn(`[Shim] openURL called with: ${url}`);
  },
  addEventListener: () => ({ remove: () => {} }),
  getInitialURL: async () => null,
};

// AppState stub for web
export const AppState = {
  currentState: 'active',
  addEventListener: (_event, _handler) => ({
    remove: () => {},
  }),
};

// Default export for convenience, e.g. import RN from '...'
const RN = {
  Platform,
  Linking,
  AppState,
};

export default RN; 