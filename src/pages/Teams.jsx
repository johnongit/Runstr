import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';

export const Teams = () => {
  const navigate = useNavigate();
  const { error, clearError } = useContext(TeamsContext);
  const { publicKey } = useContext(NostrContext);
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  return (
    <div className="px-4 pt-6 pb-20">
      <h1 className="text-2xl font-bold mb-6 text-center">Running Clubs</h1>
      
      {/* Login status indicator */}
      {!publicKey && (
        <div className="mb-6 p-4 bg-yellow-800/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-400 text-center">
            Sign in to join running clubs
          </p>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={clearError}
            className="mt-2 text-sm text-red-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Navigation cards */}
      <div className="grid gap-4 mt-2">
        <div 
          onClick={() => handleNavigation('/my-clubs')}
          className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition duration-200"
        >
          <h2 className="text-xl font-semibold mb-2 text-white">My Clubs</h2>
          <p className="text-gray-400">View clubs you&apos;ve joined and stay connected with your running community</p>
        </div>
        
        <div 
          onClick={() => handleNavigation('/discover-clubs')}
          className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition duration-200"
        >
          <h2 className="text-xl font-semibold mb-2 text-white">Discover Clubs</h2>
          <p className="text-gray-400">Join our featured running communities and connect with runners worldwide</p>
        </div>
      </div>
      
      <div className="text-center mt-8 text-gray-500 text-sm">
        <p>Connect with running communities powered by Nostr</p>
      </div>
    </div>
  );
};

export default Teams; 