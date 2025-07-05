import { useEffect, useContext, useState, useMemo, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from '../contexts/WalletContext.jsx';
import { useLeagueActivityFeed } from '../hooks/useLeagueActivityFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { LeagueMap } from '../components/LeagueMap';
import { handleAppBackground } from '../utils/nostr';
import '../components/RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useContext(WalletContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Phase 5: Use new participant-first feed hook
  const {
    enhancedFeedEvents,
    isLoading: feedLoading,
    profilesLoading,
    error: feedError,
    refresh: refreshFeedData,
    activityMode,
    loadingProgress
  } = useLeagueActivityFeed();

  // Transform enhanced feed events to PostList-compatible format
  const posts = useMemo(() => {
    if (!enhancedFeedEvents.length) return [];
    
    return enhancedFeedEvents.map(event => ({
      // Core post data
      id: event.id,
      content: event.content,
      created_at: event.created_at,
      
      // Author information (using profile metadata)
      author: {
        pubkey: event.pubkey,
        profile: {
          display_name: event.displayName,
          name: event.displayName,
          picture: event.picture,
          about: event.about
        }
      },
      
      // Activity-specific metadata for display
      tags: event.tags,
      distance: event.distance,
      duration: event.duration,
      title: event.title,
      activityType: event.activityType,
      displayDistance: event.displayDistance,
      displayActivity: event.displayActivity,
      
      // Interaction placeholders (will be populated by usePostInteractions if needed)
      likes: [],
      reposts: [],
      zaps: [],
      comments: [],
      showComments: false,
      
      // Compatibility with existing post format
      rawEvent: event.rawEvent,
      isCurrentUser: event.isCurrentUser
    }));
  }, [enhancedFeedEvents]);

  // State for post interactions (simplified)
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());

  // Simplified post state management
  const [postsState, setPostsState] = useState([]);
  
  // Update posts when feed data changes
  useEffect(() => {
    setPostsState(posts);
  }, [posts]);

  // Simplified supplementary data loader (placeholder for now)
  const loadSupplementaryData = useCallback((postIds, dataType) => {
    console.log(`[RunClub] Loading ${dataType} for posts:`, postIds);
    // For Phase 5, we'll just mark as loaded without fetching
    // This can be enhanced later to load actual interaction data
    setLoadedSupplementaryData(prev => {
      const newSet = new Set(prev);
      postIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  // Interaction hook with simplified interface
  const {
    commentText,
    setCommentText,
    handleCommentClick,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts: postsState,
    setPosts: setPostsState,
    setUserLikes,
    setUserReposts,
    loadSupplementaryData,
    loadedSupplementaryData,
    defaultZapAmount
  });

  // Combined loading state
  const loading = feedLoading || profilesLoading;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleAppBackground();
    };
  }, []);

  // Refresh feed helper - uses new participant-first refresh
  const refreshFeed = useCallback(() => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    refreshFeedData().finally(() => setTimeout(() => setIsRefreshing(false), 500));
  }, [loading, isRefreshing, refreshFeedData]);

  // Hard refresh (clears cache and refreshes)
  const hardRefresh = useCallback(() => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    // For the new hook, refresh also handles cache clearing
    refreshFeedData();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [loading, isRefreshing, refreshFeedData]);

  // Load more posts (simplified - not implemented yet for new hook)
  const loadMorePosts = useCallback(() => {
    console.log('[RunClub] Load more posts not yet implemented for participant-first feed');
    // TODO: Implement pagination for useLeagueActivityFeed if needed
  }, []);

  return (
    <div className="runclub-container">
      {/* Add debug button for development builds */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', top: '80px', right: '10px', zIndex: 1000 }}>
          <button 
            onClick={hardRefresh}
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            disabled={loading || isRefreshing}
            title={`Participant-first feed (${activityMode} mode)`}
          >
            🗑️ Refresh Feed
          </button>
          
          {/* Show loading progress in development */}
          {loading && (
            <div style={{
              position: 'fixed',
              top: '120px',
              right: '10px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              maxWidth: '200px'
            }}>
              {loadingProgress.message}<br/>
              {loadingProgress.phase !== 'complete' && (
                <small>
                  {loadingProgress.processedEvents}/{loadingProgress.totalEvents} events
                </small>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* League Map Component */}
      <LeagueMap />
      
      {/* PostList Component for participant-only workout feed */}
      <PostList
        posts={postsState}
        loading={loading}
        error={feedError}
        userLikes={userLikes}
        userReposts={userReposts}
        onLike={handleLike}
        onRepost={handleRepost}
        onZap={handleZap}
        onComment={handleComment}
        onCommentClick={handleCommentClick}
        onLoadMore={loadMorePosts}
        commentText={commentText}
        setCommentText={setCommentText}
        onRefresh={refreshFeed}
        isRefreshing={isRefreshing}
        defaultZapAmount={defaultZapAmount}
        wallet={wallet}
      />
    </div>
  );
};