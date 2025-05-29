import { useState, useEffect, useCallback } from 'react';
import runDataService from '../services/RunDataService';
import { useSettings } from '../contexts/SettingsContext';
import { MIN_STREAK_DISTANCE } from '../config/rewardsConfig';

/**
 * Custom hook for calculating and managing run statistics
 * Optimized for Android
 */
export const useRunStats = (runHistory, userProfile) => {
  // Use the global settings context instead of local state
  const { distanceUnit } = useSettings();
  
  // Initialize stats with default values
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    averagePace: 0,
    fastestPace: 0,
    longestRun: 0,
    currentStreak: 0,
    bestStreak: 0,
    thisWeekDistance: 0,
    thisMonthDistance: 0,
    totalCaloriesBurned: 0,
    averageCaloriesPerKm: 0,
    previousWeekDistance: 0,
    weeklyImprovementRate: 0,
    leaderboardParticipation: true,
    personalBests: {
      '5k': 0,
      '10k': 0,
      'halfMarathon': 0,
      'marathon': 0
    }
  });

  // Update stats when run history, user profile, or distance unit changes
  useEffect(() => {
    if (runHistory.length > 0) {
      calculateStats(runHistory);
    }
  }, [runHistory, userProfile, distanceUnit]);

  // Calculate calories burned for a run
  const calculateCaloriesBurned = useCallback((distance, duration) => {
    // Default metabolic equivalent (MET) for running
    const MET = 8;
    
    // Use user profile weight if available, or default to 70kg
    const weight = userProfile?.weight || 70;
    
    // Calculate calories: MET * weight (kg) * duration (hours)
    const durationInHours = duration / 3600;
    return Math.round(MET * weight * durationInHours);
  }, [userProfile]);

  // Calculate all stats from run history
  const calculateStats = useCallback(async (runs) => {
    if (!runs || !runs.length) return;

    // Initialize stats
    const newStats = {
      totalDistance: 0,
      totalRuns: runs.length,
      averagePace: 0,
      fastestPace: 99999, // Start with high value to find minimum
      longestRun: 0,
      currentStreak: 0,
      bestStreak: 0,
      thisWeekDistance: 0,
      thisMonthDistance: 0,
      previousWeekDistance: 0,
      weeklyImprovementRate: 0,
      totalCaloriesBurned: 0,
      averageCaloriesPerKm: 0,
      leaderboardParticipation: true,
      personalBests: {
        '5k': 99999,
        '10k': 99999,
        'halfMarathon': 99999,
        'marathon': 99999
      }
    };

    // For average pace calculation
    let totalPace = 0;
    let validPaceCount = 0;

    // Group runs by date for streak calculations
    const runsByDate = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Get the start of this week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get the start of last week
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    // Get the start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // Get unique dates for streak calculation
    const dates = [];

    // Process each run
    runs.forEach((run) => {
      // Skip runs with invalid data
      if (!run.distance || !run.duration) return;
      
      // Add to total distance (convert to km for consistent calculation)
      newStats.totalDistance += run.distance;
      
      // Check for longest run
      newStats.longestRun = Math.max(newStats.longestRun, run.distance);
      
      // Calculate pace (minutes per km or mile)
      const distanceInUnit = distanceUnit === 'km' 
        ? run.distance / 1000 
        : run.distance / 1609.344;
        
      if (distanceInUnit > 0) {
        const paceInMinutes = (run.duration / 60) / distanceInUnit;
        
        // Only include valid pace values
        if (paceInMinutes > 0 && paceInMinutes < 60) { // Filter out extreme values
          totalPace += paceInMinutes;
          validPaceCount++;
          
          // Update fastest pace
          if (paceInMinutes < newStats.fastestPace) {
            newStats.fastestPace = paceInMinutes;
          }
          
          // Calculate personal bests for standard distances
          const distanceInKm = run.distance / 1000;
          
          // 5K
          if (distanceInKm >= 4.95 && distanceInKm < 5.05) { // Capture runs that are essentially 5km long
            const actualTimeFor5K = run.duration / 60; // run.duration is in seconds, convert to minutes
            if (actualTimeFor5K < newStats.personalBests['5k'] || newStats.personalBests['5k'] === 99999) {
              newStats.personalBests['5k'] = actualTimeFor5K;
            }
          } else if (distanceInKm >= 5.05) { // For runs longer than 5km, use pace extrapolation (less accurate)
            const timeFor5K = (5 * paceInMinutes); // paceInMinutes is already minutes per unit_distance
            if (timeFor5K < newStats.personalBests['5k'] || newStats.personalBests['5k'] === 99999) {
              newStats.personalBests['5k'] = timeFor5K;
            }
          }
          
          // 10K
          const tenKLowerBound = 9.9;
          const tenKUpperBound = 10.1;
          if (distanceInKm >= tenKLowerBound && distanceInKm < tenKUpperBound) {
            const actualTimeFor10K = run.duration / 60; // minutes
            if (actualTimeFor10K < newStats.personalBests['10k'] || newStats.personalBests['10k'] === 99999) {
              newStats.personalBests['10k'] = actualTimeFor10K;
            }
          } else if (distanceInKm >= tenKUpperBound) { // For runs longer
            const timeFor10K = (10 * paceInMinutes); // minutes
            if (timeFor10K < newStats.personalBests['10k'] || newStats.personalBests['10k'] === 99999) {
              newStats.personalBests['10k'] = timeFor10K;
            }
          }
          
          // Half Marathon (21.0975km, using 21.1km for multiplication)
          const hmLowerBound = 20.9;
          const hmUpperBound = 21.3;
          const hmTargetDist = 21.1; // Using 21.1 for pace extrapolation consistency
          if (distanceInKm >= hmLowerBound && distanceInKm < hmUpperBound) {
            const actualTimeForHM = run.duration / 60; // minutes
            if (actualTimeForHM < newStats.personalBests['halfMarathon'] || newStats.personalBests['halfMarathon'] === 99999) {
              newStats.personalBests['halfMarathon'] = actualTimeForHM;
            }
          } else if (distanceInKm >= hmUpperBound) { // For runs longer
            const timeForHalfMarathon = (hmTargetDist * paceInMinutes); // minutes
            if (timeForHalfMarathon < newStats.personalBests['halfMarathon'] || newStats.personalBests['halfMarathon'] === 99999) {
              newStats.personalBests['halfMarathon'] = timeForHalfMarathon;
            }
          }
          
          // Marathon (42.195km, using 42.2km for multiplication)
          const mLowerBound = 41.9;
          const mUpperBound = 42.5; // Adjusted for a slightly wider tolerance
          const mTargetDist = 42.2; // Using 42.2 for pace extrapolation consistency
          if (distanceInKm >= mLowerBound && distanceInKm < mUpperBound) {
            const actualTimeForM = run.duration / 60; // minutes
            if (actualTimeForM < newStats.personalBests['marathon'] || newStats.personalBests['marathon'] === 99999) {
              newStats.personalBests['marathon'] = actualTimeForM;
            }
          } else if (distanceInKm >= mUpperBound) { // For runs longer
            const timeForMarathon = (mTargetDist * paceInMinutes); // minutes
            if (timeForMarathon < newStats.personalBests['marathon'] || newStats.personalBests['marathon'] === 99999) {
              newStats.personalBests['marathon'] = timeForMarathon;
            }
          }
        }
      }
      
      // Process date information for streak calculation – only if run meets minimum distance for streak
      const qualifiesForStreak = run.distance >= (distanceUnit === 'km' ? MIN_STREAK_DISTANCE.km : MIN_STREAK_DISTANCE.mi);

      // Only runs meeting the distance gate are considered for streak calculations
      if (qualifiesForStreak) {
        // Process date information for streak calculation
        let runDate = new Date(run.date);
        
        // For older runs that stored date as milliseconds
        if (isNaN(runDate.getTime()) && !isNaN(parseInt(run.date))) {
          runDate = new Date(parseInt(run.date));
        }

        if (!isNaN(runDate.getTime())) {
          // Format the date as YYYY-MM-DD for consistent grouping
          const dateKey = runDate.toISOString().split('T')[0];
          runsByDate[dateKey] = true;
          
          // Add to dates array for streak calculation
          if (!dates.includes(dateKey)) {
            dates.push(dateKey);
          }
          
          // Check if run is from this week
          if (runDate >= startOfWeek) {
            newStats.thisWeekDistance += run.distance;
          }
          
          // Check if run is from last week
          if (runDate >= startOfLastWeek && runDate < startOfWeek) {
            newStats.previousWeekDistance += run.distance;
          }
          
          // Check if run is from this month
          if (runDate >= startOfMonth) {
            newStats.thisMonthDistance += run.distance;
          }
        }
      }

      // Calculate calories burned
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      newStats.totalCaloriesBurned += caloriesBurned;
    });

    // Calculate average pace if we have valid pace data
    if (validPaceCount > 0) {
      newStats.averagePace = totalPace / validPaceCount;
    }
    
    // Calculate average calories per km
    if (newStats.totalDistance > 0) {
      const distanceInKm = newStats.totalDistance / 1000;
      newStats.averageCaloriesPerKm = newStats.totalCaloriesBurned / distanceInKm;
    }
    
    // Reset PBs if they weren't set
    if (newStats.personalBests['5k'] === 99999) newStats.personalBests['5k'] = 0;
    if (newStats.personalBests['10k'] === 99999) newStats.personalBests['10k'] = 0;
    if (newStats.personalBests['halfMarathon'] === 99999) newStats.personalBests['halfMarathon'] = 0;
    if (newStats.personalBests['marathon'] === 99999) newStats.personalBests['marathon'] = 0;
    
    // Calculate improvement rate
    if (newStats.previousWeekDistance > 0) {
      newStats.weeklyImprovementRate = ((newStats.thisWeekDistance - newStats.previousWeekDistance) / 
                                       newStats.previousWeekDistance) * 100;
    } else if (newStats.thisWeekDistance > 0) {
      newStats.weeklyImprovementRate = 100; // First week with data, assume 100% improvement
    }
    
    // Calculate streaks
    if (dates.length > 0) {
      // Use Set for O(1) look-ups.
      const dateSet = new Set(dates);

      // Helper to get YYYY-MM-DD string for a JS Date (local time).
      const toYMD = (d) => {
        const yyyy = d.getFullYear();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      // Current streak — walk backwards from today.
      let currentStreak = 0;
      let cursor = new Date(); // today (now)
      let cursorStr = toYMD(cursor);

      // While we have a run on the cursor date, keep decrementing.
      while (dateSet.has(cursorStr)) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
        cursorStr = toYMD(cursor);
      }

      // Best streak — sort the date strings and scan.
      const sorted = Array.from(dateSet).sort(); // lex sort works for YYYY-MM-DD
      let bestStreak = 0;
      let tempStreak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) {
          tempStreak += 1;
        } else {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);

      newStats.currentStreak = currentStreak;
      newStats.bestStreak = bestStreak;
    }
    
    // Load any persistent settings from localStorage
    try {
      const participationSetting = localStorage.getItem('leaderboardParticipation');
      if (participationSetting !== null) {
        newStats.leaderboardParticipation = JSON.parse(participationSetting);
      }
    } catch (err) {
      console.error('Error loading leaderboard participation setting:', err);
    }
    
    // --- NWC streak reward integration ---
    try {
      const pubkeyStored = localStorage.getItem('userPubkey') || localStorage.getItem('nostrPublicKey');
      if (pubkeyStored && newStats.currentStreak > 0) {
        // Dynamically import to avoid cyclic deps for React Native / Web bundlers
        const mod = await import('../utils/streakUtils.ts');
        if (mod?.syncStreakWithStats) {
          await mod.syncStreakWithStats(newStats.currentStreak, pubkeyStored);
        }
      }
    } catch (err) {
      console.error('[RunStats] Auto streak reward sync failed:', err);
    }
    // --- end integration ---
    
    setStats(newStats);
    
    // Save current stats to localStorage for other components to use
    try {
      localStorage.setItem('runStats', JSON.stringify(newStats));
    } catch (err) {
      console.error('Error saving run stats to localStorage:', err);
    }
  }, [distanceUnit, calculateCaloriesBurned]);

  return {
    stats,
    calculateStats,
    calculateCaloriesBurned
  };
}; 