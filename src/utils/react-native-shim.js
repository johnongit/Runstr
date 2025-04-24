// Shim for React Native Platform and Linking APIs

// Detect if running on Android through Capacitor
const detectAndroid = () => {
  // Check for Capacitor bridge
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNative) {
    return true;
  }
  
  // Check for Android user agent
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return /android/i.test(navigator.userAgent);
  }
  
  return false;
};

// Platform detection
export const Platform = {
  // Set OS based on detection
  OS: detectAndroid() ? 'android' : 'web',
  
  select: (options) => {
    if (detectAndroid() && options.android) return options.android;
    if (options.web) return options.web;
    if (options.default) return options.default;
    return undefined;
  }
};

// Enhanced Linking implementation
export const Linking = {
  canOpenURL: async (url) => {
    console.log('Checking if can open URL:', url);
    
    // In Android context with Capacitor, we'll assume we can open nostrsigner URLs
    if (Platform.OS === 'android' && url.startsWith('nostrsigner:')) {
      console.log('Android environment detected, assuming Amber can be opened');
      return true;
    }
    
    // In a web context, we can't reliably check if a URL scheme is installed
    if (Platform.OS === 'web' && url.startsWith('nostrsigner:')) {
      console.log('Web environment detected, cannot open Amber URLs');
      return false;
    }
    
    return true;
  },
  
  openURL: async (url) => {
    console.log('Opening URL:', url);
    
    // For Android with Capacitor, use App plugin if available
    if (Platform.OS === 'android' && typeof window !== 'undefined' && window.Capacitor) {
      try {
        // Try to use Capacitor's App plugin
        const { App } = window.Capacitor.Plugins;
        if (App && App.openUrl) {
          await App.openUrl({ url });
          return true;
        }
      } catch (error) {
        console.error('Error opening URL with Capacitor:', error);
      }
    }
    
    // Fallback to standard window.open
    try {
      window.open(url, '_blank');
      return true;
    } catch (error) {
      console.error('Error opening URL:', error);
      throw error;
    }
  },
  
  addEventListener: (type, callback) => {
    console.log('Setting up URL listener');
    let listener = null;
    
    // Only set up listener for 'url' event type
    if (type === 'url' && Platform.OS === 'android' && typeof window !== 'undefined' && window.Capacitor) {
      try {
        // Try to use Capacitor's App plugin
        const { App } = window.Capacitor.Plugins;
        if (App && App.addListener) {
          listener = App.addListener('appUrlOpen', (data) => {
            console.log('Deep link received:', data);
            if (data && data.url) {
              callback({ url: data.url });
            }
          });
        }
      } catch (error) {
        console.error('Error setting up URL listener with Capacitor:', error);
      }
    }
    
    // Return an object with a remove method
    return {
      remove: () => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      }
    };
  }
};

// Log platform detection result
console.log('Platform detection:', Platform.OS);

// Export a default object for compatibility
export default {
  Platform,
  Linking
}; 