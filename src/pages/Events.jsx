import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { ndk, initializeNostr } from '../utils/nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export const Events = () => {
  const { publicKey, isNostrReady } = useContext(NostrContext);
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard', 'myEvents', 'upcoming'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [weekdayLeaderboard, setWeekdayLeaderboard] = useState([]);
  const [weekendLeaderboard, setWeekendLeaderboard] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  const [joinSuccess, setJoinSuccess] = useState(false);
  
  // Event definitions wrapped in useMemo
  const events = useMemo(() => [
    {
      id: 'weekday-5k',
      name: 'Weekday 5K Challenge',
      description: 'Complete a 5K run on any weekday (Monday-Friday) to compete with runners around the world!',
      startTime: 'Monday, 12:00 AM',
      endTime: 'Friday, 11:59 PM',
      rules: [
        'Run must be exactly 5K (3.1 miles)',
        'Run must be completed on a weekday',
        'GPS tracking must be enabled for verification',
        'Only your fastest weekly run will be counted'
      ],
      isWeekend: false,
      leaderboard: weekdayLeaderboard
    },
    {
      id: 'weekend-5k',
      name: 'Weekend 5K Challenge',
      description: 'Push your limits with a weekend 5K and see how you stack up against the competition!',
      startTime: 'Saturday, 12:00 AM',
      endTime: 'Sunday, 11:59 PM',
      rules: [
        'Run must be exactly 5K (3.1 miles)',
        'Run must be completed on a weekend (Saturday or Sunday)',
        'GPS tracking must be enabled for verification',
        'Only your fastest weekend run will be counted'
      ],
      isWeekend: true,
      leaderboard: weekendLeaderboard
    }
  ], [weekdayLeaderboard, weekendLeaderboard]);
  
  // Convert time string (HH:MM:SS) to seconds for sorting
  const convertTimeToSeconds = useCallback((timeString) => {
    try {
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    } catch {
      return 0;
    }
  }, []);
  
  // Load user profiles
  const loadProfiles = useCallback(async (pubkeys) => {
    try {
      if (!pubkeys.length) return;
      
      const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors: pubkeys
      });
      
      const newProfiles = new Map(profiles);
      
      Array.from(profileEvents).forEach((profile) => {
        try {
          const content = JSON.parse(profile.content);
          newProfiles.set(profile.pubkey, content);
        } catch (err) {
          console.error('Error parsing profile:', err);
          newProfiles.set(profile.pubkey, { name: 'Unknown Runner' });
        }
      });
      
      setProfiles(newProfiles);
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }, [profiles]);
  
  // Load leaderboards
  const loadLeaderboards = useCallback(async () => {
    try {
      // For this example, we'll use kind 1 events with specific tags for event results
      const weekdayResults = await ndk.fetchEvents({
        kinds: [1],
        '#t': ['runstr', 'event', 'weekday-5k']
      });
      
      const weekendResults = await ndk.fetchEvents({
        kinds: [1],
        '#t': ['runstr', 'event', 'weekend-5k']
      });
      
      // Process leaderboard data from events
      const processLeaderboardData = (events) => {
        const results = Array.from(events).map(event => {
          try {
            // Look for time tag - this is required
            const timeTag = event.tags.find(tag => tag[0] === 'time');
            const time = timeTag ? timeTag[1] : null;
            
            // Look for distance tag to verify 5K
            const distanceTag = event.tags.find(tag => tag[0] === 'distance');
            const distance = distanceTag ? parseFloat(distanceTag[1]) : null;
            
            // Only include valid 5K runs (between 4.9 and 5.1 km)
            if (!time || !distance || distance < 4.9 || distance > 5.1) {
              return null;
            }
            
            return {
              id: event.id,
              pubkey: event.pubkey,
              time: time, // Format: "HH:MM:SS"
              seconds: convertTimeToSeconds(time),
              content: event.content, // Use raw content, not JSON parsed
              created_at: event.created_at
            };
          } catch (err) {
            console.error('Error processing leaderboard entry:', err);
            return null;
          }
        }).filter(Boolean); // Remove null entries
        
        // Sort by time (fastest first)
        results.sort((a, b) => a.seconds - b.seconds);
        
        // Add rank
        return results.map((result, index) => ({
          ...result,
          rank: index + 1
        }));
      };
      
      // Process weekday results
      const processedWeekdayResults = processLeaderboardData(weekdayResults);
      setWeekdayLeaderboard(processedWeekdayResults);
      
      // Process weekend results
      const processedWeekendResults = processLeaderboardData(weekendResults);
      setWeekendLeaderboard(processedWeekendResults);
      
      // Load profiles for all participants
      const allPubkeys = [
        ...processedWeekdayResults.map(entry => entry.pubkey),
        ...processedWeekendResults.map(entry => entry.pubkey)
      ];
      
      await loadProfiles([...new Set(allPubkeys)]);
      
    } catch (err) {
      console.error('Error loading leaderboards:', err);
      setError('Failed to load leaderboards. Please try again later.');
    }
  }, [loadProfiles, convertTimeToSeconds]);
  
  // Load user's events
  const loadUserEvents = useCallback(async () => {
    try {
      if (!publicKey) return;
      
      // Fetch user's event participations
      const eventParticipations = await ndk.fetchEvents({
        kinds: [30001], // Custom kind for event participation
        authors: [publicKey]
      });
      
      // Process events
      const userEventsList = Array.from(eventParticipations).map(event => {
        try {
          // Extract event ID from tags
          const eventIdTag = event.tags.find(tag => tag[0] === 'e');
          const eventId = eventIdTag ? eventIdTag[1] : null;
          
          if (!eventId) return null;
          
          // Find corresponding event
          const eventDetails = events.find(e => e.id === eventId);
          
          if (!eventDetails) return null;
          
          return {
            id: event.id,
            eventId: eventId,
            joinedAt: event.created_at,
            eventName: eventDetails.name
          };
        } catch (err) {
          console.error('Error processing event participation:', err);
          return null;
        }
      }).filter(Boolean);
      
      setUserEvents(userEventsList);
      
    } catch (err) {
      console.error('Error loading user events:', err);
    }
  }, [publicKey, events]);
  
  // Initialize connection and load data
  useEffect(() => {
    const setup = async () => {
      try {
        // Set a timeout to prevent hanging if connection fails
        let connected = false;
        try {
          connected = await Promise.race([
            initializeNostr(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
          ]);
        } catch (err) {
          console.warn('Connection warning:', err.message);
          // Continue anyway - we'll use local storage as fallback
        }
        
        if (!connected) {
          console.warn('Failed to connect to Nostr relays, continuing in local mode');
        }
        
        // Check if user is logged in to Nostr
        if (isNostrReady && publicKey) {
          console.log('User authenticated with pubkey:', publicKey);
        } else {
          console.log('User not authenticated, viewing in public mode');
        }
        
        // Load stored events from localStorage even if network fails
        const storedEvents = localStorage.getItem('userEvents');
        if (storedEvents) {
          try {
            setUserEvents(JSON.parse(storedEvents));
          } catch (err) {
            console.error('Error parsing stored events:', err);
          }
        }
        
        try {
          // Try to load from network, but don't block UI if it fails
          await Promise.all([
            loadLeaderboards().catch(err => {
              console.error('Error loading leaderboards:', err);
              return []; // Return empty leaderboards on failure
            }),
            loadUserEvents().catch(err => {
              console.error('Error loading user events:', err);
              return []; // Return empty user events on failure
            })
          ]);
        } catch (err) {
          console.error('Error loading data:', err);
          // Continue anyway - we've already loaded local data
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Setup error:', err);
        setError('Failed to connect to Nostr network. Please try again later.');
        setLoading(false);
      }
    };
    
    setup();
  }, [loadLeaderboards, loadUserEvents, isNostrReady, publicKey]);
  
  // Join an event
  const joinEvent = async (eventId) => {
    try {
      if (!publicKey || !isNostrReady) {
        setError('You must be logged in to join events.');
        return;
      }
      
      // Check if already joined
      const alreadyJoined = userEvents.some(event => event.eventId === eventId);
      
      if (alreadyJoined) {
        setShowEventModal(false);
        setJoinSuccess(true);
        setTimeout(() => setJoinSuccess(false), 3000);
        return;
      }
      
      // Create event participation event
      const event = new NDKEvent(ndk);
      event.kind = 30001; // Custom kind for event participation
      
      // Set content with event details
      const eventData = events.find(e => e.id === eventId);
      event.content = JSON.stringify({
        action: 'join',
        eventName: eventData.name,
        joinedAt: Math.floor(Date.now() / 1000)
      });
      
      // Add event reference
      event.tags.push(['e', eventId]);
      
      // Add event type tag
      event.tags.push(['t', 'runstr', 'event-join']);
      
      // Sign and publish event
      try {
        // Make sure NDK is connected
        if (!ndk.pool?.relays?.size) {
          await initializeNostr();
        }
        
        // Ensure the NDK instance has a signer
        if (!ndk.signer && window.nostr) {
          try {
            // Explicitly set the signer with the window.nostr extension
            const signerPublicKey = await window.nostr.getPublicKey();
            
            // Create a signer adapter for NDK
            ndk.signer = {
              user: { npub: '', pubkey: signerPublicKey },
              signEvent: async (event) => {
                try {
                  return await window.nostr.signEvent(event);
                } catch (err) {
                  console.error('Error signing event:', err);
                  throw err;
                }
              },
              getPublicKey: async () => {
                return signerPublicKey;
              }
            };
          } catch (signerError) {
            console.error('Failed to create signer:', signerError);
            throw new Error('Failed to access Nostr extension for signing');
          }
        }
        
        await event.publish();
        console.log('Successfully joined event:', eventId);
        
        // Store the event join data locally as a fallback
        const newUserEvent = {
          eventId,
          joinedAt: Math.floor(Date.now() / 1000)
        };
        
        // Update local state directly as a fallback
        setUserEvents(prev => [...prev, newUserEvent]);
        
        // Close modal and show success message
        setShowEventModal(false);
        setJoinSuccess(true);
        
        // Reset success message after 3 seconds
        setTimeout(() => setJoinSuccess(false), 3000);
        
      } catch (publishError) {
        console.error('Error publishing event join:', publishError);
        
        // Handle the case where NDK fails but we still want to join the event
        const newUserEvent = {
          eventId,
          joinedAt: Math.floor(Date.now() / 1000)
        };
        
        // Update local state directly
        setUserEvents(prev => [...prev, newUserEvent]);
        
        // Save to localStorage as fallback
        try {
          const storedEvents = JSON.parse(localStorage.getItem('userEvents') || '[]');
          storedEvents.push(newUserEvent);
          localStorage.setItem('userEvents', JSON.stringify(storedEvents));
          
          // Close modal and show success message
          setShowEventModal(false);
          setJoinSuccess(true);
          
          // Reset success message after 3 seconds
          setTimeout(() => setJoinSuccess(false), 3000);
          
        } catch (localStorageError) {
          console.error('Error saving to localStorage:', localStorageError);
          throw new Error('Failed to join event: Could not save locally');
        }
      }
    } catch (err) {
      console.error('Error joining event:', err);
      setError('Failed to join event. Please try again later.');
    }
  };
  
  // Handle event selection
  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };
  
  // Format date for display
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };
  
  // Check if user is participating in an event
  const isParticipating = (eventId) => {
    return userEvents.some(event => event.eventId === eventId);
  };
  
  // Render leaderboard entry
  const renderLeaderboardEntry = (entry) => {
    const profile = profiles.get(entry.pubkey) || {};
    const isCurrentUser = entry.pubkey === publicKey;
    
    return (
      <div 
        key={entry.id} 
        className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}
      >
        <div className="rank">{entry.rank}</div>
        <div className="runner-info">
          <img 
            src={profile.picture || '/default-avatar.png'} 
            alt={profile.name || 'Runner'} 
            className="runner-avatar"
          />
          <span className="runner-name">{profile.name || entry.pubkey.substring(0, 10) + '...'}</span>
        </div>
        <div className="run-time">{entry.time}</div>
        <div className="run-date">{formatDate(entry.created_at)}</div>
      </div>
    );
  };
  
  // Render event modal
  const renderEventModal = () => {
    if (!selectedEvent) return null;

    const participating = isParticipating(selectedEvent.id);

    return (
      <div className="modal-overlay">
        <div className="modal-content event-modal">
          <h3>{selectedEvent.name}</h3>
          
          <div className="event-description">
            <p>{selectedEvent.description}</p>
          </div>
          
          <div className="event-details">
            <div className="event-detail">
              <strong>Start:</strong> {selectedEvent.startTime}
            </div>
            <div className="event-detail">
              <strong>End:</strong> {selectedEvent.endTime}
            </div>
          </div>
          
          <div className="event-rules">
            <h3>Event Rules</h3>
            <ul>
              {selectedEvent.rules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          </div>
          
          {!isNostrReady || !publicKey ? (
            <div className="auth-warning">
              <p>You need to be logged in with Nostr to join this event.</p>
              <p>Please make sure you have granted permissions in Amber Signer.</p>
            </div>
          ) : (
            <button 
              className={`join-event-btn ${participating ? 'joined' : ''}`}
              onClick={() => joinEvent(selectedEvent.id)}
              disabled={participating}
            >
              {participating ? 'Already Joined!' : 'Join Event'}
            </button>
          )}
          
          <button className="close-btn" onClick={() => setShowEventModal(false)}>
            Close
          </button>
        </div>
      </div>
    );
  };
  
  // Render Leaderboard Tab
  const renderLeaderboardTab = () => {
    return (
      <div className="leaderboard-tab">
        <div className="leaderboard-selector">
          <button 
            className={activeTab === 'leaderboard' ? 'active' : ''}
            onClick={() => setActiveTab('leaderboard')}
          >
            Weekday 5K
          </button>
          <button 
            className={activeTab !== 'leaderboard' ? 'active' : ''}
            onClick={() => setActiveTab('weekend')}
          >
            Weekend 5K
          </button>
        </div>
        
        <div className="leaderboard-header">
          <div className="rank">Rank</div>
          <div className="runner-info">Runner</div>
          <div className="run-time">Time</div>
          <div className="run-date">Date</div>
        </div>
        
        <div className="leaderboard-entries">
          {activeTab === 'leaderboard' 
            ? (weekdayLeaderboard.length === 0 
                ? <p className="no-entries">No runs recorded yet. Be the first to complete this challenge!</p>
                : weekdayLeaderboard.map(entry => renderLeaderboardEntry(entry))
              )
            : (weekendLeaderboard.length === 0
                ? <p className="no-entries">No runs recorded yet. Be the first to complete this challenge!</p>
                : weekendLeaderboard.map(entry => renderLeaderboardEntry(entry))
              )
          }
        </div>
      </div>
    );
  };
  
  // Render Upcoming Events Tab
  const renderUpcomingEventsTab = () => {
    return (
      <div className="upcoming-events-tab">
        <h3>Available Events</h3>
        
        <div className="events-grid">
          {events.map(event => (
            <div 
              key={event.id} 
              className={`event-card ${isParticipating(event.id) ? 'participating' : ''}`}
              onClick={() => handleEventSelect(event)}
            >
              <h3>{event.name}</h3>
              <p>{event.description.substring(0, 80)}...</p>
              
              <div className="event-card-footer">
                <span>
                  {isParticipating(event.id) 
                    ? 'You\'re Participating!' 
                    : 'Click to view details'}
                </span>
                {isParticipating(event.id) && <div className="participant-badge"></div>}
              </div>
            </div>
          ))}
          
          <div className="event-card coming-soon">
            <div className="coming-soon-label">Coming Soon</div>
            <h3>RUNSTR LEAGUE</h3>
            <p>Join seasonal leagues and compete with runners worldwide for prizes and recognition!</p>
            
            <div className="event-card-footer">
              <button className="notify-btn">Get Notified</button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render My Events Tab
  const renderMyEventsTab = () => {
    return (
      <div className="my-events-tab">
        <h3>My Events</h3>
        
        {userEvents.length === 0 ? (
          <div className="no-events">
            <p>You haven&apos;t joined any events yet.</p>
            <button 
              className="browse-events-btn"
              onClick={() => setActiveTab('upcoming')}
            >
              Browse Available Events
            </button>
          </div>
        ) : (
          <div className="user-events-list">
            {userEvents.map(event => {
              const eventDetails = events.find(e => e.id === event.eventId);
              if (!eventDetails) return null;
              
              return (
                <div key={event.id} className="user-event-item">
                  <div className="event-info">
                    <h4>{eventDetails.name}</h4>
                    <p>Joined on {formatDate(event.joinedAt)}</p>
                  </div>
                  
                  <button
                    className="view-details-btn"
                    onClick={() => handleEventSelect(eventDetails)}
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  
  // Success notification
  const renderSuccessNotification = () => {
    if (!joinSuccess) return null;
    
    return (
      <div className="success-notification">
        <p>You&apos;ve successfully joined the event! Your next 5K run will be counted for this challenge.</p>
      </div>
    );
  };
  
  return (
    <div className="events-container">
      <h2>COMPETITIONS</h2>
      
      {loading ? (
        <div>Loading events...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="events-tabs">
            <button
              className={activeTab === 'leaderboard' ? 'active' : ''}
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboards
            </button>
            <button
              className={activeTab === 'myEvents' ? 'active' : ''}
              onClick={() => setActiveTab('myEvents')}
            >
              My Events
            </button>
            <button
              className={activeTab === 'upcoming' ? 'active' : ''}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming Events
            </button>
          </div>
          
          {renderSuccessNotification()}
          
          <div className="events-content">
            {activeTab === 'leaderboard' && renderLeaderboardTab()}
            {activeTab === 'myEvents' && renderMyEventsTab()}
            {activeTab === 'upcoming' && renderUpcomingEventsTab()}
          </div>
          
          {showEventModal && renderEventModal()}
        </>
      )}
    </div>
  );
}; 