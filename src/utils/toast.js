import toast from 'react-hot-toast';

// Custom toast styles matching the app's pure black/white theme
const toastStyles = {
  success: {
    style: {
      background: '#000000', // Pure black background
      color: '#ffffff',      // White text
      border: '1px solid #ffffff', // White border
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
    },
    iconTheme: {
      primary: '#ffffff', // White icon
      secondary: '#000000',
    },
  },
  error: {
    style: {
      background: '#000000', // Pure black background
      color: '#ffffff',      // White text
      border: '1px solid #ffffff', // White border
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
    },
    iconTheme: {
      primary: '#ffffff', // White icon
      secondary: '#000000',
    },
  },
  loading: {
    style: {
      background: '#000000', // Pure black background
      color: '#ffffff',      // White text
      border: '1px solid #ffffff', // White border
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
    },
    iconTheme: {
      primary: '#ffffff', // White spinner
      secondary: '#000000',
    },
  },
  default: {
    style: {
      background: '#000000', // Pure black background
      color: '#ffffff',      // White text
      border: '1px solid #ffffff', // White border
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
    },
    iconTheme: {
      primary: '#ffffff', // White icon
      secondary: '#000000',
    },
  },
};

// Enhanced toast utility with app-specific styling
export const appToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      style: {
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #ffffff',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#000000',
      },
      duration: 3000,
      position: 'top-center',
      ...options,
    });
  },

  error: (message, options = {}) => {
    return toast.error(message, {
      style: {
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #ffffff',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#000000',
      },
      duration: 4000,
      position: 'top-center',
      ...options,
    });
  },

  loading: (message, options = {}) => {
    return toast.loading(message, {
      style: {
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #ffffff',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#000000',
      },
      position: 'top-center',
      ...options,
    });
  },

  info: (message, options = {}) => {
    return toast(message, {
      style: {
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #ffffff',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#000000',
      },
      duration: 3000,
      position: 'top-center',
      ...options,
    });
  },

  // Utility for promises with loading states
  promise: (promise, messages, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        style: {
          background: '#000000',
          color: '#ffffff',
          border: '1px solid #ffffff',
          borderRadius: '8px',
          fontSize: '14px',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
        },
        iconTheme: {
          primary: '#ffffff',
          secondary: '#000000',
        },
        position: 'top-center',
        ...options,
      }
    );
  },

  // Dismiss all toasts
  dismiss: () => {
    toast.dismiss();
  },

  // Dismiss specific toast
  dismissById: (toastId) => {
    toast.dismiss(toastId);
  },
};

// Default export for convenience
export default appToast; 