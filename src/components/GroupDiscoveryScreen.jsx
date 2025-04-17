import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGroup, hasJoinedGroup, getUserPublicKey } from '../utils/nostrClient';

// Hardcoded groups for RUNSTR app
const FEATURED_GROUPS = [
  {
    name: "Messi Run Club",
    description: "Join Messi's running community! Share your runs, get inspired, and connect with fellow runners.",
    naddr: "naddr1qqxnzd3cxyerxd3h8qerwwfcqgsgydql6q7lj0wfkxycclqfvxqqzg4mhxue69uhhyetvv9ujuerpd46hxtnfdehhytnwdaehgu3wwa5kuapwqqqp65wkk2pqz",
    relay: "wss://groups.0xchat.com",
    members: 42,
    tags: ["Football", "Running", "Community"]
  },
  {
    name: "#RUNSTR",
    description: "The official RUNSTR community. Share your achievements, get tips, and connect with runners worldwide!",
    naddr: "naddr1qqxnzd3cxyerxd3h8qerwwfcqgsgydql6q7lj0wfkxycclqfvxqqzg4mhxue69uhhyetvv9ujuerpd46hxtnfdehhytnwdaehgu3wwa5kuapwqqqp65wkk2pqz",
    relay: "wss://groups.0xchat.com",
    members: 156,
    tags: ["Official", "Community", "Running"]
  }
];

const GroupDiscoveryScreen = () => {
  const navigate = useNavigate();
  const [joinedGroups, setJoinedGroups] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check join status when component mounts
    checkJoinStatus();
  }, []);

  // Simplified function to check join status for the two groups
  const checkJoinStatus = async () => {
    const pubkey = await getUserPublicKey();
    if (!pubkey) return;

    try {
      const statusMap = {};
      // Check join status for each group
      for (const group of FEATURED_GROUPS) {
        statusMap[group.naddr] = await hasJoinedGroup(group.naddr);
      }
      setJoinedGroups(statusMap);
    } catch (error) {
      console.error("Error checking join status:", error);
      // Don't show error to user, just fail silently
    }
  };

  // Navigate to group chat
  const handleGroupPress = (group) => {
    navigate(`/teams/${group.naddr}`, { 
      state: { 
        group,
        isNostrGroup: true
      }
    });
  };

  // Join a group
  const handleJoinGroup = async (group) => {
    const pubkey = await getUserPublicKey();
    if (!pubkey) {
      alert("Authentication Required: Please connect your Nostr key in Settings to join groups.");
      return;
    }

    setIsLoading(true);
    try {
      const success = await joinGroup(group);
      if (success) {
        // Update local join status
        setJoinedGroups(prev => ({
          ...prev,
          [group.naddr]: true
        }));
        
        // Cache join status in localStorage for persistence
        try {
          const joinedKey = `joined_group_${group.naddr}`;
          localStorage.setItem(joinedKey, "true");
        } catch (cacheError) {
          console.error("Error caching join status:", cacheError);
        }
        
        alert(`Success: You've joined ${group.name}!`);
      } else {
        throw new Error("Failed to join group");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      alert("Error: Failed to join the group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to render tags
  const renderTags = (tags) => (
    <div className="flex flex-wrap gap-2 mb-4">
      {tags.map((tag, index) => (
        <span key={index} className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded-md">
          #{tag}
        </span>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-2xl font-bold text-white mb-2">Discover Running Groups</h1>
      <p className="text-gray-400 mb-6">Join a community of runners and share your journey</p>
      
      {FEATURED_GROUPS.map((group, index) => (
        <div 
          key={index} 
          className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700 cursor-pointer hover:bg-gray-750"
          onClick={() => handleGroupPress(group)}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-white">{group.name}</h2>
            <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full">
              {group.members} members
            </span>
          </div>
          
          <p className="text-gray-300 mb-4">{group.description}</p>
          
          {renderTags(group.tags)}
          
          <div className="border-t border-gray-700 pt-3 mt-1">
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the parent's onClick
                handleJoinGroup(group);
              }}
              disabled={isLoading || joinedGroups[group.naddr]}
              className={`px-4 py-2 rounded-md bg-gray-700 float-right
                ${(isLoading || joinedGroups[group.naddr]) 
                  ? 'opacity-60 cursor-not-allowed text-gray-400' 
                  : 'text-blue-400 hover:bg-gray-600'}`}
            >
              {joinedGroups[group.naddr] 
                ? "Joined ✓" 
                : isLoading 
                  ? "Joining..." 
                  : "Join Group"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupDiscoveryScreen; 