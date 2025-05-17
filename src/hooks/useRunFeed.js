import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData
} from '../utils/nostr';
import { awaitNDKReady, ndk } from '../lib/ndkSingleton';
import { lightweightProcessPosts, mergeProcessedPosts } from '../utils/feedProcessor';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { getFastestRelays } from '../utils/feedFetcher';
import { startFeed, subscribeFeed, getFeed } from '../lib/feedManager';

// Global state for caching posts across component instances
const globalState = {
  allPosts: [],
  lastFetchTime: 0,
  isInitialized: false,
  activeSubscription: null,
};

export const useRunFeed = () => {
  // Prefer central manager; hydrate immediately
  const [posts, setPosts] = useState(() => getFeed());
  const [loading, setLoading] = useState(getFeed().length === 0);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // New state for display limit
  const [allPosts, setAllPosts] = useState(globalState.allPosts || []); // Use global cache
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalState.isInitialized);
  const subscriptionRef = useRef(null);
  const fetchedProfilesRef = useRef(new Set());
  const pollingRef = useRef(null);

  // Ensure NDK as soon as the hook is used
  useEffect(() => {
    const initNostr = async () => {
      // Only initialize once
      if (!globalState.isInitialized) {
        await awaitNDKReady();
        globalState.isInitialized = true;
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
        // Only fetch posts that are newer than our most recent post
        const newestPostTime = globalState.allPosts.length > 0 
          ? Math.max(...globalState.allPosts.map(p => p.created_at)) * 1000
          : undefined;
          
        // Only fetch if we haven't fetched in the last 30 seconds
        const now = Date.now();
        if (now - globalState.lastFetchTime < 30000) {
          console.log('Skipping background fetch, last fetch was too recent');
          return;
        }
        
        globalState.lastFetchTime = now;
        
        // Fetch new posts
        const limit = 10; // Fetch just a few new posts
        const runPostsArray = await fetchRunningPosts(limit, newestPostTime);
        
        if (runPostsArray.length === 0) {
          console.log('No new posts found in background fetch');
          return;
        }
        
        console.log(`Background fetch: Found ${runPostsArray.length} new posts`);
        
        // Load supplementary data in parallel
        const supplementaryData = await loadSupplementaryData(runPostsArray);
        
        // Process posts with all the data
        const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
        
        // Update global cache with new posts
        if (processedPosts.length > 0) {
          // Remove duplicates and merge with existing posts
          const existingIds = new Set(globalState.allPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          
          if (newPosts.length > 0) {
            globalState.allPosts = [...newPosts, ...globalState.allPosts];
            
            // Update local state if component is mounted
            setAllPosts(prevPosts => {
              const mergedPosts = [...newPosts, ...prevPosts];
              return mergedPosts;
            });
            
            // Update displayed posts
            setPosts(prevPosts => {
              // Create merged array with new posts at the top
              const mergedPosts = [...newPosts, ...prevPosts];
              
              // Only display up to the display limit
              return mergedPosts.slice(0, displayLimit);
            });
            
            // Update user interactions
            updateUserInteractions(supplementaryData);
          }
        }
      } catch (error) {
        console.error('Error in background fetch:', error);
        // Don't set error state - this is a background operation
      }
    }, 60000);
    
    // Store reference to cleanup
    subscriptionRef.current = timeoutRef.current;
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayLimit]);

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

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Ensure NDK ready first
      await awaitNDKReady();

      // Check if we have cached posts that are recent enough (less than 5 minutes old)
      const now = Date.now();
      const isCacheValid = globalState.allPosts.length > 0 && 
                        (now - globalState.lastFetchTime < 5 * 60 * 1000);
                        
      if (isCacheValid) {
        console.log('Using cached posts from global state');
        setAllPosts(globalState.allPosts);
        setPosts(globalState.allPosts.slice(0, displayLimit));
        setLoading(false);
        
        // Still update in the background for freshness
        setupBackgroundFetch();
        return;
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 21; // Load 21 posts initially (3 pages worth)

      // Fetch posts with running hashtags
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      
      // QUICK-DISPLAY PHASE ─────────────────────────────────────────
      // Show minimally processed posts immediately
      if (runPostsArray.length > 0 && allPosts.length === 0) {
        const quickPosts = lightweightProcessPosts(runPostsArray);
        setAllPosts(quickPosts);
        setPosts(quickPosts.slice(0, displayLimit));
        setLoading(false);
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
        }
        setLoading(false);
        return;
      }
      
      // Load supplementary data in parallel for all posts
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      
      // Merge with quick posts (if any) so we keep order
      const finalPosts = mergeProcessedPosts(allPosts.length ? allPosts : lightweightProcessPosts(runPostsArray), processedPosts);
      
      // Update global cache
      globalState.allPosts = finalPosts;
      globalState.lastFetchTime = now;
      
      // Update state with processed posts
      if (page === 1) {
        setAllPosts(finalPosts);
        setPosts(finalPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = finalPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          
          // Update global cache
          globalState.allPosts = mergedPosts;
          
          return mergedPosts;
        });
        // Update displayed posts
        setPosts(prevPosts => {
          const allPostsCombined = [...prevPosts, ...finalPosts];
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
      
      // Set up background fetch
      setupBackgroundFetch();
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
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

  // Initial load / remount logic
  useEffect(() => {
    const runFirstLoad = async () => {
      // If we already have posts cached globally, hydrate state immediately
      if (globalState.allPosts && globalState.allPosts.length > 0) {
        setAllPosts(globalState.allPosts);
        setPosts(globalState.allPosts.slice(0, displayLimit));
        setLoading(false);

        // Kick off a silent background refresh so content stays fresh
        setupBackgroundFetch();
      }

      // Only re-fetch from the network if we haven't fetched yet this session
      if (!initialLoadRef.current) {
        await fetchRunPostsViaSubscription();
      }
    };

    runFirstLoad();

    // Cleanup when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fetchRunPostsViaSubscription, displayLimit, setupBackgroundFetch]);

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
                      // Get comments from the response
                      let postComments = [];
                      
                      // Check both formats of response for backward compatibility
                      if (commentData[postId]) {
                        // New format with postId keys
                        postComments = commentData[postId];
                      } else if (commentData.comments && commentData.comments.size > 0) {
                        // Original format with Set of comments
                        const commentsArray = Array.from(commentData.comments);
                        
                        // Process comments into the expected format
                        postComments = commentsArray
                          .filter(comment => {
                            // Filter for comments that are replies to this post
                            const eTag = comment.tags?.find(tag => tag[0] === 'e');
                            return eTag && eTag[1] === postId;
                          })
                          .map(comment => ({
                            id: comment.id || `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                            content: comment.content || '',
                            created_at: comment.created_at || Math.floor(Date.now() / 1000),
                            author: {
                              pubkey: comment.pubkey || '',
                              profile: {
                                name: 'Anonymous',
                                picture: undefined
                              }
                            }
                          }));
                      }
                      
                      // Mark comments as loaded and add fetched comments
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        // Use the processed comments, or fallback to existing comments
                        comments: postComments.length > 0 ? postComments : p.comments || []
                      };
                    }
                    return p;
                  });
                });
              })
              .catch(error => {
                console.error('Error loading comments:', error);
                // Even if comments fail to load, mark as loaded to prevent infinite retries
                setPosts(latestPosts => {
                  return latestPosts.map(p => {
                    if (p.id === postId) {
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        comments: p.comments || [] 
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

  // Auto-fetch author metadata for posts still showing placeholder names
  useEffect(() => {
    const missingPosts = posts.filter(p =>
      p && p.author && p.author.pubkey &&
      (!p.author.profile || !p.author.profile.name || p.author.profile.name === 'Loading...') &&
      !fetchedProfilesRef.current.has(p.author.pubkey)
    );

    if (missingPosts.length === 0) return;

    const fetchMissing = async () => {
      try {
        // Mark as fetched to avoid duplicate requests
        missingPosts.forEach(mp => fetchedProfilesRef.current.add(mp.author.pubkey));

        const supplementaryData = await loadSupplementaryData(missingPosts);
        const enrichedPosts = await processPostsWithData(missingPosts, supplementaryData);

        if (enrichedPosts && enrichedPosts.length > 0) {
          setPosts(prev => prev.map(p => {
            const enriched = enrichedPosts.find(e => e.id === p.id);
            return enriched ? { ...p, author: enriched.author } : p;
          }));

          // Also update global cache so other components profit
          globalState.allPosts = globalState.allPosts.map(p => {
            const enriched = enrichedPosts.find(e => e.id === p.id);
            return enriched ? { ...p, author: enriched.author } : p;
          });
        }
      } catch (err) {
        console.warn('Metadata enrichment failed', err);
      }
    };

    fetchMissing();
  }, [posts]);

  /**
   * Real-time profile subscription – fallback for avatars/usernames that didn't arrive
   * This keeps scope local to RunFeed and DOES NOT touch shared NDK flows used by
   * Teams / Chat, so risk of collateral impact is minimal.
   */
  useEffect(() => {
    // Collect pubkeys whose profile is still the placeholder
    const missingPubkeys = posts
      .filter(p => p && p.author && p.author.pubkey && (
        !p.author.profile || p.author.profile.name === 'Loading...'
      ))
      .map(p => p.author.pubkey);

    // Bail if nothing to fetch or if we've already fetched them
    const uniqueMissing = missingPubkeys.filter(pk => !fetchedProfilesRef.current.has(pk));
    if (uniqueMissing.length === 0) return;

    // Mark as requested so we don't set up duplicate subs
    uniqueMissing.forEach(pk => fetchedProfilesRef.current.add(pk));

    if (!ndk || uniqueMissing.length === 0) return;

    let sub;
    try {
      const relays = getFastestRelays(3);
      const relaySet = NDKRelaySet.fromRelayUrls(relays, ndk);
      const candidateSub = ndk.subscribe({ kinds: [0], authors: uniqueMissing, limit: uniqueMissing.length }, { closeOnEose: true, relaySet });

      if (!candidateSub) {
        console.warn('Profile subscription could not be started (ndk returned null)');
        return; // abort effect; will try fallback fetch later
      }

      sub = candidateSub;

      sub.on('event', (profileEvt) => {
        try {
          const pubkey = profileEvt.pubkey;
          if (!pubkey) return;

          let profileData = {};
          try {
            profileData = JSON.parse(profileEvt.content);
          } catch (_) {
            profileData = {};
          }

          const normalized = {
            name: profileData.name || profileData.display_name || 'Anonymous Runner',
            picture: typeof profileData.picture === 'string' ? profileData.picture : undefined,
            lud16: profileData.lud16,
            lud06: profileData.lud06,
          };

          setPosts(prev => prev.map(p =>
            p.author && p.author.pubkey === pubkey
              ? {
                  ...p,
                  author: { ...p.author, profile: { ...p.author.profile, ...normalized } }
                }
              : p
          ));

          // Update global cache too
          globalState.allPosts = globalState.allPosts.map(p =>
            p.author && p.author.pubkey === pubkey
              ? {
                  ...p,
                  author: { ...p.author, profile: { ...p.author.profile, ...normalized } }
                }
              : p
          );
        } catch (err) {
          console.warn('Profile subscription processing failed', err);
        }
      });

      // Fallback: direct fetch each missing profile once
      (async () => {
        try {
          const promises = uniqueMissing.map(async (pk) => {
            try {
              const res = await ndk.fetchEvents({ kinds: [0], authors: [pk], limit: 1 });
              if (res && res.size > 0) {
                const profileEvt = Array.from(res)[0];
                let parsed = {};
                try { parsed = JSON.parse(profileEvt.content); } catch {}
                const normalized = {
                  name: parsed.name || parsed.display_name,
                  picture: typeof parsed.picture === 'string' ? parsed.picture : undefined,
                  lud16: parsed.lud16,
                  lud06: parsed.lud06,
                };
                setPosts(prev => prev.map(p =>
                  p.author && p.author.pubkey === pk
                    ? { ...p, author: { ...p.author, profile: { ...p.author.profile, ...normalized } }, needsProfile: false }
                    : p
                ));
                globalState.allPosts = globalState.allPosts.map(p =>
                  p.author && p.author.pubkey === pk
                    ? { ...p, author: { ...p.author, profile: { ...p.author.profile, ...normalized } }, needsProfile: false }
                    : p
                );
              }
            } catch (err) {
              console.warn('Direct profile fetch failed for', pk, err);
            }
          });
          await Promise.all(promises);
        } catch (_) {}
      })();
    } catch (err) {
      console.warn('Could not start profile subscription', err);
    }

    // Cleanup when posts array changes or component unmounts
    return () => {
      if (sub) sub.stop();
    };
  }, [posts]);

  // --- Central Feed Manager integration ----
  useEffect(() => {
    // Ensure the manager is running (no-op if already started)
    startFeed();
    // Subscribe for updates
    const unsub = subscribeFeed((newPosts) => {
      setPosts(newPosts);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 10-second polling for engagement data of currently displayed posts
  const startEngagementPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const visible = posts.slice(0, displayLimit);
        if (visible.length === 0) return;

        const supp = await loadSupplementaryData(visible);
        const enriched = await processPostsWithData(visible, supp);

        setPosts(prev => prev.map(p => {
          const upd = enriched.find(e => e.id === p.id);
          return upd ? { ...p, likes: upd.likes, reposts: upd.reposts, zaps: upd.zaps, zapAmount: upd.zapAmount, comments: upd.comments } : p;
        }));
      } catch (err) {
        console.warn('Engagement polling error', err);
      }
    }, 10000); // 10 seconds
  }, [posts, displayLimit]);

  useEffect(() => {
    startEngagementPolling();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [startEngagementPolling]);

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

export default useRunFeed; 