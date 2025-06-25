import PropTypes from 'prop-types';

const NotificationModal = ({ title, message, buttonText, onClose, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700 shadow-xl">
        <h2 className="section-heading mb-4">{title}</h2>
        <p className="text-gray-300 mb-6 whitespace-pre-line">{message}</p> {/* whitespace-pre-line to respect newlines */}
        <button 
          onClick={onClose}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
        >
          {buttonText || 'Close'}
        </button>
      </div>
    </div>
  );
};

NotificationModal.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  buttonText: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  isVisible: PropTypes.bool.isRequired,
};

export default NotificationModal; 