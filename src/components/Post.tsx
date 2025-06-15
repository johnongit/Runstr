import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WorkoutCard } from './WorkoutRecordCard';
import { getAvatarUrl } from '../utils/imageHelpers';
import { Zap, Clock, TrendingUp, Timer, MapPin, Calendar } from 'lucide-react';
import { useTeamChallenge } from '../contexts/TeamChallengeContext';

// Helper to format timestamp to timeAgo string
const formatTimeAgo = (timestamp: number) => {
  try {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'date error';
  }
};

// Helper to get a specific tag value from post.tags for workoutData
const getTagValue = (tags: any[], tagName: string) => {
  const tag = tags?.find(t => t[0] === tagName);
  return tag ? tag[1] : undefined;
};

// Helper to parse team tags from workout event
const parseTeamTags = (tags: any[]) => {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .filter(tag => tag[0] === 'team' && tag[1])
    .map(tag => {
      // Team tag format: ["team", "33404:captain:uuid", "relayHint", "teamName"]
      const aTag = tag[1];
      const relayHint = tag[2] || '';
      const teamName = tag[3] || '';
      
      // Parse the a-tag: "33404:captain:uuid"
      const parts = aTag.split(':');
      if (parts.length === 3 && parts[0] === '33404') {
        return {
          aTag,
          captain: parts[1],
          uuid: parts[2],
          relayHint,
          teamName,
          identifier: `${parts[1]}:${parts[2]}` // captain:uuid format
        };
      }
      return null;
    })
    .filter(Boolean);
};

// Helper to parse challenge tags from workout event
const parseChallengeTags = (tags: any[]) => {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .filter(tag => tag[0] === 't' && tag[1] && tag[1].startsWith('challenge:'))
    .map(tag => {
      // Challenge tag format: ["t", "challenge:uuid"]
      const challengeValue = tag[1];
      const uuid = challengeValue.replace('challenge:', '');
      if (uuid) {
        return { uuid, challengeValue };
      }
      return null;
    })
    .filter(Boolean);
};

export const Post = ({ post, handleZap, wallet }: { post: any; handleZap: any; wallet: any }) => {
  const { userTeams, activeChallenges, isLoading } = useTeamChallenge();

  // Only render if it's a Kind 1301 event
  if (!post || post.kind !== 1301) {
    return null; 
  }

  // Parse team and challenge tags from the workout
  const teamTags = parseTeamTags(post.tags);
  const challengeTags = parseChallengeTags(post.tags);

  // Filter teams - only show if user is a member
  const userTeamIdentifiers = userTeams.map(team => {
    const uuid = team.tags.find(t => t[0] === 'd')?.[1];
    return `${team.pubkey}:${uuid}`;
  });

  const visibleTeams = teamTags.filter(teamTag => 
    userTeamIdentifiers.includes(teamTag.identifier)
  );

  // Filter challenges - only show active challenges that user participates in
  const visibleChallenges = challengeTags.filter(challengeTag => {
    return activeChallenges.some(challenge => {
      const challengeUuid = challenge.tags.find(t => t[0] === 'd')?.[1];
      return challengeUuid === challengeTag.uuid;
    });
  });

  const authorData = {
    name: post.author?.profile?.name || post.author?.profile?.display_name || post.author?.pubkey?.slice(0, 8) + '…' || 'Runner',
    username: post.author?.profile?.nip05?.startsWith('_@') ? post.author.profile.nip05.substring(2) : post.author?.profile?.nip05, // For WorkoutCard username
    avatar: getAvatarUrl(post.author?.profile?.picture, 48) || (post.author?.pubkey ? `https://robohash.org/${post.author.pubkey}.png?size=48x48` : undefined),
    timeAgo: formatTimeAgo(post.created_at),
  };

  const workoutData = {
    title: post.title || 'Workout Record',
    content: post.content || '',
    timestamp: new Date(post.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date(post.created_at * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    location: getTagValue(post.tags, 'location'),
    // Add team and challenge data
    teams: visibleTeams,
    challenges: visibleChallenges.map(challengeTag => {
      // Find the full challenge data
      const fullChallenge = activeChallenges.find(challenge => {
        const challengeUuid = challenge.tags.find(t => t[0] === 'd')?.[1];
        return challengeUuid === challengeTag.uuid;
      });
      
      return {
        uuid: challengeTag.uuid,
        name: fullChallenge?.tags.find(t => t[0] === 'name')?.[1] || `Challenge ${challengeTag.uuid.slice(0, 8)}`,
        ...challengeTag
      };
    })
  };
  
  // Pass through metrics processed by feedProcessor/nostr.js
  // The WorkoutCard component itself can handle icon mapping if we pass a label/type
  const cardMetrics = post.metrics?.map(metric => {
    let icon = null;
    const labelLower = metric.label?.toLowerCase() || '';
    if (labelLower.includes('dist')) {
      icon = <TrendingUp className="h-3 w-3" />;
    } else if (labelLower.includes('time') || labelLower.includes('dur')) {
      icon = <Timer className="h-3 w-3" />;
    } else if (labelLower.includes('pace')) {
      icon = <Clock className="h-3 w-3" />;
    } else if (labelLower.includes('cal')) {
      icon = <Zap className="h-3 w-3" />; // Re-using Zap for calories as an example
    } else {
      icon = <TrendingUp className="h-3 w-3" />; // Default icon
    }
    return { ...metric, icon };
  }).slice(0,3); // WorkoutCard demo shows 3 metrics

  const engagementData = {
    zaps: post.zaps ?? 0,
  };

  const onZapPress = () => {
    if (handleZap) {
      handleZap(post, wallet); // Pass the full post object
    }
  };

  return (
    <WorkoutCard
      author={authorData}
      workout={workoutData}
      metrics={cardMetrics}
      engagement={engagementData}
      onZap={onZapPress}
      className="mb-4"
    />
  );
};

Post.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    kind: PropTypes.number, // Expecting 1301
    title: PropTypes.string, // Added from processing
    content: PropTypes.string,
    created_at: PropTypes.number.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.object,
    }).isRequired,
    metrics: PropTypes.array, // Added from processing
    tags: PropTypes.array,
    zaps: PropTypes.number,
  }).isRequired,
  handleZap: PropTypes.func.isRequired,
  wallet: PropTypes.object, 
}; 