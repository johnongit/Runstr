import { useEffect, useContext, useState, useMemo, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from '../contexts/WalletContext.jsx';
import { useLeagueActivityFeed } from '../hooks/useLeagueActivityFeed';
import { LeagueMap } from '../components/LeagueMap';
import { Post } from '../components/Post';
import { handleAppBackground } from '../utils/nostr';
import '../components/RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useContext(WalletContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use the participant-first feed hook
  const {
    enhancedFeedEvents,
    isLoading: feedLoading,
    profilesLoading,
    error: feedError,
    refresh: refreshFeedData,
    activityMode,
    loadingProgress
  } = useLeagueActivityFeed();

  // Transform enhanced feed events to Post-compatible format for WorkoutCard display
  const workoutPosts = useMemo(() => {
    if (!enhancedFeedEvents.length) return [];
    
    return enhancedFeedEvents.map(event => ({
      // Core post data for WorkoutCard
      id: event.id,
      kind: 1301, // Always 1301 for workout records
      content: event.content,
      created_at: event.created_at,
      title: event.title,
      
      // Author information for WorkoutCard
      author: {
        pubkey: event.pubkey,
        profile: {
          name: event.displayName,
          display_name: event.displayName,
          picture: event.picture,
          about: event.about,
          nip05: event.nip05
        }
      },
      
      // Workout metrics for display
      metrics: event.metrics || [
        // Fallback metrics if not processed
        ...(event.distance ? [{
          label: 'Distance',
          value: event.distance,
          unit: event.distanceUnit || 'miles'
        }] : []),
        ...(event.duration ? [{
          label: 'Duration', 
          value: event.duration,
          unit: 'min'
        }] : [])
      ],
      
      // Tags for team/challenge display
      tags: event.tags,
      
      // Simple zap count (no complex social interactions)
      zaps: 0, // Keep simple - just for display
      
      // Raw event for any additional processing
      rawEvent: event.rawEvent
    }));
  }, [enhancedFeedEvents]);

  // Combined loading state
  const loading = feedLoading || profilesLoading;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleAppBackground();
    };
  }, []);

  // Simple refresh function
  const refreshFeed = useCallback(() => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    refreshFeedData().finally(() => setTimeout(() => setIsRefreshing(false), 500));
  }, [loading, isRefreshing, refreshFeedData]);

  // Hard refresh with cache clearing
  const hardRefresh = useCallback(() => {
    if (loading || isRefreshing) return;
    setIsRefreshing(true);
    refreshFeedData();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [loading, isRefreshing, refreshFeedData]);

  // Simple zap handler for WorkoutCards
  const handleZap = useCallback(async (post, wallet) => {
    console.log('Zapping workout:', post.id);
    // Simple zap implementation - could be enhanced later if needed
    if (wallet && wallet.makePayment) {
      try {
        // Basic zap functionality - just log for now
        console.log(`Zapped ${defaultZapAmount} sats to workout ${post.id}`);
      } catch (error) {
        console.error('Zap failed:', error);
      }
    }
  }, [defaultZapAmount]);

  return (
    <div className="runclub-container">
      {/* Development debug tools */}
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
            title={`Participant-first workout feed (${activityMode} mode)`}
          >
            🗑️ Refresh Workouts
          </button>
          
          {/* Show loading progress */}
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
                  {loadingProgress.processedEvents}/{loadingProgress.totalEvents} workouts
                </small>
              )}
            </div>
          )}
          
          {/* Show error */}
          {feedError && (
            <div style={{
              position: 'fixed',
              top: '180px',
              right: '10px',
              background: '#ff4444',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              maxWidth: '200px'
            }}>
              Error: {feedError}
            </div>
          )}
        </div>
      )}
      
      {/* League Map Component */}
      <LeagueMap />
      
      {/* Workout Cards Feed */}
      <div className="workout-feed" style={{ padding: '1rem' }}>
        {loading && workoutPosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Loading participant workouts...
          </div>
        )}
        
        {feedError && workoutPosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#ff4444' }}>
            Error loading workouts: {feedError}
          </div>
        )}
        
        {!loading && workoutPosts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            No workout records found for Season Pass participants in {activityMode} mode.
          </div>
        )}
        
        {/* Render workout posts using existing Post/WorkoutCard components */}
        {workoutPosts.map((post) => (
          <Post
            key={post.id}
            post={post}
            handleZap={handleZap}
            wallet={wallet}
          />
        ))}
        
        {!loading && workoutPosts.length > 0 && (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
            <button 
              onClick={refreshFeed}
              style={{
                background: 'transparent',
                border: '1px solid #ccc',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Workouts'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};