import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { ndk, awaitNDKReady } from '../lib/ndkSingleton';
import { nip19, generateSecretKey } from 'nostr-tools';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export const Team = () => {
  const navigate = useNavigate();
  const { pubkey, isInitialized: isNdkInitialized, ndkError: ndkInitError } = useContext(NostrContext);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myTeams');
  const [myTeams, setMyTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    picture: '',
    isPublic: true
  });
  
  const loadProfiles = useCallback(async (pubkeys) => {
    try {
      const uniquePubkeys = [...new Set(pubkeys)].filter(Boolean);
      if (!uniquePubkeys.length) return;
      
      console.log('Team.jsx: Loading profiles for pubkeys:', uniquePubkeys);
      if (!isNdkInitialized) {
          console.log("Waiting for NDK to become ready before fetching profiles...");
          await awaitNDKReady().catch(() => console.warn('NDK not ready within timeout during profile load'));
      }

      const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors: uniquePubkeys
      });
      
      const newProfiles = new Map(profiles);
      
      Array.from(profileEvents).forEach((profile) => {
        try {
          const content = JSON.parse(profile.content);
          newProfiles.set(profile.pubkey, content);
        } catch (err) {
          console.error('Error parsing profile:', err);
          newProfiles.set(profile.pubkey, { name: 'Unknown User' });
        }
      });
      
      setProfiles(newProfiles);
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }, [profiles, isNdkInitialized]);
  
  const loadUserTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!pubkey) {
        console.log('loadUserTeams: No pubkey, cannot load teams.');
        setLoading(false);
        setMyTeams([]);
        return;
      }
      
      console.log(`loadUserTeams: Fetching NIP-29 groups for user ${pubkey}`);

      const createdFilter = {
        kinds: [39000],
        authors: [pubkey],
      };
      const createdEvents = await ndk.fetchEvents(createdFilter);
      console.log(`loadUserTeams: Found ${createdEvents.size} groups created by user.`);

      const memberFilter = {
        kinds: [9002],
        '#p': [pubkey],
      };
      const memberEvents = await ndk.fetchEvents(memberFilter);
      console.log(`loadUserTeams: Found ${memberEvents.size} AddMember events for user.`);

      const potentialGroupIds = new Set();
      const groupIdToLatestAdd = new Map();
      memberEvents.forEach(event => {
        const hTag = event.tags.find(tag => tag[0] === 'h');
        if (hTag && hTag[1]) {
          const groupId = hTag[1];
          potentialGroupIds.add(groupId);
          if (!groupIdToLatestAdd.has(groupId) || event.created_at > groupIdToLatestAdd.get(groupId)) {
            groupIdToLatestAdd.set(groupId, event.created_at);
          }
        }
      });
      console.log('loadUserTeams: Potential Group IDs user was added to:', potentialGroupIds);

      let removedGroupIds = new Set();
      if (potentialGroupIds.size > 0) {
          const removeFilter = {
              kinds: [9003],
              '#p': [pubkey],
              '#h': Array.from(potentialGroupIds),
          };
          const removeEvents = await ndk.fetchEvents(removeFilter);
          console.log(`loadUserTeams: Found ${removeEvents.size} RemoveMember events for user.`);
          
          removeEvents.forEach(event => {
             const hTag = event.tags.find(tag => tag[0] === 'h');
             if (hTag && hTag[1]) {
                 const groupId = hTag[1];
                 const lastAddTimestamp = groupIdToLatestAdd.get(groupId);
                 if (lastAddTimestamp === undefined || event.created_at > lastAddTimestamp) {
                     removedGroupIds.add(groupId);
                 }
             }
          });
          console.log('loadUserTeams: Group IDs user was removed from after last add:', removedGroupIds);
      }
      
      const finalMemberGroupIds = new Set(
          [...potentialGroupIds].filter(id => !removedGroupIds.has(id))
      );
      console.log('loadUserTeams: Final confirmed member group IDs:', finalMemberGroupIds);

      let metadataForMemberGroups = new Map();
      if (finalMemberGroupIds.size > 0) {
          const metadataFilter = {
              kinds: [39000],
              '#d': Array.from(finalMemberGroupIds),
          };
          const metadataEvents = await ndk.fetchEvents(metadataFilter);
          metadataEvents.forEach(event => {
             const dTag = event.tags.find(tag => tag[0] === 'd');
             if (dTag && dTag[1]) {
                 metadataForMemberGroups.set(dTag[1], event);
             }
          });
          console.log(`loadUserTeams: Fetched metadata for ${metadataForMemberGroups.size} groups user is confirmed member of.`);
      }
      
      const allGroupsMap = new Map();

      createdEvents.forEach(event => {
        const dTag = event.tags.find(tag => tag[0] === 'd');
        if (dTag && dTag[1]) {
          allGroupsMap.set(dTag[1], event);
        }
      });

      metadataForMemberGroups.forEach((event, groupId) => {
         if (!allGroupsMap.has(groupId)) {
            allGroupsMap.set(groupId, event);
         }
      });

      const userTeams = Array.from(allGroupsMap.values()).map(event => {
        const dTag = event.tags.find(tag => tag[0] === 'd');
        const groupId = dTag ? dTag[1] : null;
        if (!groupId) return null;
        
        let metadata = {};
        try {
          metadata = JSON.parse(event.content);
        } catch { /* ignore parse error */ }
        
        return {
          groupId: groupId,
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          tags: event.tags,
          metadata: metadata, 
        };
      }).filter(Boolean);

      console.log("loadUserTeams: Final combined user teams for display:", userTeams);
      setMyTeams(userTeams);
      
      const creatorPubkeys = [...new Set(userTeams.map(team => team.pubkey))];
      await loadProfiles(creatorPubkeys);
      
    } catch (err) {
      console.error('Error loading NIP-29 teams:', err);
      setError('Failed to load your teams. Please try again later.');
      setMyTeams([]);
    } finally {
      setLoading(false);
    }
  }, [pubkey, loadProfiles, isNdkInitialized]);
  
  useEffect(() => {
    const setup = async () => {
      try {
        if (!isNdkInitialized) {
            console.log("Team.jsx: Waiting for NDK readiness...");
            const ready = await awaitNDKReady();
            if (!ready && !(ndk.pool?.stats()?.connected > 0)) {
                throw new Error(ndkInitError || 'NDK failed to initialize.');
            }
        }
        console.log("Team.jsx: NDK initialized, loading user teams.");
        await loadUserTeams();

      } catch (err) {
        console.error('Team.jsx Setup error:', err);
        setError(err.message || 'Failed to connect to Nostr network or load teams.');
        setLoading(false);
      }
    };
    
    setup();
  }, [isNdkInitialized, pubkey, loadUserTeams, ndkInitError]);
  
  const createTeam = async () => {
    try {
      if (!pubkey) {
        setError('You must be logged in to create a group.');
        return;
      }
      if (!ndk.signer) {
        setError('Nostr signer not available.');
        console.error('createTeam: NDK signer is missing.');
        return;
      }
      if (!newTeamData.name) {
        setError('Group name is required.');
        return;
      }
      
      const groupId = generateSecretKey().toString('hex');
      console.log(`createTeam: Creating group with ID: ${groupId}`);

      const event = new NDKEvent(ndk);
      event.kind = 39000;
      
      event.content = JSON.stringify({
        name: newTeamData.name,
        about: newTeamData.description,
        picture: newTeamData.picture || '', 
      });
      
      event.tags.push(['d', groupId]); 
      event.tags.push(['p', pubkey, 'admin']);

      console.log('createTeam: Publishing Kind 39000 event:', event.rawEvent());
      await event.publish();
      console.log(`createTeam: Group metadata event ${event.id} published.`);
      
      setNewTeamData({
        name: '',
        description: '',
        picture: '',
        isPublic: true,
      });
      
      setActiveTab('myTeams');
      await loadUserTeams(); 
      
    } catch (err) {
      console.error('Error creating NIP-29 group:', err);
      setError(`Failed to create group: ${err.message}`);
    }
  };

  const searchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
       if (!searchQuery.trim()) {
        setSearchResults([]);
        setLoading(false);
        return;
      }
      console.log(`searchTeams: Searching for groups with query: ${searchQuery}`);

      if (!isNdkInitialized) {
          console.log("Waiting for NDK to become ready before fetching profiles...");
          await awaitNDKReady().catch(() => console.warn('NDK not ready within timeout during profile load'));
      }

      const teamEvents = await ndk.fetchEvents({
        kinds: [39000],
        search: searchQuery,
        limit: 20 
      });
      console.log(`searchTeams: Found ${teamEvents.size} potential groups from search.`);

      const results = [];
      const creatorPubkeys = new Set();
      
      teamEvents.forEach(event => {
        try {
          const metadata = JSON.parse(event.content);
          const dTag = event.tags.find(tag => tag[0] === 'd');
          const groupId = dTag ? dTag[1] : null;

          if (!groupId) return;

          const nameMatch = metadata.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const descMatch = metadata.about?.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (nameMatch || descMatch) {
              results.push({
                  groupId: groupId,
                  id: event.id,
                  pubkey: event.pubkey,
                  created_at: event.created_at,
                  kind: event.kind,
                  tags: event.tags,
                  metadata: metadata, 
              });
              creatorPubkeys.add(event.pubkey);
          }
        } catch (err) {
          console.error('Error processing search result event:', err);
        }
      });
      
      console.log(`searchTeams: Filtered results:`, results);
      setSearchResults(results);
      
      await loadProfiles(Array.from(creatorPubkeys));
      
    } catch (err) {
        console.error('Error searching for NIP-29 groups:', err);
        setError(`Failed to search for groups: ${err.message}`);
        setSearchResults([]);
    } finally {
        setLoading(false);
    }
  };
  
  const renderTeamItem = (team, isUserTeam = false) => {
    const { groupId, pubkey: creatorPubkey, metadata } = team;
    
    let naddr = '';
    try {
      naddr = nip19.naddrEncode({
        identifier: groupId,
        pubkey: creatorPubkey,
        kind: 39000, 
        relays: ['wss://groups.0xchat.com']
      });
    } catch (err) {
        console.error("Failed to encode naddr for team:", team, err);
        return null;
    }
    
    const creatorProfile = profiles.get(creatorPubkey);
    const creatorName = creatorProfile?.name || creatorPubkey?.substring(0, 10) + '...';
    
    return (
      <div 
        key={naddr}
        className="team-item bg-gray-800 p-4 rounded-lg shadow hover:bg-gray-700 transition duration-150 cursor-pointer"
        onClick={() => navigate(`/teams/${encodeURIComponent(naddr)}`)}
      >
        <div className="flex items-center space-x-4">
          <img 
            src={metadata?.picture || 'default-avatar.png'} 
            alt={metadata?.name || 'Group'} 
            className="w-12 h-12 rounded-full object-cover bg-gray-600"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{metadata?.name || 'Unnamed Group'}</h3>
            <p className="text-sm text-gray-400 truncate">{metadata?.about || 'No description'}</p>
            <p className="text-xs text-gray-500 mt-1">Created by: {creatorName}</p>
          </div>
          {!isUserTeam && (
            <button 
              className="join-button bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1 rounded"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teams/${encodeURIComponent(naddr)}`);
              }}
            >
              View
            </button>
          )}
        </div>
      </div>
    );
  };
  
  const renderCreateTeamTab = () => {
    // Debug information
    const debugSignerStatus = ndk.signer ? 'Signer Available' : 'Signer NOT Available';

    return (
      <div className="create-team-tab space-y-4">
        {/* Debug Display Section */}
        <div style={{ padding: '10px', marginBlock: '15px', backgroundColor: '#374151', border: '1px solid #4B5563', borderRadius: '5px', color: 'white' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '5px', color: '#D1D5DB' }}>DEBUG INFO (Create Group Tab)</h4>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Initialized (isNdkInitialized): <span style={{ fontWeight: 'bold' }}>{isNdkInitialized ? 'YES' : 'NO'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Public Key (pubkey): <span style={{ fontWeight: 'bold' }}>{pubkey || 'Not available'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Signer Status: <span style={{ fontWeight: 'bold' }}>{debugSignerStatus}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Init Error (from Context): <span style={{ fontWeight: 'bold' }}>{ndkInitError || 'None'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#FCA5A5' }}>Current Form Error (from setError): <span style={{ fontWeight: 'bold' }}>{error || 'None'}</span></p>
        </div>
        {/* End Debug Display Section */}

        <h3 className="text-xl font-semibold text-white">Create New Group</h3>
        <input
          type="text"
          placeholder="Group Name"
          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
          value={newTeamData.name}
          onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
        />
        <textarea
          placeholder="Group Description (About)"
          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 h-24"
          value={newTeamData.description}
          onChange={(e) => setNewTeamData({ ...newTeamData, description: e.target.value })}
        />
         <input
          type="text"
          placeholder="Group Picture URL (Optional)"
          className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
          value={newTeamData.picture}
          onChange={(e) => setNewTeamData({ ...newTeamData, picture: e.target.value })}
        />
        <button 
            onClick={createTeam}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded disabled:opacity-50"
            disabled={loading || !newTeamData.name}
        >
            {loading ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    );
  };
  
  const renderJoinTeamTab = () => {
    return (
      <div className="join-team-tab space-y-4">
        <h3 className="text-xl font-semibold text-white">Find Groups</h3>
        <div className="search-teams flex space-x-2">
          <input
            type="text"
            placeholder="Search groups by name or description"
            className="flex-grow p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchTeams()}
          />
          <button 
            onClick={searchTeams} 
            className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded disabled:opacity-50"
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        <div className="teams-list space-y-3">
          {searchResults.length === 0 && !loading && (
            <p className="text-gray-500 text-center pt-4">No public groups found matching your search.</p>
          )}
          {searchResults.map(team => renderTeamItem(team, false))}
        </div>
      </div>
    );
  };
  
  const renderMyTeamsTab = () => {
    return (
      <div className="my-teams-tab space-y-4">
        <h3 className="text-xl font-semibold text-white">My Groups</h3>
        
        <div className="teams-list space-y-3">
          {myTeams.length === 0 && !loading && (
            <p className="text-gray-500 text-center pt-4">You haven&apos;t created or joined any groups yet.</p>
          )}
          {myTeams.map(team => renderTeamItem(team, true))}
        </div>
      </div>
    );
  };

  if (ndkInitError) {
    return <div className="container error-message">Error initializing Nostr: {ndkInitError}</div>;
  }
  
  return (
    <div className="container run-club-theme p-4">
      <h2 className="text-2xl font-bold text-white mb-6">Groups</h2>
      
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded-lg mb-4">
          Error: {error}
        </div>
      )}

      <div className="mb-6 flex space-x-1 border-b border-gray-700">
         <button
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'myTeams' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setActiveTab('myTeams')}
         >
             My Groups
         </button>
         <button
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'join' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setActiveTab('join')}
         >
             Find Groups
         </button>
         <button
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${activeTab === 'create' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            onClick={() => setActiveTab('create')}
         >
             Create Group
         </button>
      </div>

      {loading && (
         <div className="flex justify-center items-center py-10">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
         </div>
      )}

      <div className="tab-content-area">
        {!loading && (
            <> 
                {activeTab === 'myTeams' && renderMyTeamsTab()}
                {activeTab === 'create' && renderCreateTeamTab()}
                {activeTab === 'join' && renderJoinTeamTab()}
            </>
        )}
      </div>
    </div>
  );
}; 