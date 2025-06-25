import toast from 'react-hot-toast';

// Custom toast styles matching the app's black/white theme
const toastStyles = {
  success: {
    style: {
      background: '#1f2937', // Dark gray background
      color: '#ffffff',      // White text
      border: '1px solid #4ade80', // Green border for success
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    iconTheme: {
      primary: '#4ade80', // Green checkmark
      secondary: '#ffffff',
    },
  },
  error: {
    style: {
      background: '#1f2937', // Dark gray background
      color: '#ffffff',      // White text
      border: '1px solid #ef4444', // Red border for error
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    iconTheme: {
      primary: '#ef4444', // Red X
      secondary: '#ffffff',
    },
  },
  loading: {
    style: {
      background: '#1f2937', // Dark gray background
      color: '#ffffff',      // White text
      border: '1px solid #6b7280', // Gray border for loading
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    iconTheme: {
      primary: '#6b7280', // Gray spinner
      secondary: '#ffffff',
    },
  },
  default: {
    style: {
      background: '#1f2937', // Dark gray background
      color: '#ffffff',      // White text
      border: '1px solid #6b7280', // Gray border for default
      borderRadius: '8px',
      fontSize: '14px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    iconTheme: {
      primary: '#6b7280', // Gray icon
      secondary: '#ffffff',
    },
  },
};

// Enhanced toast utility with app-specific styling
export const appToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      style: {
        background: '#1f2937',
        color: '#ffffff',
        border: '1px solid #4ade80',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      iconTheme: {
        primary: '#4ade80',
        secondary: '#ffffff',
      },
      duration: 3000,
      position: 'top-center',
      ...options,
    });
  },

  error: (message, options = {}) => {
    return toast.error(message, {
      style: {
        background: '#1f2937',
        color: '#ffffff',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#ffffff',
      },
      duration: 4000,
      position: 'top-center',
      ...options,
    });
  },

  loading: (message, options = {}) => {
    return toast.loading(message, {
      style: {
        background: '#1f2937',
        color: '#ffffff',
        border: '1px solid #6b7280',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      iconTheme: {
        primary: '#6b7280',
        secondary: '#ffffff',
      },
      position: 'top-center',
      ...options,
    });
  },

  info: (message, options = {}) => {
    return toast(message, {
      style: {
        background: '#1f2937',
        color: '#ffffff',
        border: '1px solid #6b7280',
        borderRadius: '8px',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
      iconTheme: {
        primary: '#6b7280',
        secondary: '#ffffff',
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
          background: '#1f2937',
          color: '#ffffff',
          border: '1px solid #6b7280',
          borderRadius: '8px',
          fontSize: '14px',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
        iconTheme: {
          primary: '#6b7280',
          secondary: '#ffffff',
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