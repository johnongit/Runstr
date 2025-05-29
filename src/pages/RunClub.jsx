import { useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { ActivityCard } from '../components/ActivityCard';
import './RunClub.css';

export const RunClub = () => {
  const { wallet } = useContext(WalletContext);
  
  const {
    activities,
    loading,
    error,
    userLikes,
    userReposts,
    handleLike,
    handleRepost,
    handleZap,
    handleComment,
    refreshFeed
  } = useActivityFeed();
  
  if (loading && activities.length === 0) {
    return (
      <div className="run-club-container">
        <div className="feed-header">
          <h2>RUNSTR FEED</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p>Loading activities...</p>
        </div>
      </div>
    );
  }
  
  if (error && activities.length === 0) {
    return (
      <div className="run-club-container">
        <div className="feed-header">
          <h2>RUNSTR FEED</h2>
        </div>
        <div className="error-container">
          <p>Failed to load activities</p>
          <button onClick={refreshFeed} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="run-club-container">
      <div className="feed-header">
        <h2>RUNSTR FEED</h2>
        <button 
          onClick={refreshFeed} 
          className="refresh-button"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <div className="activities-list">
        {activities.length === 0 ? (
          <div className="empty-feed">
            <p>No activities yet. Be the first to post!</p>
          </div>
        ) : (
          activities.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isLiked={userLikes.has(activity.id)}
              isReposted={userReposts.has(activity.id)}
              onLike={handleLike}
              onRepost={handleRepost}
              onZap={handleZap}
              onComment={handleComment}
              wallet={wallet}
            />
          ))
        )}
      </div>
      
      {loading && activities.length > 0 && (
        <div className="loading-more">
          <div className="spinner-small"></div>
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
};