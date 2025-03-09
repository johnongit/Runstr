import { useState, useEffect, useCallback, useContext } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { RELAYS, ndk, initializeNostr } from '../utils/nostr';
import { NostrContext } from '../contexts/NostrContext';

export const RunClub = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');
  const { defaultZapAmount } = useContext(NostrContext);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());

  const processAndUpdatePosts = useCallback(async (posts) => {
    try {
      console.log('Processing posts:', posts);
      const authors = [...new Set(posts.map((post) => post.pubkey))];
      const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors
      });

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

      // Fetch comments for all posts
      const comments = await ndk.fetchEvents({
        kinds: [1],
        '#e': posts.map((post) => post.id)
      });

      // Fetch likes for posts (kind 7)
      const likes = await ndk.fetchEvents({
        kinds: [7],
        '#e': posts.map((post) => post.id)
      });

      // Fetch reposts for posts (kind 6)
      const reposts = await ndk.fetchEvents({
        kinds: [6],
        '#e': posts.map((post) => post.id)
      });

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

      // Update likes and reposts state
      setUserLikes(newUserLikes);
      setUserReposts(newUserReposts);

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

      return posts
        .map((post) => {
          const profile = profileMap.get(post.pubkey) || {};
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
            reposts: repostsByPost.get(post.id) || 0
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing posts:', err);
      return posts.sort((a, b) => b.created_at - a.created_at);
    }
  }, []);

  const fetchRunPosts = useCallback(async () => {
    try {
      console.log('Fetching run posts...');
      if (!window.nostr) {
        throw new Error('Please login to view running posts');
      }

      // Ensure NDK is connected
      if (!ndk.pool?.relays?.size) {
        console.log('NDK not connected, connecting...');
        const connected = await initializeNostr();
        if (!connected) {
          throw new Error('Could not connect to relays');
        }
      }

      console.log(
        'NDK ready state:',
        ndk.pool?.relays?.size || 0,
        'relays connected'
      );

      const filter = {
        kinds: [1],
        '#t': ['Runstr', 'Running', 'run', 'running'],
        since: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60,
        limit: 100
      };

      console.log('Fetching events with filter:', filter);

      const events = await ndk.fetchEvents(filter);
      const eventArray = Array.from(events);
      console.log('Number of events:', eventArray.length);

      if (eventArray.length > 0) {
        const processedPosts = await processAndUpdatePosts(eventArray);
        setPosts(processedPosts);
      } else {
        console.log('No events found');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in fetchRunPosts:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [processAndUpdatePosts]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        if (!window.nostr) {
          setError('Please login to view running posts');
          setLoading(false);
          return;
        }

        console.log('NDK initialized, fetching posts...');
        if (mounted) {
          await fetchRunPosts();
        }
      } catch (err) {
        console.error('Error in init:', err);
        if (mounted) {
          setError('Failed to fetch posts: ' + err.message);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchRunPosts]);

  const handleZap = async (post) => {
    if (!window.nostr) {
      alert('Please login to send zaps');
      return;
    }

    try {
      // Extract LNURL from the post author's profile
      const lnurl = post.author.lud16 || post.author.lud06;
      if (!lnurl) {
        console.log('Author profile:', post.author);
        alert(
          'This user has not set up their Lightning address in their Nostr profile'
        );
        return;
      }

      // Create the zap event
      const zapEvent = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: 'Zap for your run! ⚡️',
        tags: [
          ['p', post.author.pubkey],
          ['e', post.id],
          ['relays', ...RELAYS],
          ['amount', defaultZapAmount.toString()] // Use default zap amount from context
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(zapEvent);

      // Create and publish NDK Event
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();

      // Parse the Lightning address and create the zap request URL
      let zapEndpoint;
      if (lnurl.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lnurl.split('@');
        zapEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      } else {
        // Handle raw LNURL (lud06)
        zapEndpoint = lnurl;
      }

      // First get the LNURL-pay metadata
      const response = await fetch(zapEndpoint);
      const lnurlPayData = await response.json();

      if (!lnurlPayData.callback) {
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }

      // Amount in millisatoshis (convert sats to millisats)
      const amount = defaultZapAmount * 1000;

      // Check if amount is within min/max bounds
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }

      // Construct the callback URL with amount
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      
      // Convert the signed event to a string before appending
      const serializedEvent = JSON.stringify(signedEvent);
      
      // If there's a nostr event, add it to the callback
      callbackUrl.searchParams.append('nostr', serializedEvent);
      
      // Add comment parameter if supported by the endpoint
      if (lnurlPayData.commentAllowed) {
        callbackUrl.searchParams.append('comment', 'Zap for your run! ⚡️');
      }

      // Get the invoice
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();

      if (!invoiceData.pr) {
        console.error('Invalid LNURL-pay response:', invoiceData);
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Use Bitcoin Connect to get the provider and pay
      const { requestProvider } = await import('@getalby/bitcoin-connect');
      const provider = await requestProvider();
      await provider.sendPayment(invoiceData.pr);

      alert('Zap sent successfully! ⚡️');
    } catch (error) {
      console.error('Error sending zap:', error);
      
      // Provide more specific error messages for common issues
      if (error.message.includes('LNURL')) {
        alert('Failed to send zap: There was an issue with the Lightning address. The receiver might need to update their LNURL configuration.');
      } else if (error.message.includes('provider')) {
        alert('Failed to send zap: Could not connect to your Lightning wallet. Please make sure you have a Lightning wallet installed and configured.');
      } else {
        alert('Failed to send zap: ' + error.message);
      }
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
                    ⚡️ Zap
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
