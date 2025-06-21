import { useState, useEffect } from 'react';
import { useLeaguePosition } from '../hooks/useLeaguePosition';

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

  useEffect(() => {
    // Simulate initial loading for UI polish
    const timer = setTimeout(() => setIsInitialLoad(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Calculate user position on course path based on progress percentage
  const calculateUserPosition = (progressPercentage) => {
    // Course path coordinates - simplified version of the main course outline
    // Position along the course from start (60,140) to end based on percentage
    const startX = 60, startY = 140;
    const pathPoints = [
      { x: 60, y: 140 },   // Start (0%)
      { x: 100, y: 130 },  // ~20%
      { x: 140, y: 135 },  // ~25%
      { x: 200, y: 140 },  // ~40%
      { x: 240, y: 145 },  // ~50%
      { x: 300, y: 155 },  // ~70%
      { x: 330, y: 160 },  // ~80%
      { x: 360, y: 185 },  // ~90%
      { x: 355, y: 225 },  // Finish (100%)
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

  const userPosition = calculateUserPosition(mapPosition);

  if (isInitialLoad || positionLoading) {
    return (
      <div className="league-map-container">
        <div className="league-map-loading">
          <p className="text-text-secondary">
            {isInitialLoad ? 'Loading League Map...' : 'Calculating position...'}
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
        {/* Virginia-state-like course outline */}
        <div className="course-outline-container">
          <svg 
            viewBox="0 0 400 250" 
            className="w-full h-48 border border-border-secondary rounded-lg bg-bg-secondary"
            style={{ maxWidth: '400px', height: '200px' }}
          >
            {/* Course background */}
            <rect x="0" y="0" width="400" height="250" fill="transparent" />
            
            {/* Virginia-inspired course outline */}
            <path
              d="M 60 140 
                 C 70 130, 85 125, 100 130
                 L 140 135
                 C 160 138, 180 135, 200 140
                 L 240 145
                 C 260 148, 280 150, 300 155
                 L 330 160
                 C 345 165, 355 175, 360 185
                 L 365 200
                 C 370 210, 365 220, 355 225
                 L 340 230
                 C 320 235, 300 232, 280 228
                 L 240 220
                 C 220 216, 200 210, 180 205
                 L 140 195
                 C 120 190, 100 185, 85 175
                 L 70 165
                 C 60 158, 55 150, 58 142
                 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-primary course-outline"
            />
            
            {/* Eastern peninsula detail (like Chesapeake Bay area) */}
            <path
              d="M 320 160 C 330 150, 340 155, 345 165 C 350 170, 345 175, 340 172 L 330 168"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-text-primary course-detail"
            />
            
            {/* Western extension (like Virginia's panhandle) */}
            <path
              d="M 85 150 C 75 145, 70 140, 75 135 C 80 132, 85 135, 82 145"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-text-primary course-detail"
            />
            
            {/* User position marker - real data */}
            <circle 
              cx={userPosition.x} 
              cy={userPosition.y} 
              r={isComplete ? "5" : "4"} 
              fill={isComplete ? "#10b981" : "#ff6b35"} 
              className="user-position drop-shadow-sm" 
              stroke={isComplete ? "#065f46" : "#dc2626"}
              strokeWidth="1"
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
                r="8" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="2"
                className="animate-pulse"
              />
            )}
            
            {/* Start/Finish line marker */}
            <line 
              x1="58" y1="138" x2="62" y2="142" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="text-text-primary"
            />
            <text x="45" y="135" fontSize="10" fill="currentColor" className="text-text-secondary">START</text>
            
            {/* Distance markers every ~200 miles */}
            <circle cx="140" cy="160" r="1.5" fill="currentColor" className="text-text-muted" />
            <circle cx="220" cy="175" r="1.5" fill="currentColor" className="text-text-muted" />
            <circle cx="310" cy="190" r="1.5" fill="currentColor" className="text-text-muted" />
            <circle cx="350" cy="205" r="1.5" fill="currentColor" className="text-text-muted" />
          </svg>
        </div>
      </div>
      
      <div className="league-map-progress">
        <div className="progress-info">
          {isComplete ? (
            <div className="text-center">
              <p className="text-green-500 font-medium mb-1">🎉 Course Complete! 🎉</p>
              <p className="text-sm text-text-secondary">
                Final Distance: <span className="text-text-primary font-medium">{totalDistance.toFixed(1)} miles</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Your Progress: <span className="text-text-primary font-medium">{totalDistance.toFixed(1)} miles</span> • 
              Remaining: <span className="text-text-primary font-medium">{milesRemaining.toFixed(1)} miles</span> • 
              {mapPosition > 0 && <span className="text-primary font-medium">{mapPosition.toFixed(1)}% complete</span>}
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
    </div>
  );
};

// Basic styles - will be enhanced in Phase 4
const styles = `
.league-map-container {
  @apply bg-bg-primary border-b border-border-secondary p-4 mb-4;
}

.league-map-loading {
  @apply flex justify-center items-center h-48;
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
  @apply drop-shadow-sm;
}

.bot-position {
  @apply opacity-70;
}
`;

// Note: These styles will be moved to a separate CSS file in Phase 4 