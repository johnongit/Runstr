import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { fetchUserGroupList } from '../utils/nostrClient';
import { nip19 } from 'nostr-tools'; // Import nip19 for encoding naddr

const MyClubsScreen = () => {
  const navigate = useNavigate();
  const { publicKey } = useContext(NostrContext);
  const [myGroups, setMyGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cachedGroups, setCachedGroups] = useState([]);

  useEffect(() => {
    if (publicKey) {
      // Load cached groups immediately
      loadCachedGroups(publicKey);
      // Fetch fresh list from relays
      loadMyGroups(publicKey);
    } else {
      // Not logged in with Nostr
      setIsLoading(false);
      setMyGroups([]);
    }
  }, [publicKey]);

  const loadCachedGroups = (pubkey) => {
    try {
      const cacheKey = `my_nostr_groups_${pubkey}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData);
        setCachedGroups(parsedCache); // Store cached data separately initially
        setMyGroups(parsedCache); // Display cached data while loading fresh
        setIsLoading(false); // Show cached data immediately
      }
    } catch (err) {
       console.error("Error loading cached groups:", err);
    }
  };

  const loadMyGroups = async (pubkey) => {
    if (!isLoading && cachedGroups.length > 0) {
       // Already showing cached data, keep isLoading false for background refresh
    } else {
       setIsLoading(true); // Only set loading if no cache is shown
    }
    setError(null);
    
    try {
      const groups = await fetchUserGroupList(pubkey);
      setMyGroups(groups);
      
      // Cache the fresh list
      try {
        const cacheKey = `my_nostr_groups_${pubkey}`;
        localStorage.setItem(cacheKey, JSON.stringify(groups));
      } catch (cacheError) {
         console.error("Error caching groups:", cacheError);
      }

    } catch (err) {
      console.error('Error loading My Clubs:', err);
      setError('Failed to load your clubs. Please try again.');
      // Keep showing cached groups if fetch fails
      if(cachedGroups.length > 0) {
         setMyGroups(cachedGroups);
      } else {
         setMyGroups([]);
      }
    } finally {
      // Always set loading to false after fetch attempt completes
      setIsLoading(false);
    }
  };

  // Construct naddr from group data parts
  const constructNaddr = (group) => {
    if (!group.identifierData) return null;
    try {
      return nip19.naddrEncode({
        identifier: group.identifierData.identifier,
        pubkey: group.identifierData.pubkey,
        kind: group.identifierData.kind,
        relays: group.identifierData.relay ? [group.identifierData.relay] : [],
      });
    } catch (e) {
      console.error("Error encoding naddr:", e);
      return null;
    }
  };

  // Navigate to the group chatroom
  const goToGroupChat = (group) => {
    const naddr = constructNaddr(group);
    if (naddr) {
      navigate(`/team/${naddr}`);
    } else {
       alert("Could not generate address for this group.");
    }
  };

  // Render a group card (similar to GroupDiscoveryScreen)
  const renderGroupCard = (item) => {
    return (
      <div 
        key={item.id}
        className="bg-gray-800 rounded-lg p-4 mb-4 cursor-pointer hover:bg-gray-750"
        onClick={() => goToGroupChat(item)}
      >
        <div className="flex items-center mb-3">
          {item.metadata.picture ? (
            <img 
              src={item.metadata.picture} 
              alt={item.metadata.name || 'Group'}
              className="w-12 h-12 rounded-full mr-3 bg-gray-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full mr-3 bg-blue-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {item.metadata.name ? item.metadata.name.charAt(0).toUpperCase() : '#'}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-white font-bold">{item.metadata.name || 'Unnamed Group'}</h3>
            <p className="text-gray-400 text-xs">
              Kind: {item.kind} • ID: {item.identifierData?.identifier.slice(0,8)}...
            </p>
          </div>
        </div>
        <p className="text-gray-300 mb-4 line-clamp-3">
          {item.metadata.about || 'No description available'}
        </p>
        <div className="mt-2 flex justify-end">
          <button className="bg-green-600 text-white font-bold py-2 px-4 rounded">
            View Group
          </button>
        </div>
      </div>
    );
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <button 
            onClick={() => navigate('/teams')}
            className="text-gray-400 p-1 hover:bg-gray-700 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">My Clubs</h1>
          <div className="w-6"></div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 h-[calc(100vh-64px)]">
          <p className="text-gray-400 text-center mb-2">Please connect with Nostr in Settings to see your clubs.</p>
          <button 
            className="mt-4 bg-blue-600 text-white font-bold py-2 px-4 rounded"
            onClick={() => navigate('/settings')}
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <button 
          onClick={() => navigate('/teams')}
          className="text-gray-400 p-1 hover:bg-gray-700 rounded"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">My Clubs</h1>
        <div className="w-6"></div>
      </div>
      
      {error && (
        <div className="m-4 p-3 bg-gray-800 border border-red-800 rounded-lg text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button 
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded"
            onClick={() => loadMyGroups(publicKey)}
          >
            Retry
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-6 h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading your clubs...</p>
        </div>
      ) : (
        <>
          {myGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 h-[calc(100vh-64px)]">
              <p className="text-gray-400 text-center mb-2">You haven't joined any Nostr clubs yet.</p>
              <p className="text-gray-500 text-center mb-6">Use another Nostr client to join clubs, or check out the Discover tab.</p>
              <button 
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded"
                onClick={() => navigate('/discover-clubs')}
              >
                Discover Clubs
              </button>
            </div>
          ) : (
            <div className="p-4 overflow-auto">
              {myGroups.map(group => renderGroupCard(group))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyClubsScreen; 