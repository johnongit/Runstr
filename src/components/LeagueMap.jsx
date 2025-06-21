import { useState, useEffect } from 'react';

export const LeagueMap = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="league-map-container">
        <div className="league-map-loading">
          <p className="text-text-secondary">Loading League Map...</p>
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
        {/* Placeholder for course outline */}
        <div className="course-outline-placeholder">
          <svg 
            viewBox="0 0 400 250" 
            className="w-full h-48 border border-border-secondary rounded-lg bg-bg-secondary"
            style={{ maxWidth: '400px', height: '200px' }}
          >
            {/* Simple placeholder outline - will be replaced with Virginia-state-like shape */}
            <path
              d="M50 80 L120 60 L180 70 L250 50 L320 65 L350 90 L340 130 L310 160 L270 180 L220 190 L170 185 L120 175 L80 150 L60 120 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-primary"
            />
            
            {/* Placeholder position dots */}
            <circle cx="150" cy="140" r="4" fill="#ff6b35" className="user-position" />
            <circle cx="120" cy="160" r="3" fill="#666" className="bot-position" />
            <circle cx="180" cy="120" r="3" fill="#666" className="bot-position" />
            <circle cx="200" cy="150" r="3" fill="#666" className="bot-position" />
          </svg>
        </div>
      </div>
      
      <div className="league-map-progress">
        <div className="progress-info">
          <p className="text-sm text-text-secondary">
            Your Progress: <span className="text-text-primary font-medium">247 miles</span> • 
            Position: <span className="text-text-primary font-medium">#3 of 12</span>
          </p>
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

.league-map-header {
  @apply text-center mb-4;
}

.league-map-course {
  @apply flex justify-center mb-4;
}

.course-outline-placeholder {
  @apply w-full max-w-md;
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