// New Activity Feed Hook for Hybrid Implementation
import { useState, useEffect, useCallback, useRef } from 'react';
import { ndk, awaitNDKReady } from '../lib/ndkSingleton';
import { useProfileCache } from './useProfileCache';
import { ensureRelays } from '../utils/relays';
import { NDKEvent } from '@nostr-dev-kit/ndk';

// Cache for activity data
const activityCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { fetchProfiles, getProfile } = useProfileCache();
  
  // Reaction states
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const reactionSubRef = useRef(null);
  
  const fetchActivityFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await awaitNDKReady();
      await ensureRelays([]);
      
      // Fetch both NIP-101e workout records and regular running posts
      const filter = [
        { kinds: [1301], limit: 50 }, // NIP-101e workout records
        { kinds: [1], '#t': ['runstr', 'running'], limit: 50 } // Regular posts
      ];
      
      const events = await ndk.fetchEvents(filter);
      
      // Process events into unified activity format
      const processedActivities = [];
      const pubkeysToFetch = new Set();
      
      for (const event of events) {
        const activity = processEvent(event);
        
        // Track pubkeys for batch profile fetch
        pubkeysToFetch.add(event.pubkey);
        
        // Add to cache
        activityCache.set(event.id, {
          data: activity,
          timestamp: Date.now()
        });
        
        processedActivities.push(activity);
      }
      
      // Sort by timestamp
      processedActivities.sort((a, b) => b.created_at - a.created_at);
      
      // Batch fetch profiles
      if (pubkeysToFetch.size > 0) {
        const profiles = await fetchProfiles(Array.from(pubkeysToFetch));
        
        // Enrich activities with profile data
        const enrichedActivities = processedActivities.map(activity => {
          const profile = profiles.get(activity.author.pubkey) || {};
          return {
            ...activity,
            author: {
              ...activity.author,
              profile: {
                ...activity.author.profile,
                ...profile
              }
            }
          };
        });
        
        setActivities(enrichedActivities);
      } else {
        setActivities(processedActivities);
      }
      
      // Subscribe to reactions
      subscribeToReactions(processedActivities.map(a => a.id));
      
    } catch (err) {
      console.error('Error fetching activity feed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles]);
  
  const processEvent = (event) => {
    // Check cache first
    const cached = activityCache.get(event.id);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    const baseActivity = {
      id: event.id,
      type: event.kind === 1301 ? 'workout' : 'post',
      created_at: event.created_at,
      author: {
        pubkey: event.pubkey,
        profile: {}
      },
      reactions: {
        likes: 0,
        reposts: 0,
        zaps: 0,
        comments: []
      }
    };
    
    if (event.kind === 1301) {
      // Process NIP-101e workout record
      return processWorkoutRecord(event, baseActivity);
    } else {
      // Process regular post
      return processRegularPost(event, baseActivity);
    }
  };
  
  const processWorkoutRecord = (event, baseActivity) => {
    const workoutData = {
      ...baseActivity,
      content: event.content,
      workout: {
        title: '',
        type: '',
        duration: 0,
        distance: 0,
        exercises: []
      }
    };
    
    // Parse workout data from tags
    event.tags.forEach(tag => {
      switch(tag[0]) {
        case 'title':
          workoutData.workout.title = tag[1];
          break;
        case 'type':
          workoutData.workout.type = tag[1];
          break;
        case 'start':
          workoutData.workout.startTime = parseInt(tag[1]);
          break;
        case 'end':
          workoutData.workout.endTime = parseInt(tag[1]);
          workoutData.workout.duration = workoutData.workout.endTime - workoutData.workout.startTime;
          break;
        case 'exercise':
          // Parse exercise data: ["exercise", "templateId", "relay", ...values]
          if (tag.length >= 3) {
            workoutData.workout.exercises.push({
              templateId: tag[1],
              relay: tag[2],
              values: tag.slice(3)
            });
          }
          break;
      }
    });
    
    return workoutData;
  };
  
  const processRegularPost = (event, baseActivity) => {
    return {
      ...baseActivity,
      content: event.content,
      images: extractImagesFromContent(event.content)
    };
  };
  
  const extractImagesFromContent = (content) => {
    const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
    return content.match(imageRegex) || [];
  };
  
  const subscribeToReactions = useCallback((activityIds) => {
    if (reactionSubRef.current) {
      reactionSubRef.current.stop();
    }
    
    if (activityIds.length === 0) return;
    
    const sub = ndk.subscribe(
      [
        { kinds: [7], '#e': activityIds }, // Likes
        { kinds: [6], '#e': activityIds }, // Reposts
        { kinds: [9735], '#e': activityIds }, // Zaps
        { kinds: [1], '#e': activityIds } // Comments
      ],
      { closeOnEose: false }
    );
    
    sub.on('event', async (event) => {
      const targetId = event.tags.find(t => t[0] === 'e')?.[1];
      if (!targetId) return;
      
      // Update activity with reaction
      setActivities(prev => prev.map(activity => {
        if (activity.id !== targetId) return activity;
        
        const updated = { ...activity };
        
        switch (event.kind) {
          case 7: // Like
            updated.reactions.likes++;
            if (event.pubkey === ndk.activeUser?.pubkey) {
              setUserLikes(prev => new Set(prev).add(targetId));
            }
            break;
          case 6: // Repost
            updated.reactions.reposts++;
            if (event.pubkey === ndk.activeUser?.pubkey) {
              setUserReposts(prev => new Set(prev).add(targetId));
            }
            break;
          case 9735: // Zap
            updated.reactions.zaps++;
            break;
          case 1: // Comment
            // Fetch commenter profile
            const profile = await getProfile(event.pubkey);
            updated.reactions.comments.push({
              id: event.id,
              content: event.content,
              created_at: event.created_at,
              author: {
                pubkey: event.pubkey,
                profile: profile || {}
              }
            });
            break;
        }
        
        return updated;
      }));
    });
    
    reactionSubRef.current = sub;
  }, [getProfile]);
  
  // Interaction handlers
  const handleLike = useCallback(async (activityId) => {
    try {
      const event = new NDKEvent(ndk);
      event.kind = 7;
      event.content = '+';
      event.tags = [['e', activityId]];
      
      await event.publish();
      
      // Optimistic update
      setUserLikes(prev => new Set(prev).add(activityId));
      setActivities(prev => prev.map(a => 
        a.id === activityId 
          ? { ...a, reactions: { ...a.reactions, likes: a.reactions.likes + 1 } }
          : a
      ));
    } catch (err) {
      console.error('Error liking activity:', err);
    }
  }, []);
  
  const handleRepost = useCallback(async (activityId) => {
    try {
      const event = new NDKEvent(ndk);
      event.kind = 6;
      event.tags = [['e', activityId]];
      
      await event.publish();
      
      // Optimistic update
      setUserReposts(prev => new Set(prev).add(activityId));
      setActivities(prev => prev.map(a => 
        a.id === activityId 
          ? { ...a, reactions: { ...a.reactions, reposts: a.reactions.reposts + 1 } }
          : a
      ));
    } catch (err) {
      console.error('Error reposting activity:', err);
    }
  }, []);
  
  const handleZap = useCallback(async (activityId, amount, wallet) => {
    try {
      // Implementation depends on wallet integration
      console.log('Zapping activity:', activityId, 'with amount:', amount);
      // TODO: Implement zap logic with wallet
    } catch (err) {
      console.error('Error zapping activity:', err);
    }
  }, []);
  
  const handleComment = useCallback(async (activityId, content) => {
    try {
      const event = new NDKEvent(ndk);
      event.kind = 1;
      event.content = content;
      event.tags = [
        ['e', activityId, '', 'reply'],
        ['t', 'runstr']
      ];
      
      await event.publish();
      
      // Optimistic update
      const profile = await getProfile(ndk.activeUser?.pubkey);
      setActivities(prev => prev.map(a => {
        if (a.id === activityId) {
          return {
            ...a,
            reactions: {
              ...a.reactions,
              comments: [...a.reactions.comments, {
                id: event.id,
                content: content,
                created_at: Math.floor(Date.now() / 1000),
                author: {
                  pubkey: ndk.activeUser?.pubkey,
                  profile: profile || {}
                }
              }]
            }
          };
        }
        return a;
      }));
    } catch (err) {
      console.error('Error commenting on activity:', err);
    }
  }, [getProfile]);
  
  // Initialize feed
  useEffect(() => {
    fetchActivityFeed();
  }, [fetchActivityFeed]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (reactionSubRef.current) {
        reactionSubRef.current.stop();
      }
    };
  }, []);
  
  return {
    activities,
    loading,
    error,
    userLikes,
    userReposts,
    handleLike,
    handleRepost,
    handleZap,
    handleComment,
    refreshFeed: fetchActivityFeed
  };
}; 