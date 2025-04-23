import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { handleAppBackground } from '../utils/nostr';
import RunFeedLoading from '../components/RunFeedLoading';
import { getFeedState } from '../utils/globalFeedState';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [feedIsPreloaded, setFeedIsPreloaded] = useState(false);
  
  // Check if feed is preloaded
  useEffect(() => {
    const feedState = getFeedState();
    setFeedIsPreloaded(feedState.preloadComplete && feedState.allPosts.length > 0);
    
    // Set up an interval to check preload status
    const interval = setInterval(() => {
      const currentState = getFeedState();
      setFeedIsPreloaded(currentState.preloadComplete && currentState.allPosts.length > 0);
      
      // Clear interval once preloaded
      if (currentState.preloadComplete) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
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
    loadedSupplementaryData
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleCommentClick,
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

  // Handle app lifecycle events for Android
  useEffect(() => {
    // This code would use AppState in a real React Native app
    // For example: AppState.addEventListener('change', (nextAppState) => {
    //   // Handle app state changes: background, foreground, etc.
    // });
    
    // Cleanup function for when component unmounts
    return () => {
      // Close any active connections when component unmounts
      handleAppBackground();
    };
  }, []);

  // Simple diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Import the diagnose function from our simplified nostr.js
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
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found. Trying broader search...');
          
          // Try the content-based search as a fallback
          const { searchRunningContent } = await import('../utils/nostr');
          const contentResults = await searchRunningContent(50, 72); // Search last 72 hours
          
          if (contentResults.length > 0) {
            setDiagnosticInfo(`Success! Found ${contentResults.length} posts mentioning running in their content. Refreshing feed...`);
            // You'll need to process these events similarly to how fetchRunPostsViaSubscription does
            // For now, just refresh the feed
            fetchRunPostsViaSubscription();
          } else {
            setDiagnosticInfo('No running-related posts found by tag or content. There may not be any recent running posts on the network.');
          }
        }
      } else {
        // We connected but got no events
        const relayStatus = Object.entries(results.relayStatus)
          .map(([relay, status]) => `${relay}: ${status}`)
          .join(', ');
        
        setDiagnosticInfo(`Connected to relays but couldn't fetch any events. Relay status: ${relayStatus}`);
      }
    } catch (error) {
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
      console.error('Error running diagnostic:', error);
    }
  };

  // Simple scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const screenHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Load more when we're close to the bottom
      if (scrollPosition + screenHeight > height - 300) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  return (
    <div className="feed-container">
      <h1 className="text-2xl font-bold mb-4">Running Club</h1>
      
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg mb-4">
          <p className="text-red-300">{error}</p>
          <button 
            onClick={fetchRunPostsViaSubscription}
            className="mt-2 px-3 py-1 bg-red-700 text-white text-sm rounded hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Show loading state */}
      {loading && !feedIsPreloaded && (
        <RunFeedLoading showDetail={true} />
      )}
      
      {/* Show feed content */}
      <PostList 
        posts={posts}
        userLikes={userLikes}
        userReposts={userReposts}
        onLike={handleLike}
        onRepost={handleRepost}
        onZap={handleZap}
        onComment={handleComment}
        onCommentClick={handleCommentClick}
        commentText={commentText}
        setCommentText={setCommentText}
        loadMorePosts={loadMorePosts}
        wallet={wallet}
      />
      
      {/* Show diagnostic info if available */}
      {diagnosticInfo && (
        <div className="mt-4 p-3 bg-gray-800 rounded text-xs opacity-70 font-mono">
          {diagnosticInfo}
        </div>
      )}
    </div>
  );
};