import { useState, useEffect, useMemo } from 'react';
import { useLeaguePosition } from '../hooks/useLeaguePosition';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';

export const LeagueMap = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const { publicKey } = useNostr();
  
  // Get comprehensive leaderboard data with caching
  const {
    leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    lastUpdated,
    refresh: refreshLeaderboard,
    courseTotal
  } = useLeagueLeaderboard();

  // Get profiles for leaderboard users
  const leaderboardPubkeys = useMemo(() => 
    leaderboard.map(user => user.pubkey), [leaderboard]
  );
  const { profiles } = useProfiles(leaderboardPubkeys);

  // Enhanced leaderboard with profile data
  const enhancedLeaderboard = useMemo(() => {
    return leaderboard.map(user => {
      // Fix: useProfiles returns an object, not a Map
      const profile = profiles?.[user.pubkey] || profiles?.get?.(user.pubkey) || {};
      return {
        ...user,
        displayName: profile.display_name || profile.name || `Runner ${user.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        isCurrentUser: user.pubkey === publicKey
      };
    });
  }, [leaderboard, profiles, publicKey]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Calculate position along race track (0-100%)
  const calculateTrackPosition = (totalMiles) => {
    return Math.min(100, (totalMiles / courseTotal) * 100);
  };

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
  };

  // Calculate positions for leaderboard users on the track
  const racePositions = useMemo(() => {
    return enhancedLeaderboard.map(user => ({
      ...user,
      trackPosition: calculateTrackPosition(user.totalMiles)
    }));
  }, [enhancedLeaderboard, courseTotal]);

  // Loading state with lazy loading support
  const isLoading = isInitialLoad || (leaderboardLoading && leaderboard.length === 0);
  
  if (isLoading) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <div className="flex space-x-1 mb-3">
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
          </div>
          <p className="text-text-secondary">Loading League Race...</p>
        </div>
      </div>
    );
  }

  if (leaderboardError && leaderboard.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <p className="text-red-400 text-sm mb-2">Error loading league data: {leaderboardError}</p>
          <button 
            onClick={refreshLeaderboard}
            className="px-3 py-1 bg-primary hover:bg-primary-hover text-text-primary text-sm rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Linear Race Track */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-text-primary mb-1">🏁 500 MILE LEAGUE RACE</h2>
          <p className="text-text-secondary text-sm">
            Top 10 Runners • Updated {lastUpdated?.toLocaleTimeString() || 'Recently'}
            {leaderboardLoading && <span className="ml-2 text-primary">Updating...</span>}
          </p>
        </div>
        
        <div className="w-full max-w-2xl mx-auto">
          <svg 
            viewBox="0 0 400 120" 
            className="w-full h-24"
          >
            {/* Track background */}
            <rect x="0" y="0" width="400" height="120" fill="transparent" />
            
            {/* Main race track line */}
            <line 
              x1="40" y1="60" x2="360" y2="60" 
              stroke="currentColor" 
              strokeWidth="4" 
              strokeLinecap="round"
              className="text-border-secondary"
            />
            
            {/* Start line */}
            <line 
              x1="40" y1="50" x2="40" y2="70" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="text-text-primary"
            />
            <text x="15" y="45" fontSize="10" fill="currentColor" className="text-text-secondary">START</text>
            
            {/* Finish line */}
            <line 
              x1="360" y1="50" x2="360" y2="70" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="text-text-primary"
            />
            <text x="325" y="45" fontSize="10" fill="currentColor" className="text-text-secondary">500mi</text>
            
            {/* Mile markers */}
            {[100, 200, 300, 400].map(mile => {
              const x = 40 + ((mile / 500) * 320);
              return (
                <g key={mile}>
                  <line 
                    x1={x} y1="55" x2={x} y2="65" 
                    stroke="currentColor" 
                    strokeWidth="1" 
                    className="text-text-muted"
                  />
                  <text x={x} y="80" fontSize="8" textAnchor="middle" fill="currentColor" className="text-text-muted">
                    {mile}
                  </text>
                </g>
              );
            })}
            
            {/* Position runners on track */}
            {racePositions.slice(0, 10).map((user, index) => {
              const x = 40 + (user.trackPosition / 100 * 320);
              const colors = {
                1: '#FFD700', // Gold
                2: '#C0C0C0', // Silver  
                3: '#CD7F32', // Bronze
                default: '#6B7280' // Gray
              };
              const color = colors[user.rank] || colors.default;
              
              return (
                <g key={user.pubkey}>
                  {/* Position dot */}
                  <circle 
                    cx={x} 
                    cy="60" 
                    r="6" 
                    fill={color}
                    stroke={user.isCurrentUser ? "#FF6B35" : "#000"}
                    strokeWidth={user.isCurrentUser ? "2" : "1"}
                    className="drop-shadow-sm transition-all duration-300 cursor-pointer hover:scale-110"
                  />
                  
                  {/* Rank number */}
                  <text 
                    x={x} 
                    y="64" 
                    fontSize="10" 
                    fontWeight="bold"
                    textAnchor="middle" 
                    fill="#000"
                  >
                    {user.rank}
                  </text>
                  
                  {/* User pulse animation for current user */}
                  {user.isCurrentUser && (
                    <circle 
                      cx={x} 
                      cy="60" 
                      r="10" 
                      fill="none" 
                      stroke="#FF6B35" 
                      strokeWidth="2"
                      className="animate-ping"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Workout-Card-Styled Leaderboard */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-bg-tertiary">
          <h3 className="text-lg font-semibold text-text-primary">🏆 League Standings</h3>
          {leaderboardLoading && (
            <div className="flex items-center">
              <div className="flex space-x-1">
                <span className="w-1 h-1 bg-text-secondary rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                <span className="w-1 h-1 bg-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              </div>
            </div>
          )}
        </div>
        
        {enhancedLeaderboard.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-text-secondary">No runners found yet. Be the first to start!</p>
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {enhancedLeaderboard.slice(0, 10).map((user) => (
              <div 
                key={user.pubkey} 
                className={`flex items-center p-3 hover:bg-bg-tertiary transition-colors duration-200 ${
                  user.isCurrentUser ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex-shrink-0 mr-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    user.rank === 1 ? 'bg-yellow-500 text-black' :
                    user.rank === 2 ? 'bg-gray-400 text-black' :
                    user.rank === 3 ? 'bg-orange-600 text-white' :
                    'bg-primary text-text-primary'
                  }`}>
                    {user.rank <= 3 ? ['🥇', '🥈', '🥉'][user.rank - 1] : user.rank}
                  </span>
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-text-primary font-medium text-sm truncate">
                      {user.displayName}
                    </div>
                    {user.isCurrentUser && (
                      <span className="px-2 py-1 bg-primary text-text-primary text-xs rounded-full font-bold">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-text-secondary text-xs mt-1">
                    <span className="text-text-primary font-medium">{formatDistance(user.totalMiles)} mi</span>
                    <span className="text-text-muted ml-1">• {formatDistance(user.progressPercentage)}%</span>
                    <span className="text-text-muted ml-1">• {user.runCount} runs</span>
                  </div>
                </div>
                
                <div className="flex-shrink-0 ml-3">
                  <div className="w-12 h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, user.progressPercentage)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {enhancedLeaderboard.length > 0 && (
          <div className="p-3 border-t border-border-secondary bg-bg-tertiary flex justify-between items-center">
            <button 
              onClick={refreshLeaderboard}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 disabled:opacity-50"
              disabled={leaderboardLoading}
            >
              {leaderboardLoading ? 'Updating...' : 'Refresh'}
            </button>
            <span className="text-xs text-text-muted">
              Last updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
