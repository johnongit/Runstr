import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from './PostList';
import { handleAppBackground } from '../utils/nostr';
import { Button } from "@/components/ui/button";
import './RunClub.css';

// Progressive loading indicator component
const ProgressiveLoadingIndicator = ({ progress }) => {
  return (
    <div className="progressive-loading">
      <div className="loading-animation">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
      <p>Loading posts from relays{progress > 0 ? ` (${progress} found)` : '...'}</p>
    </div>
  );
};

const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Use the custom hooks
  const {
    posts,
    setPosts,
    loading,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts,
    setPosts,
    setUserLikes,
    setUserReposts,
    loadSupplementaryData,
    loadedSupplementaryData,
    defaultZapAmount
  });

  // Update loading progress when posts change
  useEffect(() => {
    if (loading && posts.length > 0) {
      setLoadingProgress(posts.length);
    } else if (!loading) {
      setLoadingProgress(0);
    }
  }, [loading, posts.length]);

  // Handle app lifecycle events for Android
  useEffect(() => {
    // Cleanup function for when component unmounts
    return () => {
      // Close any active connections when component unmounts
      handleAppBackground();
    };
  }, []);

  // Function to refresh the feed when the header is clicked
  const refreshFeed = () => {
    // Don't allow multiple refreshes at once
    if (loading || isRefreshing) return;
    
    setIsRefreshing(true);
    fetchRunPostsViaSubscription()
      .finally(() => {
        // Reset the refreshing state after a delay to show animation
        setTimeout(() => {
          setIsRefreshing(false);
        }, 500);
      });
  };

  // Simple diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Import the diagnose function
      const { diagnoseConnection } = await import('../utils/nostr');
      
      // Run the comprehensive diagnostic
      const results = await diagnoseConnection();
      
      if (results.error) {
        setDiagnosticInfo(`Connection error: ${results.error}`);
        return;
      }
      
      if (results.generalEvents > 0) {
        // We can at least connect and fetch some posts
        setDiagnosticInfo(`Connection successful! Fetched ${results.generalEvents} general posts.`);
        
        if (results.runningEvents > 0) {
          // We found running-specific posts too
          setDiagnosticInfo(`Success! Found ${results.runningEvents} running-related posts. Refreshing feed...`);
          fetchRunPostsViaSubscription();
        } else {
          // Connected but no running posts
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found.');
        }
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
    }
  };

  // Toggle debug overlay visibility
  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };
  
  return (
    <div className="run-club-container">
      <div className="feed-header-static">
        {/* Removed RUNSTR FEED title as requested */}
      </div>

      {loading ? (
        <div className="loading-indicator">
          {posts.length === 0 ? (
            <ProgressiveLoadingIndicator progress={loadingProgress} />
          ) : (
            <div className="posts-loading-more">
              <PostList
                posts={posts}
                loading={loading}
                page={1}
                userLikes={userLikes}
                userReposts={userReposts}
                handleLike={handleLike}
                handleRepost={handleRepost}
                handleZap={(post) => handleZap(post, wallet)}
                handleCommentClick={handleCommentClick}
                handleComment={handleComment}
                commentText={commentText}
                setCommentText={setCommentText}
                wallet={wallet}
              />
              <ProgressiveLoadingIndicator progress={loadingProgress} />
            </div>
          )}
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <div className="error-buttons">
            <Button 
              variant="outline"
              size="default"
              onClick={refreshFeed}
            >
              Retry
            </Button>
            <Button 
              variant="secondary" 
              size="default"
              onClick={diagnoseConnection}
            >
              Diagnose Connection
            </Button>
          </div>
          {diagnosticInfo && (
            <div className="diagnostic-info">
              <p>{diagnosticInfo}</p>
            </div>
          )}
        </div>
      ) : posts.length === 0 ? (
        <div className="no-posts-message">
          <p>No running posts found. Follow some runners or post your own run!</p>
          <Button 
            variant="outline"
            size="default"
            onClick={refreshFeed}
          >
            Refresh
          </Button>
          <Button 
            variant="secondary"
            size="default"
            onClick={diagnoseConnection}
          >
            Diagnose Connection
          </Button>
        </div>
      ) : (
        <>
          <PostList
            posts={posts}
            loading={loading}
            page={1}
            userLikes={userLikes}
            userReposts={userReposts}
            handleLike={handleLike}
            handleRepost={handleRepost}
            handleZap={(post) => handleZap(post, wallet)}
            handleCommentClick={handleCommentClick}
            handleComment={handleComment}
            commentText={commentText}
            setCommentText={setCommentText}
            wallet={wallet}
          />
          
          {/* Load More Button */}
          {canLoadMore() && (
            <div className="load-more-container">
              <button 
                className="load-more-button" 
                onClick={loadMorePosts}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Debug toggle button */}
      <button 
        onClick={toggleDebug}
        className="debug-toggle"
        style={{
          bottom: showDebug ? '200px' : '10px'
        }}
      >
        {showDebug ? 'X' : '🐞'}
      </button>
      
      {/* Debug overlay - remove after debugging */}
      {showDebug && (
        <div className="debug-overlay">
          <h3>Debug Info</h3>
          <p>Connected relays: {window.NDK?.pool?.relays?.size || 0}</p>
          <p>Posts loaded: {posts?.length || 0}</p>
          <p>Feed error: {error || 'None'}</p>
          <p>Loading state: {loading ? 'Loading' : 'Idle'}</p>
          <p>User interactions: {userLikes?.size || 0} likes, {userReposts?.size || 0} reposts</p>
          <div className="debug-actions">
            <button 
              onClick={refreshFeed}
              className="debug-button"
            >
              Refresh Feed
            </button>
            <button 
              onClick={diagnoseConnection}
              className="debug-button secondary"
            >
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunClub; 