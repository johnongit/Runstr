import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { getFeedState } from '../utils/globalFeedState';
import './RunFeedLoading.css';

const RunFeedLoading = ({ showDetail = false }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Preparing feed...');
  const [postCount, setPostCount] = useState(0);
  
  // Update progress and status based on feed state
  useEffect(() => {
    // Update every 500ms to reflect latest state
    const interval = setInterval(() => {
      const state = getFeedState();
      setProgress(state.loadingProgress);
      setPostCount(state.preloadedPostCount);
      
      // Set appropriate status messages
      if (state.preloadComplete) {
        setStatus('Feed ready!');
      } else if (state.isPreloading) {
        setStatus('Preloading feed posts...');
      } else if (state.isLoading) {
        setStatus('Loading posts...');
      } else if (state.error) {
        setStatus(`Error: ${state.error}`);
      } else if (state.allPosts.length === 0) {
        setStatus('No posts available yet');
      } else {
        setStatus('Ready');
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="run-feed-loading">
      <div className="run-feed-loading-spinner"></div>
      <div className="run-feed-loading-content">
        <div className="run-feed-loading-text">{status}</div>
        
        {/* Show progress bar if loading is happening */}
        {(progress > 0 && progress < 100) && (
          <div className="run-feed-loading-progress-container">
            <div 
              className="run-feed-loading-progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
        
        {/* Show detailed status if requested */}
        {showDetail && (
          <div className="run-feed-loading-detail">
            {postCount > 0 && (
              <div className="run-feed-loading-count">
                {postCount} posts loaded
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

RunFeedLoading.propTypes = {
  showDetail: PropTypes.bool
};

export default RunFeedLoading; 