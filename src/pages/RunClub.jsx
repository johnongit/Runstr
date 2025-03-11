import { useState, useEffect, useCallback, useContext } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk, initializeNostr } from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';

export const RunClub = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const { defaultZapAmount } = useContext(NostrContext);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const { wallet } = useAuth();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const processAndUpdatePosts = useCallback(async (newPosts, append = false) => {
    try {
      if (!newPosts || newPosts.length === 0) {
        if (!append) {
          setPosts([]);
        }
        return;
      }

      console.log('Processing posts:', newPosts);
      const authors = [...new Set(newPosts.map((post) => post.pubkey))];
      
      // Fetch all required data in parallel to speed up loading
      const [profileEvents, comments, likes, reposts, zapReceipts] = await Promise.all([
        ndk.fetchEvents({
          kinds: [0],
          authors
        }),
        ndk.fetchEvents({
          kinds: [1],
          '#e': newPosts.map((post) => post.id)
        }),
        ndk.fetchEvents({
          kinds: [7],
          '#e': newPosts.map((post) => post.id)
        }),
        ndk.fetchEvents({
          kinds: [6],
          '#e': newPosts.map((post) => post.id)
        }),
        ndk.fetchEvents({
          kinds: [9735],
          '#e': newPosts.map((post) => post.id)
        })
      ]);

      const profileMap = new Map(
        Array.from(profileEvents).map((profile) => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      // Get current user's pubkey
      let userPubkey = '';
      try {
        if (window.nostr) {
          userPubkey = await window.nostr.getPublicKey();
        }
      } catch (err) {
        console.error('Error getting user pubkey:', err);
      }

      // Track which posts the current user has liked and reposted
      const newUserLikes = new Set();
      const newUserReposts = new Set();

      // Count likes and reposts per post
      const likesByPost = new Map();
      const repostsByPost = new Map();
      // Track zap amounts by post
      const newZapsByPost = new Map();

      // Process likes
      Array.from(likes).forEach(like => {
        const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          if (!likesByPost.has(postId)) {
            likesByPost.set(postId, 0);
          }
          likesByPost.set(postId, likesByPost.get(postId) + 1);

          // Check if current user liked this post
          if (like.pubkey === userPubkey) {
            newUserLikes.add(postId);
          }
        }
      });

      // Process reposts
      Array.from(reposts).forEach(repost => {
        const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
        if (postId) {
          if (!repostsByPost.has(postId)) {
            repostsByPost.set(postId, 0);
          }
          repostsByPost.set(postId, repostsByPost.get(postId) + 1);

          // Check if current user reposted this post
          if (repost.pubkey === userPubkey) {
            newUserReposts.add(postId);
          }
        }
      });

      // Process zap receipts
      Array.from(zapReceipts).forEach(zapReceipt => {
        try {
          const postId = zapReceipt.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) {
            // Get the zap amount from the bolt11 or amount tag
            let zapAmount = 0;
            
            // First check for a direct amount tag
            const amountTag = zapReceipt.tags.find(tag => tag[0] === 'amount');
            if (amountTag && amountTag[1]) {
              // Amount is in millisatoshis, convert to sats
              zapAmount = parseInt(amountTag[1], 10) / 1000;
            } else {
              // If no amount tag, try to get from bolt11 description
              const bolt11Tag = zapReceipt.tags.find(tag => tag[0] === 'bolt11');
              if (bolt11Tag && bolt11Tag[1]) {
                // For simplicity, we're just counting the zap events - would need lightning 
                // invoice decoding library to get actual amounts from bolt11
                zapAmount = 1; // Count as 1 zap
              }
            }
            
            // Add to post's total zaps
            if (!newZapsByPost.has(postId)) {
              newZapsByPost.set(postId, { count: 0, amount: 0 });
            }
            const postZaps = newZapsByPost.get(postId);
            postZaps.count += 1;
            postZaps.amount += zapAmount;
            newZapsByPost.set(postId, postZaps);
          }
        } catch (err) {
          console.error('Error processing zap receipt:', err);
        }
      });

      // Group comments by their parent post
      const commentsByPost = new Map();
      Array.from(comments).forEach((comment) => {
        const parentId = comment.tags.find((tag) => tag[0] === 'e')?.[1];
        if (parentId) {
          if (!commentsByPost.has(parentId)) {
            commentsByPost.set(parentId, []);
          }
          const profile = profileMap.get(comment.pubkey) || {};
          commentsByPost.get(parentId).push({
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            author: {
              pubkey: comment.pubkey,
              profile: profile
            }
          });
        }
      });

      return newPosts
        .map((post) => {
          const profile = profileMap.get(post.pubkey) || {};
          const postZaps = newZapsByPost.get(post.id) || { count: 0, amount: 0 };
          
          return {
            id: post.id,
            content: post.content,
            created_at: post.created_at,
            author: {
              pubkey: post.pubkey,
              profile: profile,
              lud16: profile.lud16,
              lud06: profile.lud06
            },
            comments: commentsByPost.get(post.id) || [],
            showComments: false,
            likes: likesByPost.get(post.id) || 0,
            reposts: repostsByPost.get(post.id) || 0,
            zaps: postZaps.count,
            zapAmount: postZaps.amount
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing posts:', err);
      return newPosts.sort((a, b) => b.created_at - a.created_at);
    }
  }, []);

  const fetchRunPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await initializeNostr();

      const limit = 10; // Load 10 posts per page
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined; // For paginated loading
  
      // Search for posts with running-related hashtags
      const runPosts = await ndk.fetchEvents({
        kinds: [1], // Regular posts
        limit,
        since,
        "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"]
      });

      const postsArray = Array.from(runPosts).sort((a, b) => b.created_at - a.created_at);
      
      if (postsArray.length < limit) {
        setHasMore(false);
      }
      
      const processedPosts = await processAndUpdatePosts(postsArray, page > 1);
      
      if (page === 1) {
        setPosts(processedPosts);
      } else {
        setPosts(prevPosts => [...prevPosts, ...processedPosts]);
      }
      
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error fetching run posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [page, processAndUpdatePosts]);

  // Load more posts when user scrolls to bottom
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      // Only fetch if this is the first page or initialLoadComplete is true
      // This prevents duplicate loading during initial render
      if ((page === 1 || initialLoadComplete) && mounted) {
        await fetchRunPosts();
      }
    };
    
    init();

    return () => {
      mounted = false;
    };
  }, [fetchRunPosts, page, initialLoadComplete]);

  // Add scroll event listener for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 300
      ) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMorePosts]);

  const handleZap = async (post) => {
    if (!window.nostr) {
      alert('Please login to send zaps');
      return;
    }

    if (!wallet) {
      alert('Please connect a Bitcoin wallet to send zaps');
      return;
    }

    try {
      // Log profile info for debugging
      console.log('Author profile details:', {
        name: post.author.profile.name,
        pubkey: post.author.pubkey,
        lud16: post.author.lud16,
        lud06: post.author.lud06,
      });

      // Check if the author has a Lightning address
      if (!post.author.lud16 && !post.author.lud06) {
        console.log('Author profile:', post.author);
        alert('This user has not set up their Lightning address in their Nostr profile');
        return;
      }

      // First attempt: Try using NDK zap method
      try {
        console.log(`Attempting to zap ${defaultZapAmount} sats using NDK...`);
        
        // Create an NDK event object from the post data
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.id = post.id;
        ndkEvent.pubkey = post.author.pubkey;
        
        // Check NDK version and if zap method exists
        if (!ndkEvent.zap) {
          console.warn('NDK zap method not available. Your NDK version may be outdated.');
          throw new Error('NDK zap method not available');
        }
        
        // Create zap request with detailed error handling
        const zapResult = await ndkEvent.zap(
          defaultZapAmount, // amount in sats
          async (invoice) => {
            console.log('Paying invoice with wallet:', invoice.substring(0, 30) + '...');
            return await wallet.makePayment(invoice);
          },
          'Zap for your run! ⚡️' // optional comment
        );
        
        console.log('NDK Zap successful! Result:', zapResult);
        
        // Update the UI to show the new zap
        setPosts(currentPosts => 
          currentPosts.map(p => {
            if (p.id === post.id) {
              return {
                ...p,
                zaps: (p.zaps || 0) + 1,
                zapAmount: (p.zapAmount || 0) + defaultZapAmount
              };
            }
            return p;
          })
        );

        alert('Zap sent successfully! ⚡️');
        return; // Exit early on success
      } catch (ndkZapError) {
        // Log detailed NDK zap error information
        console.error('NDK zap error:', ndkZapError);
        console.warn('NDK zap failed, falling back to manual approach');
        
        // Continue to fallback implementation
      }
      
      // Fallback implementation: Manual LNURL processing
      console.log('Using fallback manual zap implementation...');
      
      // Extract LNURL from the post author's profile
      const lnurl = post.author.lud16 || post.author.lud06;
      
      // Create zap event manually
      const zapEvent = {
        kind: 9734, // Zap request
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['amount', (defaultZapAmount * 1000).toString()], // millisats
        ],
        pubkey: await window.nostr.getPublicKey()
      };
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(zapEvent);
      
      // Create and publish the NDK Event
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      console.log('Published zap request event:', ndkEvent);
      
      // Parse the Lightning address
      let zapEndpoint;
      if (lnurl.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lnurl.split('@');
        zapEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
        console.log('Using lud16 Lightning address:', lnurl);
      } else {
        // Handle raw LNURL (lud06)
        zapEndpoint = lnurl;
        console.log('Using lud06 LNURL:', lnurl);
      }
      
      // Get LNURL-pay metadata
      console.log('Fetching LNURL-pay metadata from:', zapEndpoint);
      const response = await fetch(zapEndpoint);
      const lnurlPayData = await response.json();
      console.log('LNURL-pay metadata:', lnurlPayData);
      
      if (!lnurlPayData.callback) {
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }
      
      // Amount in millisatoshis
      const amount = defaultZapAmount * 1000;
      
      // Construct callback URL
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      callbackUrl.searchParams.append('nostr', JSON.stringify(signedEvent));
      
      if (lnurlPayData.commentAllowed) {
        callbackUrl.searchParams.append('comment', 'Zap for your run! ⚡️');
      }
      
      // Get invoice
      console.log('Requesting invoice from:', callbackUrl.toString());
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();
      console.log('Invoice response:', invoiceData);
      
      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }
      
      // Pay invoice using wallet
      console.log('Paying invoice with wallet...');
      await wallet.makePayment(invoiceData.pr);
      
      // Update UI
      setPosts(currentPosts => 
        currentPosts.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              zaps: (p.zaps || 0) + 1,
              zapAmount: (p.zapAmount || 0) + defaultZapAmount
            };
          }
          return p;
        })
      );
      
      alert('Zap sent successfully! ⚡️');
    } catch (error) {
      console.error('Error sending zap:', error);
      
      // Provide detailed error message to user
      let errorMessage = 'Failed to send zap: ';
      
      if (error.message.includes('LNURL') || error.message.includes('Lightning')) {
        errorMessage += 'There was an issue with the Lightning address. The receiver might need to update their LNURL configuration.';
      } else if (error.message.includes('wallet') || error.message.includes('provider')) {
        errorMessage += 'Could not connect to your Lightning wallet. Please make sure you have a Lightning wallet installed and configured.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage += `Network error: ${error.message}. This could be due to CORS issues or the service being unavailable.`;
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim() || !window.nostr) {
      alert('Please login and enter a comment');
      return;
    }

    try {
      const commentEvent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId, '', 'reply'],
          ['k', '1']
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(commentEvent);

      // Create NDK Event and publish
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      setCommentText('');
      // Refresh posts to show new comment
      fetchRunPosts();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  const handleCommentClick = (postId) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, showComments: !post.showComments }
          : post
      )
    );
  };

  const handleLike = async (post) => {
    if (!window.nostr) {
      alert('Please login to like posts');
      return;
    }

    try {
      // Create a like event (kind 7)
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', post.id],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(likeEvent);

      // Create and publish NDK Event
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      // Update local state to show the post as liked
      setUserLikes(prev => {
        const newLikes = new Set(prev);
        newLikes.add(post.id);
        return newLikes;
      });

      console.log('Post liked successfully');
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Failed to like post: ' + error.message);
    }
  };

  const handleRepost = async (post) => {
    if (!window.nostr) {
      alert('Please login to repost');
      return;
    }

    try {
      // Create a repost event (kind 6)
      const repostEvent = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', post.id, '', 'mention'],
          ['p', post.author.pubkey]
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(repostEvent);

      // Create and publish NDK Event
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      // Update local state to show the post as reposted
      setUserReposts(prev => {
        const newReposts = new Set(prev);
        newReposts.add(post.id);
        return newReposts;
      });

      console.log('Post reposted successfully');
      alert('Post reposted successfully!');
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost: ' + error.message);
    }
  };

  const extractImagesFromContent = (content) => {
    const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    return content.match(urlRegex) || [];
  };

  return (
    <div className="run-club-container">
      <h2>RUNSTR FEED</h2>
      {loading ? (
        <div>Loading posts...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="posts-list">
          {posts.length === 0 ? (
            <p>
              No running posts found. Follow some runners or post your own runs!
            </p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="post-item">
                <div className="post-header">
                  <img
                    src={post.author.profile.picture || '/default-avatar.png'}
                    alt={post.author.profile.name || 'Anonymous'}
                    className="author-avatar"
                  />
                  <div className="author-info">
                    <h4>{post.author.profile.name || 'Anonymous Runner'}</h4>
                    <span>
                      {new Date(post.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="post-content">
                  {post.content}
                  <div className="post-images">
                    {extractImagesFromContent(post.content).map(
                      (imageUrl, index) => (
                        <img
                          key={index}
                          src={imageUrl}
                          alt="Run activity"
                          className="post-image"
                          onClick={() => window.open(imageUrl, '_blank')}
                        />
                      )
                    )}
                  </div>
                </div>
                <div className="post-actions">
                  <button
                    className="zap-button"
                    onClick={() => handleZap(post)}
                  >
                    ⚡️ {post.zaps > 0 ? post.zaps : ''}
                  </button>
                  <button
                    className={`like-button ${userLikes.has(post.id) ? 'liked' : ''}`}
                    onClick={() => handleLike(post)}
                  >
                    {userLikes.has(post.id) ? '❤️' : '🤍'} {post.likes > 0 ? post.likes : ''}
                  </button>
                  <button
                    className={`repost-button ${userReposts.has(post.id) ? 'reposted' : ''}`}
                    onClick={() => handleRepost(post)}
                  >
                    {userReposts.has(post.id) ? '🔁' : '🔄'} {post.reposts > 0 ? post.reposts : ''}
                  </button>
                  <button
                    className="comment-button"
                    onClick={() => handleCommentClick(post.id)}
                  >
                    💬 {post.comments?.length || 0}
                  </button>
                </div>
                {post.showComments && (
                  <div className="comments-section">
                    <div className="comments-list">
                      {post.comments?.map((comment) => (
                        <div key={comment.id} className="comment-item">
                          <img
                            src={
                              comment.author.profile.picture ||
                              '/default-avatar.png'
                            }
                            alt={comment.author.profile.name}
                            className="comment-avatar"
                          />
                          <div className="comment-content">
                            <strong>
                              {comment.author.profile.name || 'Anonymous'}
                            </strong>
                            <p>{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="comment-input">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === 'Enter' && handleComment(post.id)
                        }
                      />
                      <button onClick={() => handleComment(post.id)}>
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};