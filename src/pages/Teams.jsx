import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFitnessTeams } from '../hooks/useFitnessTeams';
import { Users, Plus, Search, Globe, Lock, MessageCircle } from 'lucide-react';
import './Teams.css';

export const Teams = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('myTeams');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const {
    teams,
    loading,
    error,
    createTeam,
    searchTeams
  } = useFitnessTeams();
  
  // Filter teams by type
  const myFitnessTeams = teams.filter(t => t.type === 'fitness');
  const myNip29Groups = teams.filter(t => t.type === 'nip29');
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchTeams(searchQuery);
      setSearchResults(results);
      setActiveTab('search');
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };
  
  const TeamCard = ({ team }) => {
    const displayName = team.creatorProfile?.name || 
                       team.creatorProfile?.display_name || 
                       `${team.creatorPubkey.slice(0, 8)}...`;
    
    return (
      <div 
        className="team-card"
        onClick={() => navigate(`/teams/${encodeURIComponent(team.id)}`)}
      >
        <div className="team-header">
          {team.picture && (
            <img 
              src={team.picture} 
              alt={team.name}
              className="team-avatar"
            />
          )}
          <div className="team-info">
            <h3>{team.name}</h3>
            <p className="team-meta">
              {team.type === 'fitness' ? (
                <>
                  <Users size={14} />
                  <span>{team.memberCount || 0} members</span>
                  {team.location && (
                    <>
                      <span className="separator">•</span>
                      <span>{team.location}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <MessageCircle size={14} />
                  <span>Group Chat</span>
                </>
              )}
            </p>
          </div>
          <div className="team-badge">
            {team.isPublic ? <Globe size={16} /> : <Lock size={16} />}
          </div>
        </div>
        {team.description && (
          <p className="team-description">{team.description}</p>
        )}
        <div className="team-footer">
          <span className="team-creator">Created by {displayName}</span>
          {team.type === 'nip29' && team.naddr && (
            <button 
              className="chat-button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teams/chat/${encodeURIComponent(team.naddr)}`);
              }}
            >
              Open Chat
            </button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="teams-container">
      <div className="teams-header">
        <h1>Teams</h1>
        <button 
          className="create-team-button"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} />
          Create Team
        </button>
      </div>
      
      <form onSubmit={handleSearch} className="teams-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for teams..."
          className="search-input"
        />
        <button type="submit" disabled={isSearching}>
          {isSearching ? 'Searching...' : <Search size={20} />}
        </button>
      </form>
      
      <div className="teams-tabs">
        <button
          className={`tab ${activeTab === 'myTeams' ? 'active' : ''}`}
          onClick={() => setActiveTab('myTeams')}
        >
          My Teams ({myFitnessTeams.length})
        </button>
        <button
          className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Chat Groups ({myNip29Groups.length})
        </button>
        {searchResults.length > 0 && (
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search Results ({searchResults.length})
          </button>
        )}
      </div>
      
      <div className="teams-content">
        {loading && teams.length === 0 ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading teams...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>Error loading teams: {error}</p>
          </div>
        ) : (
          <>
            {activeTab === 'myTeams' && (
              <div className="teams-grid">
                {myFitnessTeams.length === 0 ? (
                  <div className="empty-state">
                    <Users size={48} />
                    <h3>No teams yet</h3>
                    <p>Create or join a team to get started</p>
                  </div>
                ) : (
                  myFitnessTeams.map(team => (
                    <TeamCard key={team.id} team={team} />
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'groups' && (
              <div className="teams-grid">
                {myNip29Groups.length === 0 ? (
                  <div className="empty-state">
                    <MessageCircle size={48} />
                    <h3>No chat groups</h3>
                    <p>Your NIP-29 compatible groups will appear here</p>
                  </div>
                ) : (
                  myNip29Groups.map(group => (
                    <TeamCard key={group.id} team={group} />
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'search' && (
              <div className="teams-grid">
                {searchResults.map(team => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      {showCreateModal && (
        <CreateTeamModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={createTeam}
        />
      )}
    </div>
  );
};

// Create Team Modal Component
const CreateTeamModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    picture: '',
    location: '',
    teamType: 'running_club',
    isPublic: true,
    createNip29Group: true
  });
  const [creating, setCreating] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setCreating(true);
    try {
      await onCreate(formData);
      onClose();
    } catch (err) {
      console.error('Error creating team:', err);
      alert('Failed to create team: ' + err.message);
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Create New Team</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Team Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Enter team name"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="What's your team about?"
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label>Team Picture URL</label>
            <input
              type="url"
              value={formData.picture}
              onChange={(e) => setFormData({...formData, picture: e.target.value})}
              placeholder="https://example.com/team-logo.jpg"
            />
          </div>
          
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="City, Country"
            />
          </div>
          
          <div className="form-group">
            <label>Team Type</label>
            <select
              value={formData.teamType}
              onChange={(e) => setFormData({...formData, teamType: e.target.value})}
            >
              <option value="running_club">Running Club</option>
              <option value="cycling_team">Cycling Team</option>
              <option value="fitness_group">General Fitness</option>
              <option value="triathlon">Triathlon Team</option>
            </select>
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
              />
              Public Team (Anyone can join)
            </label>
          </div>
          
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.createNip29Group}
                onChange={(e) => setFormData({...formData, createNip29Group: e.target.checked})}
              />
              Create linked chat group (NIP-29 compatible)
            </label>
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={creating}>
              Cancel
            </button>
            <button type="submit" disabled={creating || !formData.name.trim()}>
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 