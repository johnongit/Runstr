import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useTeams } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';
import ResponsiveClubTabs from '../components/ResponsiveClubTabs';
import { fetchEvents } from '../utils/nostrClient';
import { 
  parseNaddr, 
  fetchGroupMetadata, 
  fetchGroupMessages,
  sendGroupMessage 
} from '../utils/nostrClient';
import '../components/RunClub.css';

// Create Announcement Button Component
const CreateAnnouncementButton = ({ teamId, onAnnouncementCreated }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { pinPost } = useTeams();
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const result = await pinPost(teamId, {
        title: formData.title.trim(),
        content: formData.content.trim()
      });
      
      if (result) {
        // Reset form and close modal
        setFormData({ title: '', content: '' });
        setIsModalOpen(false);
        
        // Notify parent component of new announcement
        if (onAnnouncementCreated) {
          onAnnouncementCreated(result);
        }
      } else {
        setError('Failed to create announcement. Please try again.');
      }
    } catch (err) {
      console.error('Error creating announcement:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setError('');
    setFormData({ title: '', content: '' });
  };
  
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Create Announcement
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a222e] rounded-lg max-w-lg w-full p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-xl font-semibold mb-4">Create Club Announcement</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Announcement Title"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="content" className="block text-sm font-medium mb-2">
                  Content *
                </label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="Announcement content..."
                  rows={5}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// Add PropTypes
CreateAnnouncementButton.propTypes = {
  teamId: PropTypes.string.isRequired,
  onAnnouncementCreated: PropTypes.func
};

