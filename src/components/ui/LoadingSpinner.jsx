import React from 'react';

const LoadingSpinner = ({ 
  size = 'md', 
  className = '', 
  color = 'white',
  text = null 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const colorClasses = {
    white: 'border-white/20 border-t-white',
    gray: 'border-gray-300/20 border-t-gray-300',
    green: 'border-green-500/20 border-t-green-500',
    red: 'border-red-500/20 border-t-red-500'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`
          animate-spin rounded-full border-2 
          ${sizeClasses[size]} 
          ${colorClasses[color]}
        `}
      />
      {text && (
        <p className="mt-2 text-sm text-white/80">{text}</p>
      )}
    </div>
  );
};

// Inline spinner for buttons
export const InlineSpinner = ({ size = 'sm', color = 'white', className = '' }) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5'
  };

  const colorClasses = {
    white: 'border-white/30 border-t-white',
    gray: 'border-gray-300/30 border-t-gray-300',
    black: 'border-black/30 border-t-black'
  };

  return (
    <div 
      className={`
        animate-spin rounded-full border-2 
        ${sizeClasses[size]} 
        ${colorClasses[color]}
        ${className}
      `}
    />
  );
};

// Loading button wrapper
export const LoadingButton = ({ 
  children, 
  isLoading, 
  loadingText = 'Loading...', 
  className = '', 
  spinnerColor = 'white',
  disabled,
  ...props 
}) => {
  return (
    <button 
      className={`
        flex items-center justify-center gap-2 
        ${isLoading ? 'cursor-not-allowed opacity-70' : ''} 
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <InlineSpinner color={spinnerColor} />}
      {isLoading ? loadingText : children}
    </button>
  );
};

export default LoadingSpinner; 