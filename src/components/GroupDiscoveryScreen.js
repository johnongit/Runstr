import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { nip19 } from 'nostr-tools';
import { joinGroup, hasJoinedGroup, getUserPublicKey } from '../utils/nostrClient';

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
  const navigation = useNavigation();
  const [joinedGroups, setJoinedGroups] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadJoinedStatus();
  }, []);

  const loadJoinedStatus = async () => {
    const pubkey = await getUserPublicKey();
    if (!pubkey) return;

    const joinedStatus = {};
    for (const group of FEATURED_GROUPS) {
      joinedStatus[group.naddr] = await hasJoinedGroup(group.naddr);
    }
    setJoinedGroups(joinedStatus);
  };

  const handleGroupPress = (group) => {
    navigation.navigate('TeamDetail', { 
      group,
      isNostrGroup: true
    });
  };

  const handleJoinGroup = async (group) => {
    const pubkey = await getUserPublicKey();
    if (!pubkey) {
      Alert.alert(
        "Authentication Required",
        "Please connect your Nostr key in Settings to join groups.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsLoading(true);
    try {
      const success = await joinGroup(group);
      if (success) {
        setJoinedGroups(prev => ({
          ...prev,
          [group.naddr]: true
        }));
        Alert.alert(
          "Success",
          `You've joined ${group.name}!`,
          [{ text: "OK" }]
        );
      } else {
        throw new Error("Failed to join group");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to join the group. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderTags = (tags) => (
    <View style={styles.tagContainer}>
      {tags.map((tag, index) => (
        <View key={index} style={styles.tag}>
          <Text style={styles.tagText}>#{tag}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discover Running Groups</Text>
      <Text style={styles.subheader}>Join a community of runners and share your journey</Text>
      
      {FEATURED_GROUPS.map((group, index) => (
        <TouchableOpacity 
          key={index} 
          style={styles.groupCard}
          onPress={() => handleGroupPress(group)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.groupName}>{group.name}</Text>
            <View style={styles.memberBadge}>
              <Text style={styles.memberCount}>{group.members} members</Text>
            </View>
          </View>
          
          <Text style={styles.groupDescription}>{group.description}</Text>
          
          {renderTags(group.tags)}
          
          <View style={styles.cardFooter}>
            <TouchableOpacity 
              onPress={() => handleJoinGroup(group)}
              disabled={isLoading || joinedGroups[group.naddr]}
              style={[
                styles.joinButton,
                (isLoading || joinedGroups[group.naddr]) && styles.joinButtonDisabled
              ]}
            >
              <Text style={[
                styles.joinText,
                (isLoading || joinedGroups[group.naddr]) && styles.joinTextDisabled
              ]}>
                {joinedGroups[group.naddr] 
                  ? "Joined ✓" 
                  : isLoading 
                    ? "Joining..." 
                    : "Join Group"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212', // Dark theme background
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: '#A0A0A0',
    marginBottom: 24,
  },
  groupCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  memberBadge: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberCount: {
    color: '#A0A0A0',
    fontSize: 12,
  },
  groupDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
    lineHeight: 20,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#A0A0A0',
    fontSize: 12,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
    marginTop: 4,
  },
  joinButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignSelf: 'flex-end',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinText: {
    color: '#4A9EFF',
    fontSize: 14,
    fontWeight: '600',
  },
  joinTextDisabled: {
    color: '#A0A0A0',
  },
});

export default GroupDiscoveryScreen; 