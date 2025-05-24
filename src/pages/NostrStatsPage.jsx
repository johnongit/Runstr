import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { fetchEvents } from '../utils/nostr'; // Assuming fetchEvents can get kind 1301

const NostrStatsPage = () => {
  const { healthEncryptionPref } = useSettings();
  const [workoutEvents, setWorkoutEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadWorkoutEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Get current user's pubkey
      const userPubkey = localStorage.getItem('userPublicKey'); 
      if (!userPubkey) {
        setError('User public key not found. Please log in.');
        setIsLoading(false);
        return;
      }

      const filter = {
        kinds: [1301], // NIP-101e workout records
        authors: [userPubkey],
        limit: 50, // Adjust as needed
      };
      const events = await fetchEvents(filter);
      // NDKEvent objects need to be converted to plain objects for state
      const plainEvents = Array.from(events).map(event => event.rawEvent()); 
      setWorkoutEvents(plainEvents.sort((a, b) => b.created_at - a.created_at));
    } catch (err) {
      console.error('Error fetching NIP-101e events:', err);
      setError('Failed to load workout events from Nostr.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadWorkoutEvents();
  }, []);

  return (
    <div className="nostr-stats-page p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Nostr Workout Records (Kind 1301)</h2>
        <button
          onClick={loadWorkoutEvents}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-red-500 bg-red-900/20 p-3 rounded">{error}</p>}

      {isLoading && workoutEvents.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading events from Nostr...</p>
        </div>
      )}

      {!isLoading && workoutEvents.length === 0 && !error && (
        <p className="text-center py-8">No NIP-101e workout events found for your key.</p>
      )}

      {workoutEvents.length > 0 && (
        <ul className="space-y-3">
          {workoutEvents.map(event => (
            <li key={event.id} className="bg-gray-800 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-400">ID: {event.id.substring(0, 10)}...</p>
              <p className="text-lg font-semibold">
                {event.tags.find(t => t[0] === 'workout')?.[1] || 'Workout'}
              </p>
              <p className="text-gray-300">
                Date: {new Date(event.created_at * 1000).toLocaleString()}
              </p>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300">View Raw Data</summary>
                <pre className="bg-gray-900 p-2 mt-1 rounded overflow-x-auto">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-gray-500">
        Encryption preference: {healthEncryptionPref}. Note: This page currently displays raw event data. Decryption of content for private events is not yet implemented here.
      </p>
    </div>
  );
};

export default NostrStatsPage; 