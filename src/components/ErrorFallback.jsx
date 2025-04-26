import PropTypes from 'prop-types';

/**
 * Error fallback component for catching and displaying errors in the application
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="error-container flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="p-6 bg-red-900/30 border border-red-800 rounded-lg max-w-lg text-center">
        <h2 className="text-xl font-semibold text-red-300 mb-2">Something went wrong</h2>
        <p className="text-red-200 mb-4">
          {error?.message || 'An unexpected error occurred'}
        </p>
        {resetErrorBoundary && (
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
          >
            Try Again
          </button>
        )}
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

export default ErrorFallback; 