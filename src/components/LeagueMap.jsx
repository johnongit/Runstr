import { useState, useEffect, useMemo } from 'react';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useLeaguePosition } from '../hooks/useLeaguePosition';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';
import SeasonPassPaymentModal from './modals/SeasonPassPaymentModal';
import PrizePoolModal from './modals/PrizePoolModal';
import seasonPassPaymentService from '../services/seasonPassPaymentService';

export const LeagueMap = ({ feedPosts = [], feedLoading = false, feedError = null }) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showSeasonPassModal, setShowSeasonPassModal] = useState(false);
  const [showPrizePoolModal, setShowPrizePoolModal] = useState(false);
  
  const { publicKey } = useNostr();
  
  // Get comprehensive leaderboard data with caching
  const {
    leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    lastUpdated,
    refresh: refreshLeaderboard,
    activityMode,
    competitionStats: leaderboardStats
  } = useLeagueLeaderboard();

  // Get user's position and competition stats
  const {
    totalDistance: userTotalDistance,
    activities: userActivities,
    competitionPosition,
    competitionStats: userStats,
    isLoading: positionLoading,
    refresh: refreshPosition
  } = useLeaguePosition();

  // Helper functions defined early to avoid reference errors
  // Generate dynamic league title based on activity mode
  const getLeagueTitle = () => {
    if (!activityMode) return 'RUNSTR SEASON 1'; // Fallback for loading state
    
    switch (activityMode) {
      case 'run':
        return 'RUNSTR SEASON 1';
      case 'walk':
        return 'WALKSTR SEASON 1';
      case 'cycle':
        return 'CYCLESTR SEASON 1';
      default:
        return 'RUNSTR SEASON 1';
    }
  };

  // Generate dynamic activity display name
  const getActivityDisplayName = () => {
    if (!activityMode) return 'Runner';
    
    switch (activityMode) {
      case 'run':
        return 'Runner';
      case 'walk':
        return 'Walker';
      case 'cycle':
        return 'Cyclist';
      default:
        return 'Runner';
    }
  };

  // Generate dynamic activity text based on activity mode
  const getActivityText = (count) => {
    if (!activityMode) return `${count} activity${count !== 1 ? 's' : ''}`; // Fallback
    
    switch (activityMode) {
      case 'run':
        return `${count} run${count !== 1 ? 's' : ''}`;
      case 'walk':
        return `${count} walk${count !== 1 ? 's' : ''}`;
      case 'cycle':
        return `${count} ride${count !== 1 ? 's' : ''}`;
      default:
        return `${count} activity${count !== 1 ? 's' : ''}`;
    }
  };

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
  };

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
        displayName: profile.display_name || profile.name || `${getActivityDisplayName()} ${user.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        isCurrentUser: user.pubkey === publicKey
      };
    });
  }, [leaderboard, profiles, publicKey, getActivityDisplayName]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Get competition status message
  const getCompetitionStatus = () => {
    const stats = leaderboardStats || userStats;
    if (!stats) return 'Loading competition info...';
    
    if (!stats.hasStarted) {
      return `Competition starts in ${stats.daysRemaining} days`;
    }
    
    if (stats.hasEnded) {
      return 'Competition has ended';
    }
    
    return `${stats.daysRemaining} days remaining`;
  };

  // Get empty state message
  const getEmptyStateMessage = () => {
    const stats = leaderboardStats || userStats;
    if (!stats) return 'Loading...';
    
    if (!stats.hasStarted) {
      return `Competition starts ${stats.startDate.toLocaleDateString()}. Get ready to compete!`;
    }
    
    if (stats.hasEnded) {
      return 'Competition has ended. Check back for Season 2!';
    }
    
    const activityName = getActivityDisplayName().toLowerCase();
    return `Be the first ${activityName} to start competing! Log your activities to climb the leaderboard.`;
  };

  // Season Pass helpers
  const hasSeasonPass = useMemo(() => {
    return publicKey ? seasonPassPaymentService.hasSeasonPass(publicKey) : false;
  }, [publicKey]);

  const handleSeasonPassClick = () => {
    if (!publicKey) {
      alert('Please connect your Nostr account first');
      return;
    }
    setShowSeasonPassModal(true);
  };

  const handlePaymentSuccess = () => {
    // Refresh the leaderboard to show updated content
    refreshLeaderboard();
    refreshPosition();
  };

  // Refresh both leaderboard and position
  const handleRefresh = () => {
    refreshLeaderboard();
    refreshPosition();
  };

  // Loading state with lazy loading support
  const isLoading = isInitialLoad || (leaderboardLoading && leaderboard.length === 0);
  
  if (isLoading) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 mb-4">
        <div className="flex flex-col justify-center items-center h-32">
          <div className="flex space-x-1 mb-3">
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
            <span className="w-2 h-2 bg-text-secondary rounded-full"></span>
          </div>
          <p className="text-text-secondary">Loading League Competition...</p>
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
            onClick={handleRefresh}
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="league-map-container">
      {/* Competition Header */}
      <div className="league-map-header">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-text-primary">
            {getLeagueTitle()}
          </h2>
          <div className="flex items-center space-x-2">
            {hasSeasonPass && (
              <span className="text-xs bg-primary text-text-primary px-2 py-1 rounded-full">
                Season Pass
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="text-text-secondary hover:text-text-primary text-sm"
              disabled={leaderboardLoading}
            >
              🔄
            </button>
          </div>
        </div>
        
        {/* Competition Status - Only show if competition has started */}
        {leaderboardStats?.hasStarted && (
          <div className="text-center mb-4">
            <p className="text-text-secondary text-sm">
              3-Month Distance Competition
            </p>
            <p className="text-primary text-sm font-medium">
              {getCompetitionStatus()}
            </p>
            {lastUpdated && (
              <p className="text-text-tertiary text-xs mt-1">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Prize Pool - Keep existing prize pool display */}
      <div className="mb-4">
        <div 
          className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-4 cursor-pointer hover:from-yellow-500 hover:to-orange-500 transition-all duration-200"
          onClick={() => setShowPrizePoolModal(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="text-white font-bold text-lg">Total Prize Pool</h3>
                  <p className="text-yellow-100 text-sm">Click to view breakdown & rules</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white text-2xl font-bold">200,000</p>
              <p className="text-yellow-100 text-sm">SATS</p>
            </div>
            <div className="text-white text-xl">→</div>
          </div>
          
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="bg-black bg-opacity-20 rounded p-2">
              <p className="text-yellow-200 text-xs">1st</p>
              <p className="text-white font-semibold">30k</p>
            </div>
            <div className="bg-black bg-opacity-20 rounded p-2">
              <p className="text-yellow-200 text-xs">2nd</p>
              <p className="text-white font-semibold">20k</p>
            </div>
            <div className="bg-black bg-opacity-20 rounded p-2">
              <p className="text-yellow-200 text-xs">3rd</p>
              <p className="text-white font-semibold">15k</p>
            </div>
            <div className="bg-black bg-opacity-20 rounded p-2">
              <p className="text-yellow-200 text-xs">Hon.</p>
              <p className="text-white font-semibold">5k</p>
            </div>
          </div>
          
          <p className="text-yellow-100 text-xs text-center mt-2">
            Per activity mode (Running, Walking, Cycling)
          </p>
        </div>
      </div>

      {/* User Competition Stats - Only show if competition has started and user has activities */}
      {publicKey && userStats?.hasStarted && userActivities.length > 0 && (
        <div className="bg-bg-tertiary rounded-lg p-4 mb-4 border border-border-secondary">
          <h3 className="font-semibold text-text-primary mb-3">Your Competition Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-text-secondary text-sm">Total Distance</p>
              <p className="text-primary text-lg font-bold">{formatDistance(userTotalDistance)} mi</p>
            </div>
            <div className="text-center">
              <p className="text-text-secondary text-sm">Activities</p>
              <p className="text-primary text-lg font-bold">{userActivities.length}</p>
            </div>
            <div className="text-center">
              <p className="text-text-secondary text-sm">Daily Average</p>
              <p className="text-primary text-lg font-bold">{formatDistance(userStats.dailyAverage)} mi</p>
            </div>
            <div className="text-center">
              <p className="text-text-secondary text-sm">Projected Total</p>
              <p className="text-primary text-lg font-bold">{formatDistance(userStats.projectedTotal)} mi</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="league-leaderboard">
        <div className="leaderboard-header">
          <h3 className="font-bold text-text-primary mb-2">🏆 League Standings</h3>
          <p className="text-text-secondary text-sm">
            Top 10 {getActivityDisplayName()}s by Total Distance
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            <p className="text-text-secondary text-center py-8">
              {getEmptyStateMessage()}
            </p>
            {!hasSeasonPass && publicKey && (
              <div className="text-center mt-4">
                <button
                  onClick={handleSeasonPassClick}
                  className="bg-primary text-text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  Get Season Pass to Compete
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="leaderboard-list">
            {enhancedLeaderboard.map((user, index) => (
              <div
                key={user.pubkey}
                className={`leaderboard-item ${user.isCurrentUser ? 'bg-primary bg-opacity-10 border-primary' : ''}`}
              >
                <div className="leaderboard-rank">
                  <span className="font-bold text-text-primary">
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${user.rank}`}
                  </span>
                </div>

                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-text-primary truncate">
                        {user.displayName}
                      </p>
                      {user.isCurrentUser && (
                        <span className="text-xs bg-primary text-text-primary px-2 py-1 rounded-full">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary text-sm">
                      {getActivityText(user.activityCount)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-text-primary">
                    {formatDistance(user.totalMiles)} mi
                  </p>
                  <p className="text-text-secondary text-sm">
                    {formatDistance(user.averageDistance)} avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSeasonPassModal && (
        <SeasonPassPaymentModal
          onClose={() => setShowSeasonPassModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
      
      {showPrizePoolModal && (
        <PrizePoolModal
          onClose={() => setShowPrizePoolModal(false)}
        />
      )}
    </div>
  );
};
