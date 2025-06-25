import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WorkoutCard } from './WorkoutRecordCard';
import { getAvatarUrl } from '../utils/imageHelpers';
import { Zap, Clock, TrendingUp, Timer, MapPin, Calendar } from 'lucide-react';
import { useTeamChallenge } from '../contexts/TeamChallengeContext';
import { getWorkoutTagData } from '../utils/tagDisplayUtils';

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

// Using enhanced tag parsing utilities from tagDisplayUtils

export const Post = ({ post, handleZap, wallet }: { post: any; handleZap: any; wallet: any }) => {
  const { userTeams, activeChallenges, isLoading } = useTeamChallenge();

  // Only render if it's a Kind 1301 event
  if (!post || post.kind !== 1301) {
    return null; 
  }

  // Use enhanced tag parsing utilities
  const tagData = getWorkoutTagData(post.tags);

  // For backward compatibility, enhance challenge data with full challenge information
  const enhancedChallenges = tagData.challenges.map((challengeTag: any) => {
    // Find the full challenge data from context
    const fullChallenge = activeChallenges.find((challenge: any) => {
      const challengeUuid = challenge.tags.find((t: any) => t[0] === 'd')?.[1];
      return challengeUuid === challengeTag.uuid;
    });
    
    // Use the display name from tagData, with fallback to challenge context data
    const challengeName = challengeTag.displayName || 
                         fullChallenge?.tags.find((t: any) => t[0] === 'name')?.[1] || 
                         `Challenge ${challengeTag.uuid.slice(0, 8)}`;
    
    return {
      uuid: challengeTag.uuid,
      name: challengeName,
      challengeValue: challengeTag.challengeValue || `challenge:${challengeTag.uuid}`
    };
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
    // Use enhanced tag data
    teams: tagData.teams,
    challenges: enhancedChallenges,
    // Add tag metadata for debugging/development
    tagMetadata: {
      hasTeams: tagData.hasTeams,
      hasChallenges: tagData.hasChallenges,
      hasAnyAffiliations: tagData.hasAnyAffiliations,
      teamUuids: tagData.teamUuids,
      challengeUuids: tagData.challengeUuids
    }
  };
  
  // Pass through metrics processed by feedProcessor/nostr.js
  // The WorkoutCard component itself can handle icon mapping if we pass a label/type
  const cardMetrics = post.metrics?.map((metric: any) => {
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