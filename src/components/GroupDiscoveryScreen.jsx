import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGroup, hasJoinedGroup, getUserPublicKey } from '../utils/nostrClient';

console.log("GroupDiscoveryScreen is loading");

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
  console.log("GroupDiscoveryScreen component rendering");
  const navigate = useNavigate();
  const [joinedGroups, setJoinedGroups] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check join status when component mounts
    checkJoinStatus().catch(err => {
      console.error("Error in checkJoinStatus:", err);
      setError("Failed to check join status. Will continue showing groups anyway.");
    });
  }, []);

  // Simplified function to check join status for the two groups
  const checkJoinStatus = async () => {
    try {
      setIsLoading(true);
      
      const pubkey = await getUserPublicKey();
      if (!pubkey) {
        console.log("No pubkey available, can't check join status");
        return;
      }

      const statusMap = {};
      // Check join status for each group
      for (const group of FEATURED_GROUPS) {
        try {
          statusMap[group.naddr] = await hasJoinedGroup(group.naddr);
        } catch (innerError) {
          console.error(`Error checking join status for ${group.name}:`, innerError);
          statusMap[group.naddr] = false; // Assume not joined if error
        }
      }
      setJoinedGroups(statusMap);
    } catch (error) {
      console.error("Error checking join status:", error);
      // Don't show error to user, just fail silently
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to group chat
  const handleGroupPress = (group) => {
    try {
      navigate(`/teams/${group.naddr}`, { 
        state: { 
          group,
          isNostrGroup: true
        }
      });
    } catch (error) {
      console.error("Error navigating to team detail:", error);
      setError("Failed to navigate to team detail. Please try again.");
    }
  };

  // Join a group
  const handleJoinGroup = async (group) => {
    try {
      const pubkey = await getUserPublicKey();
      if (!pubkey) {
        alert("Authentication Required: Please connect your Nostr key in Settings to join groups.");
        return;
      }

      setIsLoading(true);
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
      
      {error && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          <p className="text-yellow-300 text-sm">{error}</p>
        </div>
      )}
      
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