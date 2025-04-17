import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { parseNaddr, fetchGroupMetadata } from '../utils/nostrClient';

// Hardcoded group naddr values
const MESSI_RUN_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59';
const RUNSTR_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es';

const GroupDiscoveryScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);

  // Load the two hardcoded groups
  useEffect(() => {
    loadHardcodedGroups();
  }, []);

  // Load the two specified Nostr groups
  const loadHardcodedGroups = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const messiGroupInfo = parseNaddr(MESSI_RUN_CLUB_NADDR);
      const runstrGroupInfo = parseNaddr(RUNSTR_NADDR);
      
      if (!messiGroupInfo || !runstrGroupInfo) {
        throw new Error('Failed to parse naddr values');
      }
      
      const loadedGroups = [];
      
      // Fetch Messi Run Club metadata
      const messiMetadata = await fetchGroupMetadata(
        messiGroupInfo.kind,
        messiGroupInfo.pubkey,
        messiGroupInfo.identifier,
        messiGroupInfo.relays
      );
      
      if (messiMetadata) {
        loadedGroups.push({
          id: MESSI_RUN_CLUB_NADDR,
          naddr: MESSI_RUN_CLUB_NADDR,
          groupInfo: messiGroupInfo,
          metadata: messiMetadata.metadata || { name: 'Messi Run Club', about: 'Running club for Messi fans' },
          created_at: messiMetadata.created_at || Date.now() / 1000
        });
      }
      
      // Fetch #RUNSTR metadata
      const runstrMetadata = await fetchGroupMetadata(
        runstrGroupInfo.kind,
        runstrGroupInfo.pubkey,
        runstrGroupInfo.identifier,
        runstrGroupInfo.relays
      );
      
      if (runstrMetadata) {
        loadedGroups.push({
          id: RUNSTR_NADDR,
          naddr: RUNSTR_NADDR,
          groupInfo: runstrGroupInfo,
          metadata: runstrMetadata.metadata || { name: '#RUNSTR', about: 'Official RUNSTR running club' },
          created_at: runstrMetadata.created_at || Date.now() / 1000
        });
      }
      
      setGroups(loadedGroups);
    } catch (error) {
      console.error('Error loading hardcoded groups:', error);
      setError('Failed to load running clubs. Please try again.');
      
      // Fallback to basic information if metadata fetch fails
      setGroups([
        {
          id: MESSI_RUN_CLUB_NADDR,
          naddr: MESSI_RUN_CLUB_NADDR,
          metadata: { name: 'Messi Run Club', about: 'Running club for Messi fans' },
          created_at: Date.now() / 1000
        },
        {
          id: RUNSTR_NADDR,
          naddr: RUNSTR_NADDR,
          metadata: { name: '#RUNSTR', about: 'Official RUNSTR running club' },
          created_at: Date.now() / 1000
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to the group chatroom
  const goToGroupChat = (group) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('TeamDetail', { 
        naddr: group.naddr,
        name: group.metadata.name 
      });
    }
  };

  // Render a group card
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
                {item.metadata.name ? item.metadata.name.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
          )}
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.metadata.name || 'Unnamed Group'}</Text>
            <Text style={styles.groupTimestamp}>
              Created: {new Date(item.created_at * 1000).toLocaleDateString()}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Running Clubs</Text>
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadHardcodedGroups}
          >
            <Text style={styles.refreshButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Loading running clubs...</Text>
        </View>
      ) : (
        <>
          {groups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No running clubs found</Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={loadHardcodedGroups}
              >
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={groups}
              renderItem={renderGroupCard}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.groupsList}
              showsVerticalScrollIndicator={false}
              refreshing={isLoading}
              onRefresh={loadHardcodedGroups}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#4a90e2'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white'
  },
  groupsList: {
    padding: 12
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  groupHeader: {
    flexDirection: 'row',
    marginBottom: 12
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0'
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
    fontWeight: 'bold'
  },
  groupTimestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  groupDescription: {
    fontSize: 14,
    color: '#444',
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
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16
  },
  refreshButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    margin: 12,
    alignItems: 'center'
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center'
  }
});

export default GroupDiscoveryScreen; 