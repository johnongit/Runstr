import { useSettings } from '../contexts/SettingsContext';
import { useNostrRunStats } from '../hooks/useNostrRunStats';

const Stat = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-gray-400">{label}</span>
    <span className="text-sm font-semibold text-gray-100">{value}</span>
  </div>
);

const formatDuration = (secs = 0) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
};

const renderAssociations = (event) => {
  const parts = [];
  const teamTag = event.tags?.find(t => t[0] === 'team');
  if (teamTag) parts.push(`Team: ${teamTag[3] || 'Unnamed'}`);
  const challengeTag = event.tags?.find(t => t[0] === 'challenge');
  if (challengeTag) parts.push(`Challenge: ${challengeTag[3] || 'Unnamed'}`);
  return parts.length ? <p className="text-xs text-emerald-400 mt-1">{parts.join(' • ')}</p> : null;
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

  if (isLoading) return <p className="p-4">Loading…</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Your Nostr Stats</h2>
      {stats ? (
        <div className="grid grid-cols-2 gap-4 bg-gray-800 p-4 rounded-lg text-sm">
          <Stat label="Runs" value={stats.totalRuns} />
          <Stat label="Distance" value={`${stats.totalDistanceKm.toFixed(2)} km`} />
          <Stat label="Duration" value={formatDuration(stats.totalDurationSeconds)} />
          <Stat label="Elev Gain" value={`${stats.elevationGain.toFixed(0)} m`} />
        </div>
      ) : <p>No workouts on Nostr yet.</p>}

      <h3 className="text-lg font-semibold mt-6">Recent Workouts</h3>
      <button onClick={reload} className="text-xs text-blue-400 mb-2">Reload</button>
      <ul className="space-y-3">
        {workoutEvents.map(ev => (
          <li key={ev.id} className="bg-gray-900 border border-gray-700 p-3 rounded-md text-sm text-gray-200">
            <div className="flex justify-between">
              <span>{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
              <span>{metricString(ev)}</span>
            </div>
            {renderAssociations(ev)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NostrStatsPage; 