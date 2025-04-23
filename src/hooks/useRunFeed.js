import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';
import globalFeedState from '../utils/globalFeedState';
import nostrConnectionManager from '../utils/nostrConnectionManager';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // Number of posts to display initially
  const [allPosts, setAllPosts] = useState(globalFeedState.getCachedPosts() || []); // Use global cache
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalFeedState.getFeedState().isInitialized);
  const subscriptionRef = useRef(null);

  // Initialize Nostr as soon as the hook is used, even if component isn't visible
  useEffect(() => {
    const initNostr = async () => {
      // Only initialize once
      if (!globalFeedState.getFeedState().isInitialized) {
        const connected = await initializeNostr();
        globalFeedState.setInitialized(connected);
        nostrConnectionManager.setConnectionStatus(connected);
      }
    };
    
    initNostr();
  }, []);

  // Background fetch for new posts
  const setupBackgroundFetch = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up a recurring fetch every 60 seconds
    timeoutRef.current = setInterval(async () => {
      console.log('Background fetch: Checking for new posts');
      
      try {
        // Check if we should proceed with background fetch (low priority)
        if (nostrConnectionManager.shouldYield('background')) {
          console.log('Background fetch yielding to higher priority operations');
          return;
        }
        
        // Start background operation
        nostrConnectionManager.startOperation('background');
        
        // Only fetch posts that are newer than our most recent post
        const feedState = globalFeedState.getFeedState();
        const newestPostTime = feedState.allPosts.length > 0 
          ? Math.max(...feedState.allPosts.map(p => p.created_at)) * 1000
          : undefined;
          
        // Only fetch if we haven't fetched in the last 30 seconds
        const now = Date.now();
        if (now - feedState.lastFetchTime < 30000) {
          console.log('Skipping background fetch, last fetch was too recent');
          nostrConnectionManager.endOperation('background');
          return;
        }
        
        // Update global state
        globalFeedState.setLoading(true);
        
        // Fetch new posts
        const limit = 10; // Fetch just a few new posts
        const runPostsArray = await fetchRunningPosts(limit, newestPostTime);
        
        if (runPostsArray.length === 0) {
          console.log('No new posts found in background fetch');
          globalFeedState.setLoading(false);
          nostrConnectionManager.endOperation('background');
          return;
        }
        
        console.log(`Background fetch: Found ${runPostsArray.length} new posts`);
        
        // Load supplementary data in parallel
        const supplementaryData = await loadSupplementaryData(runPostsArray);
        
        // Process posts with all the data
        const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
        
        // Update global cache with new posts
        if (processedPosts.length > 0) {
          // Add new posts to cache
          globalFeedState.addPostsToCache(processedPosts);
          
          // Store supplementary data
          globalFeedState.storeSupplementaryData(supplementaryData);
          
          // Update local state if component is mounted
          setAllPosts(globalFeedState.getCachedPosts());
          
          // Update displayed posts (limited by display limit)
          setPosts(prevPosts => {
            // Create merged array with new posts at the top
            const mergedPosts = [...processedPosts, ...prevPosts];
            
            // Only display up to the display limit
            return mergedPosts.slice(0, displayLimit);
          });
          
          // Update user interactions
          updateUserInteractions(supplementaryData);
        }
        
        globalFeedState.setLoading(false);
        nostrConnectionManager.endOperation('background');
      } catch (error) {
        console.error('Error in background fetch:', error);
        globalFeedState.setLoading(false);
        nostrConnectionManager.endOperation('background');
        // Don't set error state - this is a background operation
      }
    }, 60000); // Check every minute
    
    // Store reference to cleanup
    subscriptionRef.current = timeoutRef.current;
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayLimit, updateUserInteractions]);

  // Extract user interactions logic to reuse
  const updateUserInteractions = useCallback((supplementaryData) => {
    const newUserLikes = new Set([...userLikes]);
    const newUserReposts = new Set([...userReposts]);
    
    supplementaryData.likes?.forEach(like => {
      try {
        if (window.nostr && like.pubkey === window.nostr.getPublicKey()) {
          const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserLikes.add(postId);
        }
      } catch (err) {
        console.error('Error processing user likes:', err);
      }
    });
    
    supplementaryData.reposts?.forEach(repost => {
      try {
        if (window.nostr && repost.pubkey === window.nostr.getPublicKey()) {
          const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserReposts.add(postId);
        }
      } catch (err) {
        console.error('Error processing user reposts:', err);
      }
    });
    
    setUserLikes(newUserLikes);
    setUserReposts(newUserReposts);
  }, [userLikes, userReposts]);

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      globalFeedState.setLoading(true);
      globalFeedState.setLoadingProgress(0);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Start a feed operation
      const canProceed = nostrConnectionManager.startOperation('feed');
      if (!canProceed) {
        console.log('Feed loading deferred due to higher priority operations');
        // Set a timeout to retry after a short delay
        setTimeout(() => fetchRunPostsViaSubscription(), 2000);
        return;
      }

      // Initialize Nostr first if needed
      if (!globalFeedState.getFeedState().isInitialized) {
        const connected = await initializeNostr();
        globalFeedState.setInitialized(connected);
        nostrConnectionManager.setConnectionStatus(connected);
      }

      // Check if we have cached posts that are still valid
      if (globalFeedState.isCacheValid()) {
        console.log('Using cached posts from global feed state');
        const cachedPosts = globalFeedState.getCachedPosts();
        setAllPosts(cachedPosts);
        setPosts(cachedPosts.slice(0, displayLimit));
        setLoading(false);
        globalFeedState.setLoading(false);
        
        // Still update in the background for freshness
        setupBackgroundFetch();
        nostrConnectionManager.endOperation('feed');
        return;
      }

      // If preloading is complete, use that data
      const feedState = globalFeedState.getFeedState();
      if (feedState.preloadComplete && feedState.allPosts.length > 0) {
        console.log('Using preloaded posts');
        setAllPosts(feedState.allPosts);
        setPosts(feedState.allPosts.slice(0, displayLimit));
        setLoading(false);
        globalFeedState.setLoading(false);
        
        // Set up background fetch
        setupBackgroundFetch();
        nostrConnectionManager.endOperation('feed');
        return;
      }

      // Update progress
      globalFeedState.setLoadingProgress(10);

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 21; // Load 21 posts initially (3 pages worth)

      // Fetch posts with running hashtags
      globalFeedState.setLoadingProgress(20);
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      globalFeedState.setLoadingProgress(40);
      
      // If we got no results with tags, try a content search as fallback
      if (runPostsArray.length === 0 && page === 1) {
        console.log('No tagged running posts found, trying content search');
        globalFeedState.setLoadingProgress(50);
        const contentPosts = await searchRunningContent(limit, 72); // 72 hours
        
        if (contentPosts.length > 0) {
          console.log(`Found ${contentPosts.length} posts through content search`);
          globalFeedState.setLoadingProgress(60);
          
          // Load supplementary data in parallel for all posts
          const supplementaryData = await loadSupplementaryData(contentPosts);
          globalFeedState.setLoadingProgress(80);
          
          // Process posts with all the data
          const processedPosts = await processPostsWithData(contentPosts, supplementaryData);
          globalFeedState.setLoadingProgress(90);
          
          // Update global cache
          globalFeedState.setCachedPosts(processedPosts);
          globalFeedState.storeSupplementaryData(supplementaryData);
          
          // Update state with all processed posts, but only display up to the limit
          setAllPosts(processedPosts);
          setPosts(processedPosts.slice(0, displayLimit));
          
          // Update user interactions
          updateUserInteractions(supplementaryData);
          
          setHasMore(contentPosts.length >= limit);
          setLoading(false);
          globalFeedState.setLoading(false);
          globalFeedState.setLoadingProgress(100);
          initialLoadRef.current = true;
          
          // Set up background fetch
          setupBackgroundFetch();
          nostrConnectionManager.endOperation('feed');
          return;
        }
      }
      
      // If we didn't get enough posts, there may not be more to load
      if (runPostsArray.length < limit) {
        setHasMore(false);
      }
      
      // Skip processing if we didn't get any posts
      if (runPostsArray.length === 0) {
        if (page === 1) {
          setPosts([]);
          setAllPosts([]);
          setError('No running posts found. Try again later.');
          globalFeedState.setLoading(false);
          globalFeedState.setLoadingProgress(100);
        }
        setLoading(false);
        nostrConnectionManager.endOperation('feed');
        return;
      }
      
      // Load supplementary data in parallel for all posts
      globalFeedState.setLoadingProgress(60);
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      globalFeedState.setLoadingProgress(80);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      globalFeedState.setLoadingProgress(90);
      
      // Update global cache
      globalFeedState.setCachedPosts(processedPosts);
      globalFeedState.storeSupplementaryData(supplementaryData);
      
      // Update state with processed posts
      if (page === 1) {
        setAllPosts(processedPosts);
        setPosts(processedPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          
          // Update global cache with merged posts
          globalFeedState.setCachedPosts(mergedPosts);
          
          return mergedPosts;
        });
        
        // Update displayed posts
        setPosts(prevPosts => {
          const allPostsCombined = [...prevPosts, ...processedPosts];
          const uniquePosts = [];
          const seen = new Set();
          
          // Remove duplicates
          allPostsCombined.forEach(post => {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              uniquePosts.push(post);
            }
          });
          
          return uniquePosts.slice(0, displayLimit); // Only display up to the limit
        });
      }
      
      // Update user interactions
      updateUserInteractions(supplementaryData);
      
      initialLoadRef.current = true;
      globalFeedState.setLoadingProgress(100);
      
      // Set up background fetch
      setupBackgroundFetch();
      
      // End feed operation
      nostrConnectionManager.endOperation('feed');
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
      globalFeedState.setLoading(false);
      nostrConnectionManager.endOperation('feed');
    } finally {
      setLoading(false);
    }
  }, [page, displayLimit, updateUserInteractions, setupBackgroundFetch]);

  // Load more posts function - increases the display limit
  const loadMorePosts = useCallback(() => {
    setDisplayLimit(prevLimit => prevLimit + 7); // Increase display limit by 7
  }, []);

  // Check if we can load more posts
  const canLoadMore = useCallback(() => {
    return allPosts.length > displayLimit;
  }, [allPosts.length, displayLimit]);

  // Load next page of posts from the network
  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Initial load
  useEffect(() => {
    // If we have preloaded data, use it
    const feedState = globalFeedState.getFeedState();
    if (feedState.preloadComplete && feedState.allPosts.length > 0) {
      console.log('Using preloaded feed data');
      setAllPosts(feedState.allPosts);
      setPosts(feedState.allPosts.slice(0, displayLimit));
      setLoading(false);
      initialLoadRef.current = true;
      
      // Still set up background fetch for updates
      setupBackgroundFetch();
    } 
    // Otherwise fetch if not already initialized
    else if (!initialLoadRef.current) {
      fetchRunPostsViaSubscription();
    }
    
    // Cleanup function when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fetchRunPostsViaSubscription, setupBackgroundFetch, displayLimit]);

  // Update displayed posts when displayLimit changes
  useEffect(() => {
    if (allPosts.length > 0) {
      setPosts(allPosts.slice(0, displayLimit));
    }
    
    // If we're showing all available posts but there might be more on the server
    if (allPosts.length <= displayLimit && hasMore && !loading) {
      loadNextPage();
    }
  }, [displayLimit, allPosts, hasMore, loading, loadNextPage]);

  // Handle comment click to toggle comment visibility
  const handleCommentClick = async (postId) => {
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === postId) {
          // If comments aren't loaded yet, load them first
          if (!post.commentsLoaded) {
            // This would be implemented to fetch comments from Nostr
            console.log('Loading comments for post', postId);
            
            // In a real implementation, you would fetch comments here
            loadSupplementaryData([postId], 'comments')
              .then(commentData => {
                // Mark this post as having had its supplementary data loaded
                setLoadedSupplementaryData(prev => new Set([...prev, postId]));
                
                // Update posts with the loaded comments
                setPosts(latestPosts => {
                  return latestPosts.map(p => {
                    if (p.id === postId) {
                      // Mark comments as loaded and add fetched comments
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        // Use the comment data from the response, or fallback to existing comments
                        comments: commentData?.[postId] || p.comments || []
                      };
                    }
                    return p;
                  });
                });
              });
          }
          
          // Toggle comment visibility
          return { ...post, showComments: !post.showComments };
        }
        return post;
      });
    });
    
    // Return a promise that resolves when comments are loaded
    return new Promise(resolve => {
      // In a real implementation, this would resolve when comments are fetched
      setTimeout(resolve, 1500);
    });
  };

  return {
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
  };
}; 