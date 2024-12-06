import { useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools';
import { RELAYS } from '../utils/nostr';

export const RunClub = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pool = new SimplePool();
    let sub;
    
    const fetchRunstrPosts = async () => {
      try {
        const posts = [];
        sub = pool.sub(RELAYS, [{
          kinds: [1],
          '#t': ['runstr', 'Runstr'],
          limit: 20
        }]);

        sub.on('event', event => {
          posts.push(event);
        });

        // Wait for events to collect
        await new Promise(resolve => setTimeout(resolve, 2000));

        const postsWithProfiles = await Promise.all(posts.map(async post => {
          try {
            const profileEvents = await pool.list(RELAYS, [{
              kinds: [0],
              authors: [post.pubkey],
              limit: 1
            }]);

            const profile = profileEvents[0] ? JSON.parse(profileEvents[0].content) : {};

            return {
              id: post.id,
              content: post.content,
              created_at: post.created_at,
              author: {
                pubkey: post.pubkey,
                profile
              }
            };
          } catch {
            return {
              id: post.id,
              content: post.content,
              created_at: post.created_at,
              author: {
                pubkey: post.pubkey,
                profile: {}
              }
            };
          }
        }));

        setPosts(postsWithProfiles.sort((a, b) => b.created_at - a.created_at));
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch Runstr posts');
        console.error('Error fetching posts:', err);
        setLoading(false);
      }
    };

    fetchRunstrPosts();

    return () => {
      if (sub) sub.unsub();
      pool.close(RELAYS);
    };
  }, []);

  return (
    <div className="run-club-container">
      <h2>Run Club Feed</h2>
      {loading ? (
        <div>Loading posts...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="posts-list">
          {posts.length === 0 ? (
            <p>No Runstr posts found. Be the first to share your run!</p>
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}; 