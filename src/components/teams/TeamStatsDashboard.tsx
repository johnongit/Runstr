import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TrendingUp, Users, Trophy, Clock, Zap } from 'lucide-react';
import { getTeamStatistics, getChallengeProgress } from '../../services/nostr/NostrTeamsService';
import { ndk } from '../../lib/ndkSingleton';

interface TeamStatsDashboardProps {
  teamCaptainPubkey: string;
  teamUUID: string;
  teamName: string;
  activeChallenges?: Array<{ uuid: string; name: string }>;
}

interface TeamStatistics {
  totalDistance: number;
  totalWorkouts: number;
  averagePace: number;
  topPerformers: Array<{
    pubkey: string;
    totalDistance: number;
    totalWorkouts: number;
    averagePace: number;
  }>;
  recentActivity: Array<{
    id: string;
    pubkey: string;
    created_at: number;
    distance: string;
    duration: string;
  }>;
}

export const TeamStatsDashboard: React.FC<TeamStatsDashboardProps> = ({
  teamCaptainPubkey,
  teamUUID,
  teamName,
  activeChallenges = []
}) => {
  const [stats, setStats] = useState<TeamStatistics | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');

  const fetchTeamStats = async () => {
    if (!teamCaptainPubkey || !teamUUID) return;
    
    setLoading(true);
    try {
      // Calculate timeframe
      const now = Math.floor(Date.now() / 1000);
      let since: number | undefined;
      
      switch (timeframe) {
        case 'week':
          since = now - (7 * 24 * 60 * 60);
          break;
        case 'month':
          since = now - (30 * 24 * 60 * 60);
          break;
        default:
          since = undefined;
      }

      // Fetch team statistics using enhanced tag-based querying
      const teamStats = await getTeamStatistics(ndk, teamCaptainPubkey, teamUUID, { since });
      setStats(teamStats);

      // Fetch challenge progress for active challenges
      const challengeProgressMap = new Map();
      for (const challenge of activeChallenges) {
        try {
          const progress = await getChallengeProgress(ndk, challenge.uuid, teamUUID);
          challengeProgressMap.set(challenge.uuid, progress);
        } catch (err) {
          console.warn(`Failed to fetch challenge progress for ${challenge.uuid}:`, err);
        }
      }
      setChallengeProgress(challengeProgressMap);

    } catch (error) {
      console.error('Error fetching team statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamStats();
  }, [teamCaptainPubkey, teamUUID, timeframe]);

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} km`;
  };

  const formatPace = (pace: number) => {
    if (pace === 0) return 'N/A';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{teamName} Statistics</h2>
          <p className="text-text-muted">Tag-based team analytics from 1301 workout records</p>
        </div>
        
        <div className="flex gap-2">
          {(['week', 'month', 'all'] as const).map((period) => (
            <Button
              key={period}
              variant={timeframe === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeframe(period)}
              className="capitalize"
            >
              {period === 'all' ? 'All Time' : `Last ${period}`}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-text-muted">Loading team statistics...</div>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Total Distance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {formatDistance(stats.totalDistance)}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  From {stats.totalWorkouts} workouts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-success" />
                  Team Workouts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {stats.totalWorkouts}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  From team members
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Average Pace
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-text-primary">
                  {formatPace(stats.averagePace)}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Team average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          {stats.topPerformers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topPerformers.slice(0, 5).map((performer, index) => (
                    <div key={performer.pubkey} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium text-text-primary">
                            {performer.pubkey.slice(0, 8)}...
                          </div>
                          <div className="text-xs text-text-muted">
                            {performer.totalWorkouts} workouts
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-text-primary">
                          {formatDistance(performer.totalDistance)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {formatPace(performer.averagePace)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Challenges Progress */}
          {activeChallenges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Challenge Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeChallenges.map((challenge) => {
                    const progress = challengeProgress.get(challenge.uuid);
                    
                    if (!progress || !progress.challengeInfo) {
                      return (
                        <div key={challenge.uuid} className="p-3 bg-bg-tertiary rounded-lg">
                          <div className="font-medium text-text-primary">{challenge.name}</div>
                          <div className="text-sm text-text-muted">Loading progress...</div>
                        </div>
                      );
                    }

                    return (
                      <div key={challenge.uuid} className="p-3 bg-bg-tertiary rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-text-primary">{challenge.name}</div>
                          <Badge 
                            variant={progress.isComplete ? 'default' : 'outline'}
                            className={progress.isComplete ? 'bg-success text-white' : ''}
                          >
                            {progress.goalProgress.toFixed(1)}%
                          </Badge>
                        </div>
                        
                        <div className="w-full bg-border-secondary rounded-full h-2 mb-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, progress.goalProgress)}%` }}
                          />
                        </div>
                        
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>{formatDistance(progress.totalProgress)} completed</span>
                          <span>{progress.participants.length} participants</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          {stats.recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.recentActivity.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-2 hover:bg-bg-tertiary rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-xs">
                          {activity.pubkey.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {activity.distance} • {activity.duration}
                          </div>
                          <div className="text-xs text-text-muted">
                            {activity.pubkey.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-text-muted">
                        {formatTimeAgo(activity.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && !stats && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-text-muted">No team statistics available yet.</p>
            <p className="text-xs text-text-muted mt-2">
              Statistics are calculated from tagged 1301 workout records.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 