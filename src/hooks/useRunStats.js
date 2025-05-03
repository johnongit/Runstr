import { useState, useEffect, useCallback } from 'react';
import runDataService from '../services/RunDataService';
import { useSettings } from '../contexts/SettingsContext';

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
  const calculateStats = useCallback((runs) => {
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
          if (distanceInKm >= 5) {
            const timeFor5K = (5 * paceInMinutes * 60); // seconds
            if (timeFor5K < newStats.personalBests['5k'] || newStats.personalBests['5k'] === 99999) {
              newStats.personalBests['5k'] = timeFor5K;
            }
          }
          
          // 10K
          if (distanceInKm >= 10) {
            const timeFor10K = (10 * paceInMinutes * 60); // seconds
            if (timeFor10K < newStats.personalBests['10k'] || newStats.personalBests['10k'] === 99999) {
              newStats.personalBests['10k'] = timeFor10K;
            }
          }
          
          // Half Marathon (21.1km)
          if (distanceInKm >= 21.1) {
            const timeForHalfMarathon = (21.1 * paceInMinutes * 60); // seconds
            if (timeForHalfMarathon < newStats.personalBests['halfMarathon'] || newStats.personalBests['halfMarathon'] === 99999) {
              newStats.personalBests['halfMarathon'] = timeForHalfMarathon;
            }
          }
          
          // Marathon (42.2km)
          if (distanceInKm >= 42.2) {
            const timeForMarathon = (42.2 * paceInMinutes * 60); // seconds
            if (timeForMarathon < newStats.personalBests['marathon'] || newStats.personalBests['marathon'] === 99999) {
              newStats.personalBests['marathon'] = timeForMarathon;
            }
          }
        }
      }
      
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
      // Convert date strings to timestamps for easier comparison
      const timestamps = dates.map(d => new Date(d).getTime());
      
      // Current streak
      let currentStreak = 0;
      const yesterday = today - 86400000; // 24 hours in milliseconds
      
      // Check if there's a run today or yesterday to start the streak
      if (timestamps.includes(today) || timestamps.includes(yesterday)) {
        currentStreak = 1;
        
        // Go back in time day by day
        let checkDate = yesterday;
        while (true) {
          checkDate -= 86400000; // Go back one day
          
          // If we find a run on this day, increment streak
          if (timestamps.includes(checkDate)) {
            currentStreak++;
          } else {
            // Streak is broken
            break;
          }
        }
      }
      
      // Best streak
      let bestStreak = 0;
      let currentBestStreak = 1;
      
      for (let i = 1; i < timestamps.length; i++) {
        // Check if dates are consecutive
        if (timestamps[i] - timestamps[i-1] <= 86400000) {
          currentBestStreak++;
        } else {
          // Update best streak and reset current
          bestStreak = Math.max(bestStreak, currentBestStreak);
          currentBestStreak = 1;
        }
      }
      
      // Update best streak one more time after the loop
      bestStreak = Math.max(bestStreak, currentBestStreak);
      
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