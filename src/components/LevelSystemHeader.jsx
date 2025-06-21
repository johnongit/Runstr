import React, { useState, useEffect, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';

// Circular Progress Ring Component
const CircularProgress = ({ percentage, level, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
        style={{ overflow: 'visible' }}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="4"
          className="text-border-secondary opacity-30"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="white"
          strokeWidth="4"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-in-out"
          strokeLinecap="round"
        />
      </svg>
      {/* Level number in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-text-primary">
          {level}
        </span>
      </div>
    </div>
  );
};

// Main Level System Header Component
const LevelSystemHeader = ({ levelData }) => {
  const { publicKey, ndk } = useContext(NostrContext);
  const [displayName, setDisplayName] = useState('');

  // Fetch user display name from Nostr profile
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!publicKey || !ndk) return;
      
      try {
        const user = ndk.getUser({ pubkey: publicKey });
        await user.fetchProfile();
        const profile = user.profile || {};
        
        // Use display_name, name, or fallback to truncated pubkey
        const name = profile.display_name || profile.name || `${publicKey.slice(0, 8)}...`;
        setDisplayName(name);
      } catch (error) {
        console.warn('LevelSystemHeader: Error fetching user profile:', error);
        // Fallback to truncated pubkey
        setDisplayName(`${publicKey.slice(0, 8)}...`);
      }
    };

    fetchDisplayName();
  }, [publicKey, ndk]);

  // Don't render if no level data or no qualifying workouts
  if (!levelData || levelData.qualifyingWorkouts === 0) {
    return null;
  }

  const {
    currentLevel,
    totalXP,
    xpForNextLevel,
    progressPercentage,
    qualifyingWorkouts
  } = levelData;

  return (
    <div className="bg-bg-secondary border border-border-secondary rounded-lg p-4 mb-6">
      {/* Main Header Layout */}
      <div className="flex items-center justify-between mb-3">
        {/* Left side: Username only */}
        <div className="flex items-center">
          <span className="font-semibold text-text-primary">{displayName}</span>
        </div>

        {/* Right side: Progress Ring */}
        <div className="flex flex-col items-center">
          <CircularProgress 
            percentage={progressPercentage}
            level={currentLevel}
          />
          <div className="mt-2 text-center">
            <div className="text-sm text-text-secondary">
              {totalXP}/{xpForNextLevel} XP
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="text-sm text-text-secondary">
        Total Qualifying Workouts: {qualifyingWorkouts} • Level {currentLevel}
      </div>
    </div>
  );
};

export default LevelSystemHeader;
