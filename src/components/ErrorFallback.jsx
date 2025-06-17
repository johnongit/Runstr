import PropTypes from 'prop-types';

/**
 * Error fallback component for catching and displaying errors in the application
 */
export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-bg-primary">
      <div className="p-6 bg-bg-secondary border border-border-secondary rounded-lg max-w-lg text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-secondary mb-4">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-text-primary text-bg-primary hover:bg-text-secondary rounded-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
};

ErrorFallback.propTypes = {
  error: PropTypes.shape({
    message: PropTypes.string
  }),
  resetErrorBoundary: PropTypes.func
};

// Default export for easier importing
export default ErrorFallback; 