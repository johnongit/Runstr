import { useState, useEffect, useCallback, useMemo } from 'react';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { RELAYS } from '../utils/nostr';

export const RunClub = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState('');

  const ndk = useMemo(() => {
    console.log('Initializing NDK...');
    const ndkInstance = new NDK({ 
      explicitRelayUrls: RELAYS,
      enableOutboxModel: false,
      timeout: 30000,
      minRelayCount: 2
    });
    
    (async () => {
      try {
        await ndkInstance.connect();
        const connectedRelays = ndkInstance.pool?.relays?.size || 0;
        console.log(`Connected to ${connectedRelays} relays`);
        if (connectedRelays < 2) {
          console.warn('Connected to fewer than 2 relays');
        }
      } catch (err) {
        console.error('NDK connection error:', err);
        setError('Failed to connect to relays');
      }
    })();
    
    return ndkInstance;
  }, []);

  const processAndUpdatePosts = useCallback(async (posts) => {
    try {
      console.log('Processing posts:', posts);
      const authors = [...new Set(posts.map(post => post.pubkey))];
      const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors
      });
      
      const profileMap = new Map(
        Array.from(profileEvents).map(profile => {
          try {
            return [profile.pubkey, JSON.parse(profile.content)];
          } catch (err) {
            console.error('Error parsing profile:', err);
            return [profile.pubkey, {}];
          }
        })
      );

      return posts
        .map(post => {
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
            }
          };
        })
        .sort((a, b) => b.created_at - a.created_at);
    } catch (err) {
      console.error('Error processing posts:', err);
      return posts.sort((a, b) => b.created_at - a.created_at);
    }
  }, [ndk]);

  const fetchRunPosts = useCallback(async () => {
    try {
      console.log('Fetching run posts...');
      if (!window.nostr) {
        throw new Error('Please login to view running posts');
      }

      let attempts = 0;
      while ((ndk.pool?.relays?.size || 0) === 0 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if ((ndk.pool?.relays?.size || 0) === 0) {
        throw new Error('No relays connected');
      }

      const filter = {
        kinds: [1],
        '#t': ['Runstr', 'Running', 'run', 'running'],
        since: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60,
        limit: 100
      };

      console.log('NDK ready state:', ndk.pool?.relays?.size || 0, 'relays connected');
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
  }, [ndk, processAndUpdatePosts]);

  useEffect(() => {
    let sub;
    
    const init = async () => {
      try {
        if (!window.nostr) {
          setError('Please login to view running posts');
          setLoading(false);
          return;
        }

        console.log('NDK initialized, fetching posts...');
        sub = await fetchRunPosts();
      } catch (err) {
        console.error('Error in init:', err);
        setError('Failed to fetch posts: ' + err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (sub) {
        sub.unsub();
      }
    };
  }, [ndk, fetchRunPosts]);

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
        alert('This user has not set up their Lightning address in their Nostr profile');
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
          ['amount', '1000'], // 1000 sats
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

      // Amount in millisatoshis (1000 sats = 100000 millisats)
      const amount = 1000 * 1000;

      // Check if amount is within min/max bounds
      if (amount < lnurlPayData.minSendable || amount > lnurlPayData.maxSendable) {
        throw new Error(`Amount must be between ${lnurlPayData.minSendable} and ${lnurlPayData.maxSendable} millisats`);
      }

      // Construct the callback URL with amount
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      
      // If there's a nostr event, add it to the callback
      callbackUrl.searchParams.append('nostr', JSON.stringify(signedEvent));

      // Get the invoice
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();

      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Use Bitcoin Connect to get the provider and pay
      const { requestProvider } = await import('@getalby/bitcoin-connect');
      const provider = await requestProvider();
      await provider.sendPayment(invoiceData.pr);

      alert('Zap sent successfully! ⚡️');
    } catch (error) {
      console.error('Error sending zap:', error);
      alert('Failed to send zap: ' + error.message);
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
          ['e', postId],
          ['k', '1'],
        ],
        pubkey: await window.nostr.getPublicKey()
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(commentEvent);
      
      // Create NDK Event and publish
      const ndkEvent = ndk.getEvent(signedEvent);
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
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, showComments: !post.showComments }
        : post
    ));
  };

  return (
    <div className="run-club-container">
      <h2>Running Feed</h2>
      {loading ? (
        <div>Loading posts...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="posts-list">
          {posts.length === 0 ? (
            <p>No running posts found. Follow some runners or post your own runs!</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="post-item">
                <div className="post-header">
                  <img 
                    src={post.author.profile.picture || '/default-avatar.png'} 
                    alt={post.author.profile.name || 'Anonymous'} 
                    className="author-avatar"
                  />
                  <div className="author-info">
                    <h4>{post.author.profile.name || 'Anonymous Runner'}</h4>
                    <span>{new Date(post.created_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
                <div className="post-content">
                  {post.content}
                </div>
                <div className="post-actions">
                  <button 
                    className="zap-button"
                    onClick={() => handleZap(post)}
                  >
                    ⚡️ Zap
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
                      {post.comments?.map(comment => (
                        <div key={comment.id} className="comment-item">
                          <img 
                            src={comment.author.profile.picture || '/default-avatar.png'} 
                            alt={comment.author.profile.name} 
                            className="comment-avatar"
                          />
                          <div className="comment-content">
                            <strong>{comment.author.profile.name || 'Anonymous'}</strong>
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
                        onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                      />
                      <button onClick={() => handleComment(post.id)}>Post</button>
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