import { useState, useEffect, useMemo } from 'react';
import { RELAYS } from '../utils/nostr';
import { SimplePool } from 'nostr-tools';

export const Achievements = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const pool = useMemo(() => new SimplePool(), []);

  useEffect(() => {
    const fetchRunHistory = async () => {
      if (!window.nostr) return;

      try {
        const pubkey = await window.nostr.getPublicKey();
        const runs = await pool.list(RELAYS, [{
          kinds: [1],
          authors: [pubkey],
          '#t': ['Runstr']
        }]);

        // Process runs to extract distance and time information
        const processedRuns = runs.map(run => {
          const content = run.content;
          const distanceMatch = content.match(/Distance: ([\d.]+) km/);
          const durationMatch = content.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
          
          return {
            date: run.created_at,
            distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
            duration: durationMatch ? 
              parseInt(durationMatch[1]) * 3600 + 
              parseInt(durationMatch[2]) * 60 + 
              parseInt(durationMatch[3]) : 0
          };
        });

        // Calculate achievements
        const firstRun = processedRuns.sort((a, b) => a.date - b.date)[0];
        const longestRun = processedRuns.sort((a, b) => b.distance - a.distance)[0];
        const fastestRun = processedRuns
          .filter(run => run.distance > 0 && run.duration > 0)
          .sort((a, b) => (a.duration / a.distance) - (b.duration / a.distance))[0];

        setAchievements({ firstRun, longestRun, fastestRun });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching run history:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchRunHistory();
  }, [pool]);

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <>
          <h2>Achievements</h2>
          <p>Your running milestones and badges</p>
          {achievements && (
            <div>
              {achievements.firstRun && (
                <p>First Run: {new Date(achievements.firstRun.date * 1000).toLocaleDateString()}</p>
              )}
              {achievements.longestRun && (
                <p>Longest Run: {achievements.longestRun.distance} km</p>
              )}
              {achievements.fastestRun && (
                <p>Fastest Run: {(achievements.fastestRun.duration / achievements.fastestRun.distance / 60).toFixed(2)} min/km</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}; 