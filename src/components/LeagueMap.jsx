import { useState, useEffect } from 'react';
import { useLeaguePosition } from '../hooks/useLeaguePosition';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';
import '../assets/styles/league-map.css';

export const LeagueMap = () => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Get user's real position data
  const {
    totalDistance,
    mapPosition,
    qualifyingRuns,
    milesRemaining,
    isComplete,
    isLoading: positionLoading,
    error: positionError,
    refresh: refreshPosition
  } = useLeaguePosition();

  // Get leaderboard data
  const {
    leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    refresh: refreshLeaderboard
  } = useLeagueLeaderboard();

  useEffect(() => {
    // Simulate initial loading for UI polish
    const timer = setTimeout(() => setIsInitialLoad(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Calculate user position on course path based on progress percentage
  const calculateUserPosition = (progressPercentage) => {
    // Updated course path coordinates to match jagged outline
    const pathPoints = [
      { x: 55, y: 145 },   // Start (0%)
      { x: 82, y: 135 },   // ~12%
      { x: 128, y: 141 },  // ~25%
      { x: 175, y: 148 },  // ~38%
      { x: 220, y: 152 },  // ~50%
      { x: 275, y: 161 },  // ~62%
      { x: 325, y: 167 },  // ~75%
      { x: 368, y: 195 },  // ~87%
      { x: 358, y: 252 },  // Finish (100%)
    ];
    
    const progress = Math.min(100, Math.max(0, progressPercentage)) / 100;
    const segmentIndex = Math.floor(progress * (pathPoints.length - 1));
    const segmentProgress = (progress * (pathPoints.length - 1)) - segmentIndex;
    
    if (segmentIndex >= pathPoints.length - 1) {
      return pathPoints[pathPoints.length - 1];
    }
    
    const currentPoint = pathPoints[segmentIndex];
    const nextPoint = pathPoints[segmentIndex + 1];
    
    return {
      x: currentPoint.x + (nextPoint.x - currentPoint.x) * segmentProgress,
      y: currentPoint.y + (nextPoint.y - currentPoint.y) * segmentProgress
    };
  };

  // Format distance to 1 decimal place
  const formatDistance = (distance) => {
    return Number(distance).toFixed(1);
  };

  // Calculate milestone positions (250, 500, 750 miles)
  const getMilestonePositions = () => {
    return [
      { miles: 250, position: calculateUserPosition(25), percentage: 25 },
      { miles: 500, position: calculateUserPosition(50), percentage: 50 },
      { miles: 750, position: calculateUserPosition(75), percentage: 75 }
    ];
  };

  const userPosition = calculateUserPosition(mapPosition);
  const milestones = getMilestonePositions();

  if (isInitialLoad || positionLoading) {
    return (
      <div className="league-map-container">
        <div className="league-map-loading">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p className="text-text-secondary mt-2">
            {isInitialLoad ? 'Loading League Map' : 'Calculating position'}
          </p>
        </div>
      </div>
    );
  }

  if (positionError) {
    return (
      <div className="league-map-container">
        <div className="league-map-error">
          <p className="text-red-400 text-sm mb-2">Error loading position data</p>
          <button 
            onClick={refreshPosition}
            className="px-3 py-1 bg-primary hover:bg-primary-hover text-text-primary text-sm rounded-md transition-colors duration-normal"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="league-map-container">
      <div className="league-map-header">
        <h2 className="section-heading mb-2">RUNSTR LEAGUE</h2>
        <p className="text-text-secondary text-sm">Race to 1000 miles</p>
      </div>
      
      <div className="league-map-course">
        {/* Jagged state-like course outline */}
        <div className="course-outline-container">
          <svg 
            viewBox="0 0 400 280" 
            className="w-full h-48 border border-border-secondary rounded-lg bg-bg-secondary"
            style={{ maxWidth: '400px', height: '200px' }}
          >
            {/* Course background */}
            <rect x="0" y="0" width="400" height="280" fill="transparent" />
            
            {/* Jagged state-like course outline */}
            <path
              d="M 55 145 
                 L 68 138 L 75 142 L 82 135 L 95 139 L 103 133 
                 L 115 137 L 128 141 L 135 135 L 148 140 L 155 145 
                 L 162 142 L 175 148 L 183 145 L 195 150 L 208 147 
                 L 220 152 L 235 149 L 248 155 L 260 158 L 275 161 
                 L 285 157 L 298 163 L 310 160 L 325 167 L 335 172 
                 L 345 169 L 355 175 L 362 182 L 368 195 L 372 208 
                 L 375 220 L 370 235 L 365 245 L 358 252 L 345 248 
                 L 332 243 L 318 238 L 305 242 L 290 237 L 278 233 
                 L 265 228 L 252 232 L 238 227 L 225 222 L 210 218 
                 L 195 213 L 182 208 L 168 212 L 155 207 L 142 202 
                 L 128 198 L 115 193 L 102 188 L 88 182 L 78 175 
                 L 68 168 L 62 158 L 58 152 L 55 145 
                 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-primary course-outline"
            />
            
            {/* Small jagged inlet detail */}
            <path
              d="M 285 157 L 295 152 L 300 157 L 298 163 L 290 160 L 285 157"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-text-primary course-detail"
            />
            
            {/* Small jagged peninsula detail */}
            <path
              d="M 183 145 L 188 142 L 192 146 L 190 150 L 185 148 L 183 145"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-text-primary course-detail"
            />

            {/* Milestone markers at 250, 500, 750 miles */}
            {milestones.map((milestone) => (
              <g key={milestone.miles}>
                <circle 
                  cx={milestone.position.x} 
                  cy={milestone.position.y} 
                  r="2" 
                  fill="currentColor" 
                  className="text-text-muted milestone-marker"
                />
                <text 
                  x={milestone.position.x} 
                  y={milestone.position.y - 8} 
                  fontSize="8" 
                  textAnchor="middle" 
                  fill="currentColor" 
                  className="text-text-muted milestone-text"
                >
                  {milestone.miles}
                </text>
              </g>
            ))}
            
            {/* User position marker - real data with animation */}
            <circle 
              cx={userPosition.x} 
              cy={userPosition.y} 
              r={isComplete ? "5" : "4"} 
              fill={isComplete ? "#10b981" : "#ff6b35"} 
              className="user-position" 
              stroke={isComplete ? "#065f46" : "#dc2626"}
              strokeWidth="1"
            />
            
            {/* User pulse animation */}
            <circle 
              cx={userPosition.x} 
              cy={userPosition.y} 
              r={isComplete ? "8" : "7"} 
              fill="none" 
              stroke={isComplete ? "#10b981" : "#ff6b35"} 
              strokeWidth="1.5"
              className="user-pulse"
            />
            
            {/* Bot position markers - placeholder for now */}
            <circle cx="120" cy="155" r="3" fill="#6b7280" className="bot-position" />
            <circle cx="200" cy="175" r="3" fill="#6b7280" className="bot-position" />
            <circle cx="280" cy="185" r="3" fill="#6b7280" className="bot-position" />
            <circle cx="250" cy="165" r="3" fill="#6b7280" className="bot-position" />
            
            {/* User completion indicator */}
            {isComplete && (
              <circle 
                cx={userPosition.x} 
                cy={userPosition.y} 
                r="12" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="2"
                className="completion-celebration"
              />
            )}
            
            {/* Start/Finish line marker */}
            <line 
              x1="53" y1="142" x2="57" y2="148" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="text-text-primary"
            />
            <text x="40" y="140" fontSize="10" fill="currentColor" className="text-text-secondary">START</text>
          </svg>
        </div>
      </div>

      {/* Progress bar visual */}
      <div className="league-progress-bar">
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${Math.min(100, mapPosition)}%` }}
          ></div>
        </div>
        <div className="progress-bar-labels">
          <span className="text-xs text-text-muted">0 mi</span>
          <span className="text-xs text-text-muted">1000 mi</span>
        </div>
      </div>
      
      <div className="league-map-progress">
        <div className="progress-info">
          {isComplete ? (
            <div className="text-center">
              <p className="text-green-500 font-medium mb-1">🎉 Course Complete! 🎉</p>
              <p className="text-sm text-text-secondary">
                Final Distance: <span className="text-text-primary font-medium">{formatDistance(totalDistance)} miles</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Your Progress: <span className="text-text-primary font-medium">{formatDistance(totalDistance)} miles</span> • 
              Remaining: <span className="text-text-primary font-medium">{formatDistance(milesRemaining)} miles</span>
              {mapPosition > 0 && <span className="text-primary font-medium"> • {formatDistance(mapPosition)}% complete</span>}
            </p>
          )}
          
          {qualifyingRuns.length > 0 && (
            <p className="text-xs text-text-muted mt-1">
              Based on {qualifyingRuns.length} run{qualifyingRuns.length !== 1 ? 's' : ''}
              {qualifyingRuns.length > 0 && ` • Latest: ${new Date(qualifyingRuns[0].timestamp * 1000).toLocaleDateString()}`}
            </p>
          )}
          
          {totalDistance === 0 && (
            <div className="text-center">
              <p className="text-sm text-text-secondary mb-2">
                Start your first run to begin the League challenge!
              </p>
              <p className="text-xs text-text-muted">
                All runs count toward your 1000-mile journey
              </p>
            </div>
          )}
        </div>
      </div>

      {/* League Leaderboard */}
      <div className="league-leaderboard">
        <div className="leaderboard-header">
          <h3 className="text-lg font-semibold text-text-primary mb-3">🏆 League Standings</h3>
        </div>
        
        {leaderboardLoading ? (
          <div className="leaderboard-loading">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="text-text-secondary text-sm mt-2">Loading standings...</p>
          </div>
        ) : leaderboardError ? (
          <div className="leaderboard-error">
            <p className="text-red-400 text-sm mb-2">Error loading leaderboard</p>
            <button 
              onClick={refreshLeaderboard}
              className="px-3 py-1 bg-primary hover:bg-primary-hover text-text-primary text-xs rounded-md transition-colors duration-normal"
            >
              Retry
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            <p className="text-text-secondary text-sm">
              No runners found yet. Be the first to start the challenge!
            </p>
          </div>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((user, index) => (
              <div key={user.pubkey} className="leaderboard-item">
                <div className="leaderboard-rank">
                  <span className="rank-number">{user.rank}</span>
                </div>
                <div className="leaderboard-info">
                  <div className="user-name">
                    {user.fallbackName}
                  </div>
                  <div className="user-progress">
                    <span className="distance">{formatDistance(user.totalMiles)} miles</span>
                    <span className="percentage">({formatDistance(user.percentComplete)}% complete)</span>
                  </div>
                </div>
                <div className="leaderboard-stats">
                  <span className="run-count">{user.runCount} runs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced styles with animations
const styles = `
.league-map-container {
  @apply bg-bg-primary border-b border-border-secondary p-4 mb-4;
}

.league-map-loading {
  @apply flex flex-col justify-center items-center h-48;
}

.league-map-error {
  @apply flex flex-col justify-center items-center h-48;
}

.league-map-header {
  @apply text-center mb-4;
}

.league-map-course {
  @apply flex justify-center mb-4;
}

.course-outline-container {
  @apply w-full max-w-md;
}

.course-outline {
  @apply transition-colors duration-300;
}

.course-detail {
  @apply opacity-80;
}

.league-map-progress {
  @apply text-center;
}

.user-position {
  @apply drop-shadow-sm transition-all duration-500;
}

.bot-position {
  @apply opacity-70;
}

.milestone-marker {
  @apply opacity-60;
}

.milestone-text {
  @apply opacity-70;
}

/* Progress bar styles */
.league-progress-bar {
  @apply mb-4;
}

.progress-bar-container {
  @apply w-full h-2 bg-bg-tertiary rounded-full relative overflow-hidden;
}

.progress-bar-fill {
  @apply h-full bg-primary rounded-full transition-all duration-700 ease-out;
}

.progress-bar-labels {
  @apply flex justify-between mt-1;
}

/* Loading animation with dots */
.loading-dots {
  @apply flex space-x-1;
}

.loading-dots span {
  @apply w-2 h-2 bg-text-secondary rounded-full;
  animation: loading-bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes loading-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* User position pulse animation */
.user-pulse {
  animation: user-pulse 2s infinite;
}

@keyframes user-pulse {
  0% {
    opacity: 1;
    transform: scale(0.95);
  }
  70% {
    opacity: 0.3;
    transform: scale(1.1);
  }
  100% {
    opacity: 0;
    transform: scale(1.2);
  }
}

/* Completion celebration animation */
.completion-celebration {
  animation: celebrate 1.5s infinite;
}

@keyframes celebrate {
  0%, 100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.1);
  }
}
`;

// Note: These styles will be moved to a separate CSS file in Phase 4 