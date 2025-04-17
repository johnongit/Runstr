import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
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
  const renderGroupCard = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.groupCard}
        onPress={() => goToGroupChat(item)}
      >
        <View style={styles.groupHeader}>
          {item.metadata.picture ? (
            <Image 
              source={{ uri: item.metadata.picture }} 
              style={styles.groupAvatar} 
              defaultSource={require('../assets/default-group-icon.png')} 
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>
                {item.metadata.name ? item.metadata.name.charAt(0).toUpperCase() : '#'}
              </Text>
            </View>
          )}
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.metadata.name || 'Unnamed Group'}</Text>
            <Text style={styles.groupTimestamp}>
              Kind: {item.kind} • ID: {item.identifierData?.identifier.slice(0,8)}...
            </Text>
          </View>
        </View>
        <Text style={styles.groupDescription} numberOfLines={3}>
          {item.metadata.about || 'No description available'}
        </Text>
        <View style={styles.joinButton}>
          <Text style={styles.joinButtonText}>View Group</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!publicKey) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => navigate('/teams')} style={styles.backButton}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
             </svg>
           </TouchableOpacity>
          <Text style={styles.headerTitle}>My Clubs</Text>
           <View style={{ width: 24 }} />
        </View>
        <View style={styles.centeredMessageContainer}>
           <Text style={styles.infoText}>Please connect with Nostr in Settings to see your clubs.</Text>
           <TouchableOpacity 
             style={styles.actionButton}
             onPress={() => navigate('/settings')}
           >
             <Text style={styles.actionButtonText}>Go to Settings</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigate('/teams')} style={styles.backButton}>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
           </svg>
         </TouchableOpacity>
        <Text style={styles.headerTitle}>My Clubs</Text>
         <View style={{ width: 24 }} />
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => loadMyGroups(publicKey)}
          >
            <Text style={styles.refreshButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Loading your clubs...</Text>
        </View>
      ) : (
        <>
          {myGroups.length === 0 ? (
            <View style={styles.centeredMessageContainer}>
              <Text style={styles.infoText}>You haven't joined any Nostr clubs yet.</Text>
              <Text style={styles.infoSubText}>Use another Nostr client to join clubs, or check out the Discover tab.</Text>
               <TouchableOpacity 
                 style={styles.actionButton}
                 onPress={() => navigate('/discover-clubs')}
               >
                 <Text style={styles.actionButtonText}>Discover Clubs</Text>
               </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myGroups}
              renderItem={renderGroupCard}
              keyExtractor={item => item.id} // Use event ID as key
              contentContainerStyle={styles.groupsList}
              showsVerticalScrollIndicator={false}
              refreshing={isLoading} // Show refresh indicator during background refresh
              onRefresh={() => loadMyGroups(publicKey)}
            />
          )}
        </>
      )}
    </View>
  );
};

// Reusing styles from GroupDiscoveryScreen, adding specific ones
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a222e'
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#212936',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#394150'
  },
  backButton: {
     padding: 4,
     color: '#9ca3af'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center'
  },
  groupsList: {
    padding: 16
  },
  groupCard: {
    backgroundColor: '#212936',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5
  },
  groupHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center'
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#394150'
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center'
  },
  defaultAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold'
  },
  groupInfo: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center'
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white'
  },
  groupTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2
  },
  groupDescription: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 16,
    lineHeight: 20
  },
  joinButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  joinButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af'
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  infoText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8
  },
  infoSubText: {
    fontSize: 14,
    color: '#6b7280', 
    textAlign: 'center',
    marginBottom: 24
  },
  actionButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#44403c', // Darker red/brown error background
    borderRadius: 8,
    margin: 16,
    alignItems: 'center'
  },
  errorText: {
    color: '#fca5a5', // Lighter red text for dark background
    textAlign: 'center',
    marginBottom: 12
  },
  refreshButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14
  }
});

export default MyClubsScreen; 