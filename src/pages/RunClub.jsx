import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publishToNostr, RELAYS } from '../utils/nostr';
import { SimplePool } from 'nostr-tools';

export const RunClub = () => {
  const [teammates, setTeammates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { teamId } = useParams();
  const navigate = useNavigate();
  const pool = useRef();

  useEffect(() => {
    pool.current = new SimplePool();
    
    return () => {
      if (pool.current) {
        pool.current.close(RELAYS);
      }
    };
  }, []);

  const fetchTeammates = useCallback(async () => {
    if (!window.nostr) return;
    
    try {
      const pubkey = await window.nostr.getPublicKey();
      const teamEvent = await pool.current.list(RELAYS, [{
        kinds: [30000], // Custom kind for team membership
        authors: [pubkey],
        limit: 1
      }]);

      if (teamEvent.length === 0) {
        setLoading(false);
        return;
      }

      const teamMates = teamEvent[0].tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      // Fetch profiles and run histories for each teammate
      const profiles = await pool.current.list(RELAYS, [{
        kinds: [0],
        authors: teamMates
      }]);

      const runHistories = await pool.current.list(RELAYS, [{
        kinds: [1],
        authors: teamMates,
        '#t': ['Runstr']
      }]);

      const teammateData = teamMates.map(pubkey => {
        const profile = profiles.find(p => p.pubkey === pubkey)?.content;
        const runs = runHistories.filter(r => r.pubkey === pubkey);
        return {
          pubkey,
          profile: profile ? JSON.parse(profile) : {},
          runs
        };
      });

      setTeammates(teammateData);
    } catch (err) {
      setError('Failed to fetch teammates');
      console.error('Error fetching teammates:', err);
    } finally {
      setLoading(false);
    }
  }, [pool]);

  const fetchMessages = useCallback(async () => {
    if (!window.nostr) return;

    try {
      const messages = await pool.current.list(RELAYS, [{
        kinds: [7377], // Custom kind for team messages
        '#t': ['runclub'],
        limit: 50
      }]);

      const messageData = await Promise.all(messages.map(async msg => {
        const profile = await pool.current.get(RELAYS, {
          kinds: [0],
          authors: [msg.pubkey]
        });

        return {
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          author: {
            pubkey: msg.pubkey,
            profile: profile ? JSON.parse(profile.content) : {}
          }
        };
      }));

      setMessages(messageData.sort((a, b) => b.created_at - a.created_at));
    } catch (err) {
      setError('Failed to fetch messages');
      console.error('Error fetching messages:', err);
    }
  }, [pool]);

  const handleTeamJoin = useCallback(async (teamId) => {
    if (!window.nostr) {
      navigate('/login');
      return;
    }

    try {
      const event = {
        kind: 30000,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', teamId],
          ['t', 'runclub']
        ],
        content: 'Joined running team'
      };

      await publishToNostr(event);
      await fetchTeammates();
    } catch (err) {
      setError('Failed to join team');
      console.error('Error joining team:', err);
    }
  }, [navigate, fetchTeammates]);

  useEffect(() => {
    if (teamId) {
      handleTeamJoin(teamId);
    }
    if (window.nostr) {
      fetchTeammates();
      fetchMessages();
    }
    
    const currentPool = pool.current; // Capture the pool reference
    return () => {
      currentPool.close(RELAYS);
    };
  }, [teamId, handleTeamJoin, fetchTeammates, fetchMessages, pool]);

  const generateInviteLink = async () => {
    if (!window.nostr) return;
    
    const pubkey = await window.nostr.getPublicKey();
    const link = `${window.location.origin}/club/join/${pubkey}`;
    setInviteLink(link);
  };

  const sendMessage = async () => {
    if (!window.nostr || !newMessage.trim()) return;

    try {
      const event = {
        kind: 7377, // Custom kind for run club messages
        created_at: Math.floor(Date.now() / 1000),
        content: newMessage,
        tags: [['t', 'runclub'], ['team', await window.nostr.getPublicKey()]]
      };

      await publishToNostr(event);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const zapTeammate = async (pubkey, amount) => {
    console.log(`Would zap ${amount} sats to ${pubkey}`);
    // Implementation will use the wallet functionality
    // This will be connected to the Wallet component's sendTokens function
  };

  return (
    <div className="run-club-container">
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <h2>Run Club</h2>
          
          <div className="invite-section">
            <button onClick={generateInviteLink}>Generate Invite Link</button>
            {inviteLink && (
              <div className="invite-link">
                <input type="text" value={inviteLink} readOnly />
                <button onClick={() => navigator.clipboard.writeText(inviteLink)}>
                  Copy
                </button>
              </div>
            )}
          </div>

          <div className="teammates-section">
            <h3>Teammates</h3>
            <div className="teammates-list">
              {teammates.map(teammate => (
                <div key={teammate.pubkey} className="teammate-card">
                  <img src={teammate.picture} alt={teammate.name} />
                  <h4>{teammate.name}</h4>
                  <p>Total Runs: {teammate.runCount}</p>
                  <button onClick={() => zapTeammate(teammate.pubkey, 1000)}>
                    Zap 1000 sats
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="message-board">
            <h3>Team Message Board</h3>
            <div className="messages-list">
              {messages.map(msg => (
                <div key={msg.id} className="message-item">
                  <img src={msg.authorPicture} alt={msg.authorName} />
                  <div className="message-content">
                    <h4>{msg.authorName}</h4>
                    <p>{msg.content}</p>
                    <span>{new Date(msg.created_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="message-input">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 