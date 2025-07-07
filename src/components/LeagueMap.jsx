import { useState, useEffect, useMemo } from 'react';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import { useProfiles } from '../hooks/useProfiles';
import { useNostr } from '../hooks/useNostr';
import SeasonPassPaymentModal from './modals/SeasonPassPaymentModal';
import PrizePoolModal from './modals/PrizePoolModal';
import seasonPassPaymentService from '../services/seasonPassPaymentService';
import seasonPassService from '../services/seasonPassService';

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
    courseTotal,
    activityMode
  } = useLeagueLeaderboard();

  // OPTION 2: Fallback aggregation from feedPosts
  const fallbackLeaderboardFromFeed = useMemo(() => {
    if (!feedPosts || feedPosts.length === 0) return [];
    
    console.log('[LeagueMap] Generating fallback leaderboard from', feedPosts.length, 'feed posts');
    
    // Competition date range (matches useLeagueLeaderboard)
    const COMPETITION_START = Math.floor(new Date('2025-07-01T00:00:00Z').getTime() / 1000);
    const COMPETITION_END = Math.floor(new Date('2025-07-30T23:59:59Z').getTime() / 1000);
    
    // Get season pass participants
    const participants = seasonPassService.getParticipants();
    const participantSet = new Set(participants);
    
    // Extract distance from event (matches useLeagueLeaderboard logic)
    const extractDistance = (event) => {
      try {
        const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
        if (!distanceTag || !distanceTag[1]) return 0;
        
        const value = parseFloat(distanceTag[1]);
        if (isNaN(value) || value < 0) return 0;
        
        const unit = distanceTag[2]?.toLowerCase() || 'km';
        
        // Convert to km first for validation
        let distanceInKm = value;
        switch (unit) {
          case 'mi':
          case 'mile':
          case 'miles':
            distanceInKm = value * 1.609344;
            break;
          case 'm':
          case 'meter':
          case 'meters':
            distanceInKm = value / 1000;
            break;
          case 'km':
          case 'kilometer':
          case 'kilometers':
          default:
            distanceInKm = value;
            break;
        }
        
        // Validate reasonable range
        if (distanceInKm < 0.01 || distanceInKm > 500) {
          console.warn(`[LeagueMap] Invalid distance: ${value} ${unit} - filtering out`);
          return 0;
        }
        
        // Return in miles for consistency
        return distanceInKm * 0.621371;
      } catch (err) {
        console.error('[LeagueMap] Error extracting distance:', err);
        return 0;
      }
    };
    
    // Aggregate by participant
    const participantMap = new Map();
    
    feedPosts.forEach(event => {
      // Only process events from season pass participants
      if (!participantSet.has(event.pubkey)) {
        return;
      }
      
      // Check date range
      if (event.created_at < COMPETITION_START || event.created_at > COMPETITION_END) {
        return;
      }
      
      // Filter by current activity mode
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const eventActivityType = exerciseTag?.[1]?.toLowerCase();
      
      const activityMatches = {
        'run': ['run', 'running', 'jog', 'jogging'],
        'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
        'walk': ['walk', 'walking', 'hike', 'hiking']
      };
      
      const acceptedActivities = activityMatches[activityMode] || ['run', 'running', 'jog', 'jogging'];
      
      if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
        return;
      }
      
      const distance = extractDistance(event);
      if (distance <= 0) return;
      
      // Add to participant map
      if (!participantMap.has(event.pubkey)) {
        participantMap.set(event.pubkey, {
          pubkey: event.pubkey,
          totalMiles: 0,
          runCount: 0,
          lastActivity: 0,
          runs: []
        });
      }
      
      const participant = participantMap.get(event.pubkey);
      participant.totalMiles += distance;
      participant.runCount++;
      participant.lastActivity = Math.max(participant.lastActivity, event.created_at);
      participant.runs.push({
        distance,
        timestamp: event.created_at,
        eventId: event.id,
        activityType: eventActivityType
      });
    });
    
    // Convert to sorted array
    const sortedParticipants = Array.from(participantMap.values())
      .map(participant => ({
        ...participant,
        totalMiles: Math.round(participant.totalMiles * 100) / 100
      }))
      .sort((a, b) => {
        if (b.totalMiles !== a.totalMiles) return b.totalMiles - a.totalMiles;
        if (b.runCount !== a.runCount) return b.runCount - a.runCount;
        return b.lastActivity - a.lastActivity;
      });
    
    // Add ranks
    const rankedParticipants = sortedParticipants.map((participant, index) => ({
      ...participant,
      rank: index + 1
    }));
    
    console.log('[LeagueMap] Fallback leaderboard generated:', rankedParticipants.length, 'participants');
    rankedParticipants.forEach(p => {
      console.log(`  ${p.pubkey.slice(0, 8)}: ${p.totalMiles} mi, ${p.runCount} runs`);
    });
    
    return rankedParticipants;
  }, [feedPosts, activityMode]);

  // Get profiles for leaderboard users (including fallback)
  const leaderboardPubkeys = useMemo(() => {
    const mainPubkeys = leaderboard.map(user => user.pubkey);
    const fallbackPubkeys = fallbackLeaderboardFromFeed.map(user => user.pubkey);
    return [...new Set([...mainPubkeys, ...fallbackPubkeys])];
  }, [leaderboard, fallbackLeaderboardFromFeed]);
  const { profiles } = useProfiles(leaderboardPubkeys);

  // Phase 7: Get participant count
  const participantCount = useMemo(() => 
    seasonPassService.getParticipantCount(), []
  );

  // Determine which leaderboard to use
  const effectiveLeaderboard = useMemo(() => {
    // Check if main leaderboard has meaningful data (any participant with > 0 miles)
    const hasValidData = leaderboard.some(user => user.totalMiles > 0);
    
    if (hasValidData) {
      console.log('[LeagueMap] Using main leaderboard with valid data');
      return leaderboard;
    }
    
    // Check if we have feed data to fall back to
    if (fallbackLeaderboardFromFeed.length > 0) {
      console.log('[LeagueMap] Main leaderboard empty/zero - using fallback from feed');
      return fallbackLeaderboardFromFeed;
    }
    
    console.log('[LeagueMap] Using main leaderboard (no fallback available)');
    return leaderboard;
  }, [leaderboard, fallbackLeaderboardFromFeed]);

  // Enhanced leaderboard with profile data
  const enhancedLeaderboard = useMemo(() => {
    return effectiveLeaderboard.map(user => {
      // Fix: useProfiles returns an object, not a Map
      const profile = profiles?.[user.pubkey] || profiles?.get?.(user.pubkey) || {};
      return {
        ...user,
        displayName: profile.display_name || profile.name || `Runner ${user.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        isCurrentUser: user.pubkey === publicKey
      };
    });
  }, [effectiveLeaderboard, profiles, publicKey]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, []);

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

  // Phase 7: Get participant count text
  const getParticipantCountText = () => {
    if (participantCount === 0) return 'No season pass holders yet';
    if (participantCount === 1) return '1 Season Pass Holder';
    return `${participantCount} Season Pass Holders`;
  };

  // Generate dynamic activity text based on activity mode
  const getActivityText = (count) => {
    if (!activityMode) return `${count} run${count !== 1 ? 's' : ''}`; // Fallback
    
    switch (activityMode) {
      case 'run':
        return `${count} run${count !== 1 ? 's' : ''}`;
      case 'walk':
        return `${count} walk${count !== 1 ? 's' : ''}`;
      case 'cycle':
        return `${count} ride${count !== 1 ? 's' : ''}`;
      default:
        return `${count} run${count !== 1 ? 's' : ''}`;
    }
  };

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance || 0).toFixed(1);
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
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Prize Pool Display */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{getLeagueTitle()}</h3>
              {/* Phase 7: Participant count display */}
              <p className="text-sm text-text-secondary mt-1">{getParticipantCountText()}</p>
            </div>
            {!hasSeasonPass && (
              <button
                onClick={handleSeasonPassClick}
                className="px-3 py-1 bg-primary text-text-primary text-sm rounded-md font-semibold hover:bg-primary/80 transition-colors"
              >
                🎫 Season Pass
              </button>
            )}
            {hasSeasonPass && (
              <span className="px-3 py-1 bg-white text-black text-sm rounded-md font-semibold border border-gray-300">
                ✓ Season Member
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary">
            {lastUpdated && `Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
          </div>
        </div>
        
        {/* Prize Pool Section */}
        <div 
          onClick={() => setShowPrizePoolModal(true)}
          className="relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/30 rounded-xl p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all duration-300 group"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-xl group-hover:from-amber-500/10 group-hover:to-orange-500/10 transition-all duration-300"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div>
                <div className="text-xl font-bold text-text-primary mb-1">Total Prize Pool</div>
                <div className="text-text-secondary text-sm">Click to view breakdown & rules</div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-400 mb-1">200,000</div>
              <div className="text-amber-300 font-semibold">SATS</div>
            </div>
          </div>
          
          {/* Prize distribution preview */}
          <div className="mt-4 pt-4 border-t border-amber-500/20">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="text-xs">
                <div className="text-amber-300 font-semibold">1st</div>
                <div className="text-text-secondary">30k</div>
              </div>
              <div className="text-xs">
                <div className="text-gray-300 font-semibold">2nd</div>
                <div className="text-text-secondary">20k</div>
              </div>
              <div className="text-xs">
                <div className="text-orange-300 font-semibold">3rd</div>
                <div className="text-text-secondary">15k</div>
              </div>
              <div className="text-xs">
                <div className="text-blue-300 font-semibold">Hon.</div>
                <div className="text-text-secondary">5k</div>
              </div>
            </div>
            <div className="text-xs text-text-muted text-center mt-2">Per activity mode (Running, Walking, Cycling)</div>
          </div>
          
          {/* Click indicator */}
          <div className="absolute top-4 right-4 text-text-muted group-hover:text-text-secondary transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Workout-Card-Styled Leaderboard */}
      <div className="bg-bg-secondary rounded-lg border border-border-secondary overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-bg-tertiary">
          <h3 className="text-lg font-semibold text-text-primary">🏆 League Standings</h3>
          <div className="flex items-center gap-2">
            {/* Debug refresh button for mobile */}
            <button
              onClick={refreshLeaderboard}
              className="px-2 py-1 bg-primary text-white text-xs rounded font-semibold"
              disabled={leaderboardLoading}
            >
              {leaderboardLoading ? '...' : '🔄'}
            </button>
            {leaderboardLoading && (
              <div className="flex items-center">
                <div className="flex space-x-1">
                  <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
                  <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
                  <span className="w-1 h-1 bg-text-secondary rounded-full"></span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {enhancedLeaderboard.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-text-secondary">
              No {activityMode === 'run' ? 'runners' : activityMode === 'walk' ? 'walkers' : 'cyclists'} found yet. Be the first to start!
            </p>
            {/* Debug info for mobile */}
            {leaderboardLoading && (
              <div className="mt-3 p-2 bg-bg-tertiary rounded text-xs">
                <div className="text-text-muted">
                  Debug: Fetching data...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {enhancedLeaderboard.slice(0, 10).map((user) => (
              <div 
                key={user.pubkey} 
                className={`flex items-center justify-between p-4 ${
                  user.isCurrentUser ? 'bg-primary/5 border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Rank Badge */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${user.rank === 1 ? 'bg-yellow-500 text-black' : ''}
                    ${user.rank === 2 ? 'bg-gray-400 text-black' : ''}
                    ${user.rank === 3 ? 'bg-orange-600 text-white' : ''}
                    ${user.rank > 3 ? 'bg-bg-tertiary text-text-secondary border border-border-secondary' : ''}
                  `}>
                    {user.rank}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary truncate">
                        {user.displayName}
                      </span>
                      {user.isCurrentUser && (
                        <span className="px-2 py-1 bg-primary text-text-primary text-xs rounded-full font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {getActivityText(user.runCount)}
                    </div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="text-right">
                  <div className="font-semibold text-text-primary">
                    {formatDistance(user.totalMiles)} mi
                  </div>
                  <div className="text-xs text-text-secondary">
                    Rank #{user.rank}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Season Pass Payment Modal */}
      <SeasonPassPaymentModal
        open={showSeasonPassModal}
        onClose={() => setShowSeasonPassModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Prize Pool Modal */}
      <PrizePoolModal
        open={showPrizePoolModal}
        onClose={() => setShowPrizePoolModal(false)}
      />
    </div>
  );
};
