import { useSettings } from '../contexts/SettingsContext';
import { useNostrRunStats } from '../hooks/useNostrRunStats';
import { Button } from "@/components/ui/button";

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

const NostrStatsPage = () => {
  const { distanceUnit } = useSettings(); // eslint-disable-line no-unused-vars
  const { workoutEvents, stats, isLoading, error, reload } = useNostrRunStats();

  if (isLoading) return <p className="p-4 text-text-primary">Loading…</p>;
  if (error) return <p className="p-4 text-error">Error: {error}</p>;

  return (
    <div className="p-4 space-y-6 bg-bg-primary min-h-screen">
      <h2 className="page-title">Nostr Workout Stats</h2>
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

      <h3 className="section-heading mt-6">Recent Workouts</h3>
      <Button onClick={reload} variant="ghost" size="sm">Reload</Button>
      <ul className="space-y-3">
        {workoutEvents.map(ev => (
          <li key={ev.id} className="bg-bg-secondary border border-border-secondary p-3 rounded-md text-sm text-text-primary">
            <div className="flex justify-between">
              <span>{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
              <span className="text-text-secondary">{metricString(ev)}</span>
            </div>
            {renderAssociations(ev)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NostrStatsPage; 