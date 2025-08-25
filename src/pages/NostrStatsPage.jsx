import { useSettings } from '../contexts/SettingsContext';
import { useNostrRunStats } from '../hooks/useNostrRunStats';
import { useNostr } from '../hooks/useNostr';
import LevelSystemHeader from '../components/LevelSystemHeader';
import { useState, useMemo } from 'react';

const Stat = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-text-muted">{label}</span>
    <span className="text-sm font-semibold text-text-primary">{value}</span>
  </div>
);

const formatDuration = (secs = 0) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
};

const formatPersonalBest = (pb) => {
  if (!pb) return 'N/A';
  return formatDuration(pb.time);
};

const renderAssociations = (event) => {
  const parts = [];
  const teamTag = event.tags?.find(t => t[0] === 'team');
  if (teamTag) parts.push(`Team: ${teamTag[3] || 'Unnamed'}`);
  const challengeTag = event.tags?.find(t => t[0] === 'challenge');
  if (challengeTag) parts.push(`Challenge: ${challengeTag[3] || 'Unnamed'}`);
  return parts.length ? <p className="text-xs text-success mt-1">{parts.join(' • ')}</p> : null;
};

const metricString = (event) => {
  const distTag = event.tags?.find(t => t[0] === 'distance');
  const durTag = event.tags?.find(t => t[0] === 'duration');
  if (!distTag || !durTag) return '';
  const dist = `${parseFloat(distTag[1]).toFixed(2)} ${distTag[2] || 'km'}`;
  return `${dist} • ${durTag[1]}`;
};

const groupWorkoutsByMonth = (events) => {
  const grouped = {};
  
  events.forEach(event => {
    const date = new Date(event.created_at * 1000);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (!grouped[monthYear]) {
      grouped[monthYear] = {
        monthName,
        events: []
      };
    }
    
    grouped[monthYear].events.push(event);
  });
  
  // Sort by month/year (newest first)
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value }));
};

const NostrStatsContent = ({ pubkey }) => {
  const { distanceUnit } = useSettings(); // eslint-disable-line no-unused-vars
  const { workoutEvents, stats, isLoading, error } = useNostrRunStats(pubkey);
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  const groupedWorkouts = useMemo(() => {
    return groupWorkoutsByMonth(workoutEvents);
  }, [workoutEvents]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  if (isLoading) return <p className="p-4 text-text-primary">Loading…</p>;
  if (error) return <p className="p-4 text-error">Error: {error}</p>;

  return (
    <div className="p-4 space-y-6 bg-bg-primary min-h-screen">
      {/* Level System Header */}
      {stats?.levelData && (
        <LevelSystemHeader levelData={stats.levelData} />
      )}

      {stats ? (
        <div className="space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-2 gap-4 bg-bg-secondary p-4 rounded-lg text-sm border border-border-secondary">
            <Stat label="Runs" value={stats.totalRuns} />
            <Stat label="Distance" value={`${stats.totalDistanceKm.toFixed(2)} km`} />
            <Stat label="Duration" value={formatDuration(stats.totalDurationSeconds)} />
            <Stat label="Elev Gain" value={`${stats.elevationGain.toFixed(0)} m`} />
          </div>

          {/* Personal Bests */}
          <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
            <h3 className="subsection-heading mb-3">Personal Bests</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="1K Best" value={formatPersonalBest(stats.personalBests['1k'])} />
              <Stat label="5K Best" value={formatPersonalBest(stats.personalBests['5k'])} />
              <Stat label="10K Best" value={formatPersonalBest(stats.personalBests['10k'])} />
            </div>
          </div>

          {/* Streak */}
          <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
            <h3 className="subsection-heading mb-3">Activity Streak</h3>
            <div className="text-sm">
              <Stat label="Longest Streak" value={`${stats.longestStreak} days`} />
            </div>
          </div>
        </div>
      ) : <p className="text-text-secondary">No workouts on Nostr yet.</p>}

      {/* Monthly Workout History */}
      <div className="space-y-3">
        {groupedWorkouts.map(({ key, monthName, events }) => (
          <div key={key} className="bg-bg-secondary border border-border-secondary rounded-lg">
            {/* Month Header */}
            <button
              onClick={() => toggleMonth(key)}
              className="w-full p-4 text-left flex justify-between items-center hover:bg-bg-tertiary transition-colors"
            >
              <h3 className="font-semibold text-text-primary">
                {monthName} Activity ({events.length} workout{events.length !== 1 ? 's' : ''})
              </h3>
              <span className="text-text-secondary">
                {expandedMonths.has(key) ? '▼' : '▶'}
              </span>
            </button>
            
            {/* Month Content */}
            {expandedMonths.has(key) && (
              <div className="border-t border-border-secondary">
                <ul className="space-y-2 p-4">
                  {events.map(ev => (
                    <li key={ev.id} className="bg-bg-primary border border-border-tertiary p-3 rounded-md text-sm text-text-primary">
                      <div className="flex justify-between">
                        <span>{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                        <span className="text-text-secondary">{metricString(ev)}</span>
                      </div>
                      {renderAssociations(ev)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const NostrStatsPage = () => {
  const { publicKey } = useNostr();
  if (!publicKey) return <p className="p-4 text-text-primary">Veuillez connecter votre clé Nostr.</p>;
  return <NostrStatsContent pubkey={publicKey} />;
};

export default NostrStatsPage;