export const TeamDetail = () => {
  const { naddr, name } = useParams();
  const navigate = useNavigate();
  const { publicKey } = useContext(NostrContext);
  
  // Local state for the Nostr group
  const [groupInfo, setGroupInfo] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);

  // User profiles cache
  const [userProfiles, setUserProfiles] = useState(new Map());
  
  // Parse naddr and fetch group data on mount
  useEffect(() => {
    loadGroupData();
  }, [naddr]);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Load the group data from the naddr
  const loadGroupData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Parse the naddr
      const parsedInfo = parseNaddr(naddr);
      if (!parsedInfo) {
        throw new Error('Invalid group identifier');
      }
      
      setGroupInfo(parsedInfo);
      
      // Fetch group metadata
      const groupMetadata = await fetchGroupMetadata(
        parsedInfo.kind,
        parsedInfo.pubkey,
        parsedInfo.identifier,
        parsedInfo.relays
      );
      
      if (!groupMetadata) {
        throw new Error('Group not found');
      }
      
      setMetadata(groupMetadata);
      
      // Fetch messages
      await loadMessages(parsedInfo);
      
      // Load pinned messages from local storage
      loadPinnedMessages();
    } catch (error) {
      console.error('Error loading group data:', error);
      setError(error.message || 'Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load messages for the group
  const loadMessages = async (groupData) => {
    try {
      const messages = await fetchGroupMessages(groupData);
      setMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    }
  };
  
  // Load pinned messages from local storage
  const loadPinnedMessages = () => {
    try {
      const pinnedStorageKey = `pinned_messages_${naddr}`;
      const stored = localStorage.getItem(pinnedStorageKey);
      if (stored) {
        setPinnedMessages(JSON.parse(stored));
      } else {
        setPinnedMessages([]);
      }
    } catch (error) {
      console.error('Error loading pinned messages:', error);
      setPinnedMessages([]);
    }
  };
  
  // Pin a message
  const pinMessage = (message) => {
    try {
      // Only allow if user is authenticated
      if (!publicKey) {
        setError('You must be authenticated with Nostr to pin messages');
        return;
      }
      
      // Add to pinned messages if not already pinned
      if (!pinnedMessages.some(pinned => pinned.id === message.id)) {
        const updatedPinned = [...pinnedMessages, message];
        setPinnedMessages(updatedPinned);
        
        // Save to local storage
        const pinnedStorageKey = `pinned_messages_${naddr}`;
        localStorage.setItem(pinnedStorageKey, JSON.stringify(updatedPinned));
      }
    } catch (error) {
      console.error('Error pinning message:', error);
      setError('Failed to pin message');
    }
  };
  
  // Unpin a message
  const unpinMessage = (messageId) => {
    try {
      // Only allow if user is authenticated
      if (!publicKey) {
        setError('You must be authenticated with Nostr to unpin messages');
        return;
      }
      
      const updatedPinned = pinnedMessages.filter(message => message.id !== messageId);
      setPinnedMessages(updatedPinned);
      
      // Save to local storage
      const pinnedStorageKey = `pinned_messages_${naddr}`;
      localStorage.setItem(pinnedStorageKey, JSON.stringify(updatedPinned));
    } catch (error) {
      console.error('Error unpinning message:', error);
      setError('Failed to unpin message');
    }
  };
  
  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !groupInfo || !publicKey) {
      return;
    }
    
    setIsSending(true);
    
    try {
      const sentMessage = await sendGroupMessage(groupInfo, messageText.trim());
      if (sentMessage) {
        setMessageText('');
        // Optimistically add the message to the list
        setMessages(prev => [...prev, sentMessage]);
      } else {
        setError('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };
  
  // Scroll to the bottom of the chat
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };
  
  // If user is not authenticated with Nostr, show a warning
  if (!publicKey) {
    return (
      <div className="p-4 bg-gray-800 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white mb-4">Connect with Nostr</h1>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-yellow-300">
              You need to connect with Nostr to view this running club.
              Please go to settings and connect your Nostr account.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-800 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !metadata) {
    return (
      <div className="p-4 bg-gray-800 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white mb-4">Error</h1>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error || 'Failed to load group data'}</p>
          </div>
          <button
            onClick={() => navigate('/teams')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Back to Running Clubs
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Group Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/teams')}
            className="mr-4 text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          <div className="flex items-center">
            {metadata.metadata.picture ? (
              <img 
                src={metadata.metadata.picture} 
                alt={metadata.metadata.name} 
                className="w-12 h-12 rounded-full mr-4"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mr-4">
                <span className="text-white text-xl font-bold">
                  {metadata.metadata.name?.charAt(0) || '#'}
                </span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold text-white">
                {metadata.metadata.name || 'Running Club'}
              </h1>
              <p className="text-gray-400 text-sm">
                {metadata.metadata.about || 'A Nostr running community'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-700 mb-4">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-2 px-1 ${
                activeTab === 'chat'
                  ? 'text-white border-b-2 border-blue-500 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`pb-2 px-1 ${
                activeTab === 'events'
                  ? 'text-white border-b-2 border-blue-500 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={`pb-2 px-1 ${
                activeTab === 'challenges'
                  ? 'text-white border-b-2 border-blue-500 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Challenges
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === 'chat' && (
            <div>
              {/* Pinned Messages */}
              {pinnedMessages.length > 0 && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-300 mb-2">Pinned Messages</h3>
                  <div className="space-y-2">
                    {pinnedMessages.map(message => (
                      <div key={message.id} className="flex justify-between items-start p-2 bg-blue-800/20 rounded">
                        <div>
                          <p className="text-sm text-gray-300">{message.content}</p>
                          <p className="text-xs text-gray-500">
                            {message.pubkey.slice(0, 8)}... • {formatTimestamp(message.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => unpinMessage(message.id)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Chat Messages */}
              <div className="bg-gray-900 rounded-lg p-4 mb-4 overflow-y-auto" style={{ maxHeight: '60vh', minHeight: '40vh' }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32">
                    <p className="text-gray-500">No messages yet</p>
                    <p className="text-gray-600 text-sm">Be the first to say hello!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(message => (
                      <div key={message.id} className="group" title={message.id}>
                        <div className="flex">
                          <div className="flex-shrink-0 mr-3">
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                              <span className="text-white text-sm">
                                {message.pubkey.slice(0, 2)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <span className="font-medium text-gray-300">
                                {message.pubkey.slice(0, 8)}...
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {formatTimestamp(message.created_at)}
                              </span>
                              <button
                                onClick={() => pinMessage(message)}
                                className="ml-2 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Pin message"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                              </button>
                            </div>
                            <p className="text-gray-200">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              
              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 p-2 bg-gray-700 text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 rounded-r-md disabled:bg-blue-800 disabled:cursor-not-allowed"
                  disabled={!messageText.trim() || isSending}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}
          
          {activeTab === 'events' && (
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-white mb-4">Events</h3>
              <p className="text-gray-400">Coming Soon</p>
              <p className="text-gray-500 text-sm mt-2">
                Organize group runs and events with your running club
              </p>
            </div>
          )}
          
          {activeTab === 'challenges' && (
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-white mb-4">Challenges</h3>
              <p className="text-gray-400">Coming Soon</p>
              <p className="text-gray-500 text-sm mt-2">
                Create and participate in running challenges with your club
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDetail; 