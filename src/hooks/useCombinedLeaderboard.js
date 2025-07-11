import { useMemo } from 'react';
import { useHistoricalTotals } from './useHistoricalTotals';
import { useRecentActivity } from './useRecentActivity';

/**
 * Hook: useCombinedLeaderboard
 * Intelligently combines historical totals with recent activity
 * Provides complete, real-time leaderboard without double-counting
 * 
 * @param {Array} feedPosts - Recent feed posts for real-time updates
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, dataSource }
 */
export const useCombinedLeaderboard = (feedPosts = []) => {
  // Get historical totals (cached, updated every 30 minutes)
  const {
    historicalTotals,
    isLoading: historicalLoading,
    error: historicalError,
    refresh: refreshHistorical,
    lastUpdated: historicalLastUpdated
  } = useHistoricalTotals();

  // Calculate cutoff timestamp to avoid double-counting
  // Use the timestamp when historical data was last fetched
  const cutoffTimestamp = useMemo(() => {
    if (!historicalLastUpdated) return null;
    // Use historical update time minus 5 minutes buffer to handle clock drift
    return Math.floor((historicalLastUpdated.getTime() - 5 * 60 * 1000) / 1000);
  }, [historicalLastUpdated]);

  // Get recent activity since historical cutoff
  const { recentActivity, totalRecentEvents } = useRecentActivity(feedPosts, cutoffTimestamp);

  /**
   * Combine historical totals with recent activity
   */
  const combinedLeaderboard = useMemo(() => {
    if (historicalTotals.length === 0) {
      console.log('[useCombinedLeaderboard] No historical data available');
      return [];
    }

    console.log(`[useCombinedLeaderboard] Combining ${historicalTotals.length} historical records with ${recentActivity.length} recent activities`);

    // Create map of recent activity by pubkey for fast lookup
    const recentActivityMap = new Map();
    recentActivity.forEach(activity => {
      recentActivityMap.set(activity.pubkey, activity);
    });

    // Combine historical + recent for each participant
    const combinedData = historicalTotals.map(historical => {
      const recent = recentActivityMap.get(historical.pubkey);
      
      if (recent) {
        // Combine historical + recent
        return {
          pubkey: historical.pubkey,
          totalMiles: Math.round((historical.totalMiles + recent.recentMiles) * 100) / 100,
          runCount: historical.runCount + recent.recentRunCount,
          lastActivity: Math.max(historical.lastActivity, Math.max(...recent.recentRuns.map(r => r.timestamp), 0)),
          runs: [...historical.runs, ...recent.recentRuns],
          // Keep track of data sources for debugging
          historicalMiles: historical.totalMiles,
          recentMiles: recent.recentMiles,
          historicalRuns: historical.runCount,
          recentRuns: recent.recentRunCount
        };
      } else {
        // Only historical data
        return {
          pubkey: historical.pubkey,
          totalMiles: historical.totalMiles,
          runCount: historical.runCount,
          lastActivity: historical.lastActivity,
          runs: historical.runs,
          historicalMiles: historical.totalMiles,
          recentMiles: 0,
          historicalRuns: historical.runCount,
          recentRuns: 0
        };
      }
    });

    // Sort by total distance (historical + recent)
    const sortedData = combinedData.sort((a, b) => {
      if (b.totalMiles !== a.totalMiles) return b.totalMiles - a.totalMiles;
      if (b.runCount !== a.runCount) return b.runCount - a.runCount;
      return b.lastActivity - a.lastActivity;
    });

    // Add ranks
    const rankedData = sortedData.map((participant, index) => ({
      ...participant,
      rank: index + 1
    }));

    console.log('[useCombinedLeaderboard] Combined leaderboard:');
    rankedData.forEach(p => {
      console.log(`  ${p.pubkey.slice(0, 8)}: ${p.totalMiles} mi (${p.historicalMiles} historical + ${p.recentMiles} recent), ${p.runCount} runs`);
    });

    return rankedData;
  }, [historicalTotals, recentActivity]);

  /**
   * Determine data source status for UI feedback
   */
  const dataSource = useMemo(() => {
    if (historicalLoading) return 'loading';
    if (historicalError) return 'error';
    if (historicalTotals.length === 0) return 'empty';
    if (totalRecentEvents > 0) return 'hybrid'; // Historical + recent
    return 'historical'; // Historical only
  }, [historicalLoading, historicalError, historicalTotals.length, totalRecentEvents]);

  /**
   * Refresh function that updates historical data
   */
  const refresh = () => {
    console.log('[useCombinedLeaderboard] Refreshing historical data...');
    refreshHistorical();
  };

  return {
    leaderboard: combinedLeaderboard,
    isLoading: historicalLoading,
    error: historicalError,
    refresh,
    lastUpdated: historicalLastUpdated,
    dataSource,
    // Debug info
    debugInfo: {
      historicalCount: historicalTotals.length,
      recentCount: recentActivity.length,
      totalRecentEvents,
      cutoffTimestamp: cutoffTimestamp ? new Date(cutoffTimestamp * 1000).toISOString() : null
    }
  };
}; 