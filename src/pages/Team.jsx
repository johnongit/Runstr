import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { ndk, initializeNostr } from '../utils/nostr';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export const Team = () => {
  const navigate = useNavigate();
  const { teamId } = useParams();
  const { pubkey } = useContext(NostrContext);
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myTeams'); // 'myTeams', 'create', 'join', 'teamProfile'
  const [myTeams, setMyTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  
  // New team form data
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    isPublic: true,
    invitees: []
  });
  
  // Load user profiles for team members
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
  
  // Load team messages (NIP-28 kind 42 events for channel messages)
  const loadTeamMessages = useCallback(async (teamId) => {
    try {
      // Fetch channel messages (kind 42)
      const messageEvents = await ndk.fetchEvents({
        kinds: [42], // Channel messages
        '#e': [teamId] // Reference to the channel/team
      });
      
      // Process messages
      const processedMessages = Array.from(messageEvents).map(event => {
        return {
          id: event.id,
          pubkey: event.pubkey,
          content: event.content,
          created_at: event.created_at
        };
      });
      
      // Sort messages by created_at timestamp
      processedMessages.sort((a, b) => a.created_at - b.created_at);
      
      setMessages(processedMessages);
      
      // Load profiles for message authors
      const messagePubkeys = [...new Set(processedMessages.map(msg => msg.pubkey))];
      await loadProfiles(messagePubkeys);
    } catch (err) {
      console.error('Error loading team messages:', err);
    }
  }, [loadProfiles]);
  
  // Load specific team data
  const loadTeam = useCallback(async (id) => {
    try {
      setLoading(true);
      
      // Fetch team/channel creation event (kind 40)
      const teamEvent = await ndk.fetchEvent(id);
      
      if (!teamEvent) {
        setError('Team not found.');
        setLoading(false);
        return;
      }
      
      // Fetch latest channel metadata if available (kind 41)
      const metadataEvents = await ndk.fetchEvents({
        kinds: [41],
        '#e': [id] // Reference to the channel creation event
      });
      
      // Use the latest metadata or the original event data
      let teamData;
      let finalEvent = teamEvent;
      
      if (metadataEvents && metadataEvents.size > 0) {
        // Find the most recent metadata event
        const latestMetadata = Array.from(metadataEvents).sort((a, b) => 
          b.created_at - a.created_at
        )[0];
        
        teamData = JSON.parse(latestMetadata.content);
        finalEvent = latestMetadata;
      } else {
        try {
          teamData = JSON.parse(teamEvent.content);
        } catch (err) {
          console.error('Error parsing team data:', err);
          setError('Invalid team data.');
          return;
        }
      }
      
      // Get member references from p tags
      const members = finalEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      
      // Include the creator if not already in members
      if (!members.includes(teamEvent.pubkey)) {
        members.push(teamEvent.pubkey);
      }
      
      const team = {
        id: teamEvent.id,
        pubkey: teamEvent.pubkey,
        created_at: teamEvent.created_at,
        name: teamData.name || 'Unnamed Team',
        description: teamData.description || '',
        isPublic: teamData.isPublic !== false, // Default to public
        members: [...new Set(members)]
      };
      
      setCurrentTeam(team);
      
      // Load profiles for team members
      await loadProfiles(team.members);
      
      // Load team messages
      await loadTeamMessages(id);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading team:', err);
      setError('Failed to load team data. Please try again later.');
      setLoading(false);
    }
  }, [loadProfiles, loadTeamMessages]);
  
  // Load user's teams
  const loadUserTeams = useCallback(async () => {
    try {
      if (!pubkey) return;
      
      // Fetch teams (channels) where user is a member
      // NIP-28 uses kind 40 for channel creation
      const teamEvents = await ndk.fetchEvents({
        kinds: [40],
        authors: [pubkey] // Teams created by the user
      });

      // Also fetch team metadata events that reference the user
      const teamMetadataEvents = await ndk.fetchEvents({
        kinds: [41], // Channel metadata
        '#p': [pubkey] // Teams that mention the user
      });
      
      // Combine teams and process
      const allTeamEvents = new Set([...teamEvents, ...teamMetadataEvents]);
      
      // Process team events
      const userTeams = Array.from(allTeamEvents).map(event => {
        try {
          const teamData = JSON.parse(event.content);
          
          // Get member references from p tags
          const members = event.tags
            .filter(tag => tag[0] === 'p')
            .map(tag => tag[1]);
          
          return {
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            name: teamData.name || 'Unnamed Team',
            description: teamData.description || '',
            isPublic: teamData.isPublic !== false, // Default to public
            members: [...new Set([event.pubkey, ...members])] // Include creator and members
          };
        } catch (err) {
          console.error('Error processing team event:', err);
          return null;
        }
      }).filter(Boolean); // Remove any null entries
      
      setMyTeams(userTeams);
      
      // Load profiles for team members
      const allMembers = [...new Set(userTeams.flatMap(team => team.members))];
      await loadProfiles(allMembers);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('Failed to load your teams. Please try again later.');
      setLoading(false);
    }
  }, [pubkey, loadProfiles]);
  
  // Initialize Nostr connection and load user's teams
  useEffect(() => {
    const setup = async () => {
      try {
        const connected = await initializeNostr();
        if (!connected) {
          throw new Error('Failed to connect to Nostr relays');
        }
        
        if (teamId) {
          // If teamId is provided in URL, try to join that team
          setActiveTab('teamProfile');
          await loadTeam(teamId);
        } else {
          // Otherwise load user's teams
          await loadUserTeams();
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Setup error:', err);
        setError('Failed to connect to Nostr network. Please try again later.');
        setLoading(false);
      }
    };
    
    setup();
  }, [teamId, pubkey, loadTeam, loadUserTeams]);
  
  // Create a new team (NIP-28 kind 40 for channel creation)
  const createTeam = async () => {
    try {
      if (!pubkey) {
        setError('You must be logged in to create a team.');
        return;
      }
      
      if (!newTeamData.name) {
        setError('Team name is required.');
        return;
      }
      
      // Create a channel creation event (kind 40)
      const event = new NDKEvent(ndk);
      event.kind = 40; // Channel creation
      
      // Set team data in content
      event.content = JSON.stringify({
        name: newTeamData.name,
        description: newTeamData.description,
        isPublic: newTeamData.isPublic,
        picture: '', // Optional channel picture URL
        created_at: Math.floor(Date.now() / 1000)
      });
      
      // Add team members as 'p' tags
      const members = [...newTeamData.invitees].filter(Boolean);
      members.forEach(member => {
        event.tags.push(['p', member]);
      });
      
      // Sign and publish the event
      await event.publish();
      
      // Reset form and refresh teams
      setNewTeamData({
        name: '',
        description: '',
        isPublic: true,
        invitees: []
      });
      
      // Navigate to the new team's profile
      setActiveTab('myTeams');
      await loadUserTeams();
      
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team. Please try again later.');
    }
  };
  
  // Join a team by creating a metadata event that references it and includes the user
  const joinTeam = async (teamId) => {
    try {
      if (!pubkey) {
        setError('You must be logged in to join a team.');
        return;
      }
      
      // Fetch team event
      const teamEvent = await ndk.fetchEvent(teamId);
      
      if (!teamEvent) {
        setError('Team not found.');
        return;
      }
      
      // Parse team data
      let teamData;
      try {
        teamData = JSON.parse(teamEvent.content);
      } catch (err) {
        console.error('Error parsing team data:', err);
        setError('Invalid team data.');
        return;
      }
      // Create a new metadata event for the channel (kind 41)
      const metadataEvent = new NDKEvent(ndk);
      metadataEvent.kind = 41; // Channel metadata
      
      // Copy the team data
      metadataEvent.content = JSON.stringify({
        ...teamData,
        updated_at: Math.floor(Date.now() / 1000)
      });
      
      // Add reference to original channel
      metadataEvent.tags.push(['e', teamId]);
      
      // Copy existing member tags
      teamEvent.tags.forEach(tag => {
        if (tag[0] === 'p') {
          metadataEvent.tags.push(tag);
        }
      });
      
      // Add user as member if not already a member
      const isAlreadyMember = teamEvent.tags.some(tag => 
        tag[0] === 'p' && tag[1] === pubkey
      );
      
      if (!isAlreadyMember) {
        metadataEvent.tags.push(['p', pubkey]);
      }
      
      // Sign and publish the updated event
      await metadataEvent.publish();
      
      // Navigate to the team profile
      navigate(`/team/profile/${teamId}`);
      
    } catch (err) {
      console.error('Error joining team:', err);
      setError('Failed to join team. Please try again later.');
    }
  };
  
  // Leave a team
  const leaveTeam = async (teamId) => {
    try {
      if (!pubkey) {
        setError('You must be logged in to leave a team.');
        return;
      }
      
      // Fetch team event
      const teamEvent = await ndk.fetchEvent(teamId);
      
      if (!teamEvent) {
        setError('Team not found.');
        return;
      }
      
      // Parse team data
      let teamData;
      try {
        teamData = JSON.parse(teamEvent.content);
      } catch (err) {
        console.error('Error parsing team data:', err);
        setError('Invalid team data.');
        return;
      }
      
      // Create a new metadata event for the channel (kind 41)
      const metadataEvent = new NDKEvent(ndk);
      metadataEvent.kind = 41; // Channel metadata
      
      // Copy the team data
      metadataEvent.content = JSON.stringify({
        ...teamData,
        updated_at: Math.floor(Date.now() / 1000)
      });
      // Add reference to original channel
      metadataEvent.tags.push(['e', teamId]);
      
      // Copy existing tags except the user's 'p' tag
      teamEvent.tags.forEach(tag => {
        if (!(tag[0] === 'p' && tag[1] === pubkey)) {
          metadataEvent.tags.push(tag);
        }
      });
      
      // Sign and publish the updated event
      await metadataEvent.publish();
      
      // Navigate back to team list
      setActiveTab('myTeams');
      await loadUserTeams();
      
    } catch (err) {
      console.error('Error leaving team:', err);
      setError('Failed to leave team. Please try again later.');
    }
  };
  
  // Send a message to the team chat (NIP-28 kind 42 for channel message)
  const sendMessage = async () => {
    try {
      if (!pubkey || !currentTeam || !messageText.trim()) {
        return;
      }
      
      // Create a channel message event (kind 42)
      const event = new NDKEvent(ndk);
      event.kind = 42; // Channel message
      
      // Set message content
      event.content = messageText;
      
      // Add reference to the channel
      event.tags.push(['e', currentTeam.id, '', 'root']);
      
      // Sign and publish the event
      await event.publish();
      
      // Clear the message input
      setMessageText('');
      
      // Reload team messages
      await loadTeamMessages(currentTeam.id);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again later.');
    }
  };
  
  // Search for teams
  const searchTeams = async () => {
    try {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      // Fetch public teams/channels (kind 40)
      const teamEvents = await ndk.fetchEvents({
        kinds: [40], // Channel creation events
        limit: 20
      });
      
      // Filter and process teams that match the search query
      const searchResults = Array.from(teamEvents)
        .map(event => {
          try {
            const teamData = JSON.parse(event.content);
            
            // Get member references from p tags
            const members = event.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1]);
            
            // Include creator in members list
            if (!members.includes(event.pubkey)) {
              members.push(event.pubkey);
            }
            
            return {
              id: event.id,
              pubkey: event.pubkey,
              created_at: event.created_at,
              name: teamData.name || 'Unnamed Team',
              description: teamData.description || '',
              isPublic: teamData.isPublic !== false, // Default to public
              members: [...new Set(members)]
            };
          } catch (err) {
            console.error('Error parsing team data:', err);
            return null;
          }
        })
        .filter(team => 
          team && 
          team.isPublic && 
          (team.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           team.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      
      setSearchResults(searchResults);
      
      // Load profiles for team creators and members
      const allPubkeys = [...new Set([
        ...searchResults.map(team => team.pubkey),
        ...searchResults.flatMap(team => team.members)
      ])];
      
      await loadProfiles(allPubkeys);
      
    } catch (err) {
      console.error('Error searching teams:', err);
      setError('Failed to search teams. Please try again later.');
    }
  };
  
  // Add an invitee to the new team form
  const addInvitee = (inviteePubkey) => {
    if (!inviteePubkey || newTeamData.invitees.includes(inviteePubkey)) {
      return;
    }
    
    setNewTeamData({
      ...newTeamData,
      invitees: [...newTeamData.invitees, inviteePubkey]
    });
  };
  
  // Remove an invitee from the new team form
  const removeInvitee = (inviteePubkey) => {
    setNewTeamData({
      ...newTeamData,
      invitees: newTeamData.invitees.filter(pubkey => pubkey !== inviteePubkey)
    });
  };
  
  // Render team list item
  const renderTeamItem = (team, isUserTeam = false) => {
    return (
      <div key={team.id} className="team-item">
        <div className="team-info">
          <h3>{team.name}</h3>
          <p>{team.description}</p>
          <div className="team-members">
            {team.members.slice(0, 4).map(memberPubkey => {
              const profile = profiles.get(memberPubkey) || {};
              return (
                <div key={memberPubkey} className="team-member-avatar">
                  <img
                    src={profile.picture || '/default-avatar.png'}
                    alt={profile.name || 'Team Member'}
                    title={profile.name || 'Team Member'}
                  />
                </div>
              );
            })}
            <span>{team.members.length} members</span>
          </div>
        </div>
        <div className="team-actions">
          {isUserTeam ? (
            <button
              className="view-team-btn"
              onClick={() => {
                setCurrentTeam(team);
                setActiveTab('teamProfile');
                loadTeam(team.id);
              }}
            >
              View Team
            </button>
          ) : (
            <button
              className="join-team-btn"
              onClick={() => joinTeam(team.id)}
            >
              Join Team
            </button>
          )}
        </div>
      </div>
    );
  };
  
  // Render Create Team Tab
  const renderCreateTeamTab = () => {
    return (
      <div className="create-team-tab">
        <h3>Create a New Team</h3>
        <div className="form-group">
          <label htmlFor="team-name">Team Name</label>
          <input
            id="team-name"
            type="text"
            placeholder="Enter team name"
            value={newTeamData.name}
            onChange={(e) => setNewTeamData({...newTeamData, name: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="team-description">Team Description</label>
          <textarea
            id="team-description"
            placeholder="Describe your team"
            value={newTeamData.description}
            onChange={(e) => setNewTeamData({...newTeamData, description: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label>Team Privacy</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="team-privacy"
                checked={newTeamData.isPublic}
                onChange={() => setNewTeamData({...newTeamData, isPublic: true})}
              />
              Public (Anyone can find and join)
            </label>
            <label>
              <input
                type="radio"
                name="team-privacy"
                checked={!newTeamData.isPublic}
                onChange={() => setNewTeamData({...newTeamData, isPublic: false})}
              />
              Private (By invitation only)
            </label>
          </div>
        </div>
        
        <div className="form-group">
          <label>Invite Team Members (Optional)</label>
          <div className="invite-input-group">
            <input
              type="text"
              placeholder="Enter Nostr pubkey"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              onClick={() => addInvitee(searchQuery)}
              disabled={!searchQuery.trim()}
            >
              Add
            </button>
          </div>
          
          {newTeamData.invitees.length > 0 && (
            <div className="invitees-list">
              <h4>Invited Members:</h4>
              {newTeamData.invitees.map(invitee => {
                const profile = profiles.get(invitee) || {};
                return (
                  <div key={invitee} className="invitee-item">
                    <img
                      src={profile.picture || '/default-avatar.png'}
                      alt={profile.name || 'Invited Member'}
                    />
                    <span>{profile.name || invitee.substring(0, 10) + '...'}</span>
                    <button onClick={() => removeInvitee(invitee)}>Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="team-form-actions">
          <button
            className="create-team-btn"
            onClick={createTeam}
            disabled={!newTeamData.name.trim()}
          >
            Create Team
          </button>
          <button
            className="cancel-btn"
            onClick={() => setActiveTab('myTeams')}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };
  
  // Render Join Team Tab
  const renderJoinTeamTab = () => {
    return (
      <div className="join-team-tab">
        <h3>Find Teams to Join</h3>
        <div className="search-teams">
          <input
            type="text"
            placeholder="Search for teams by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button onClick={searchTeams}>Search</button>
        </div>
        
        <div className="teams-list">
          {searchResults.length === 0 ? (
            <p>No teams found. Try a different search term.</p>
          ) : (
            searchResults.map(team => renderTeamItem(team, false))
          )}
        </div>
      </div>
    );
  };
  
  // Render My Teams Tab
  const renderMyTeamsTab = () => {
    return (
      <div className="my-teams-tab">
        <h3>My Teams</h3>
        
        <div className="my-teams-actions">
          <button
            className="create-team-btn"
            onClick={() => setActiveTab('create')}
          >
            Create New Team
          </button>
          <button
            className="join-team-btn"
            onClick={() => setActiveTab('join')}
          >
            Join a Team
          </button>
        </div>
        
        <div className="teams-list">
          {myTeams.length === 0 ? (
            <p>You&apos;re not part of any teams yet. Create or join a team to get started!</p>
          ) : (
            myTeams.map(team => renderTeamItem(team, true))
          )}
        </div>
      </div>
    );
  };
  
  // Render Team Profile Tab
  const renderTeamProfileTab = () => {
    if (!currentTeam) {
      return <div>Team not found.</div>;
    }
    
    return (
      <div className="team-profile-tab">
        <div className="team-header">
          <button
            className="back-btn"
            onClick={() => setActiveTab('myTeams')}
          >
            ← Back to Teams
          </button>
          <h2>{currentTeam.name}</h2>
          <p>{currentTeam.description}</p>
        </div>
        
        <div className="team-content">
          <div className="team-members-section">
            <h3>Team Members ({currentTeam.members.length})</h3>
            <div className="team-members-list">
              {currentTeam.members.map(memberPubkey => {
                const profile = profiles.get(memberPubkey) || {};
                const isCreator = memberPubkey === currentTeam.pubkey;
                
                return (
                  <div key={memberPubkey} className="team-member-item">
                    <img
                      src={profile.picture || '/default-avatar.png'}
                      alt={profile.name || 'Team Member'}
                      className="member-avatar"
                    />
                    <div className="member-info">
                      <h4>{profile.name || memberPubkey.substring(0, 10) + '...'}</h4>
                      {isCreator && <span className="creator-badge">Creator</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="team-chat-section">
            <h3>Team Chat</h3>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <p className="no-messages">No messages yet. Be the first to say hello!</p>
              ) : (
                messages.map(message => {
                  const profile = profiles.get(message.pubkey) || {};
                  const isCurrentUser = message.pubkey === pubkey;
                  
                  return (
                    <div
                      key={message.id}
                      className={`chat-message ${isCurrentUser ? 'current-user' : ''}`}
                    >
                      <img
                        src={profile.picture || '/default-avatar.png'}
                        alt={profile.name || 'Team Member'}
                        className="message-avatar"
                      />
                      <div className="message-content">
                        <div className="message-header">
                          <h4>{profile.name || message.pubkey.substring(0, 10) + '...'}</h4>
                          <span>{new Date(message.created_at * 1000).toLocaleString()}</span>
                        </div>
                        <p>{message.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="chat-input">
              <textarea
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
        
        <div className="team-actions">
          {currentTeam.pubkey === pubkey ? (
            <button className="manage-team-btn">
              Manage Team
            </button>
          ) : (
            <button
              className="leave-team-btn"
              onClick={() => leaveTeam(currentTeam.id)}
            >
              Leave Team
            </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="team-container">
      <h2>RUN CLUB</h2>
      
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          {!teamId && (
            <div className="team-tabs">
              <button
                className={activeTab === 'myTeams' ? 'active' : ''}
                onClick={() => setActiveTab('myTeams')}
              >
                My Teams
              </button>
              <button
                className={activeTab === 'create' ? 'active' : ''}
                onClick={() => setActiveTab('create')}
              >
                Create Team
              </button>
              <button
                className={activeTab === 'join' ? 'active' : ''}
                onClick={() => setActiveTab('join')}
              >
                Join Team
              </button>
            </div>
          )}
          
          <div className="team-content">
            {activeTab === 'myTeams' && renderMyTeamsTab()}
            {activeTab === 'create' && renderCreateTeamTab()}
            {activeTab === 'join' && renderJoinTeamTab()}
            {activeTab === 'teamProfile' && renderTeamProfileTab()}
          </div>
        </>
      )}
    </div>
  );
}; 