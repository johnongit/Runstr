import { useState, useEffect, useCallback, useMemo } from 'react';
import NDK from '@nostr-dev-kit/ndk';
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
        .map(post => ({
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          author: {
            pubkey: post.pubkey,
            profile: profileMap.get(post.pubkey) || {}
          }
        }))
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

  const handleLike = async (postId) => {
    if (!window.nostr) {
      alert('Please login to like posts');
      return;
    }

    try {
      const event = {
        kind: 7, // NIP-25 Reactions
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
          ['e', postId],
          ['k', '1'], // Reference to the original post kind
        ],
      };

      await publishToNostr(event);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, liked: true, likeCount: (post.likeCount || 0) + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim() || !window.nostr) {
      alert('Please login and enter a comment');
      return;
    }

    try {
      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: commentText,
        tags: [
          ['e', postId],
          ['k', '1'],
        ],
      };

      await publishToNostr(event);
      setCommentText('');
      // Refresh posts to show new comment
      fetchRunPosts();
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleCommentClick = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, showComments: !post.showComments }
        : post
    ));
  };

  const publishToNostr = async (event) => {
    if (!window.nostr) throw new Error('Nostr not available');
    event.pubkey = await window.nostr.getPublicKey();
    event = await window.nostr.signEvent(event);
    await ndk.publish(event);
    return event;
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
                    className={`like-button ${post.liked ? 'liked' : ''}`}
                    onClick={() => handleLike(post.id)}
                  >
                    {post.liked ? '❤️' : '🤍'} {post.likeCount || 0}
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