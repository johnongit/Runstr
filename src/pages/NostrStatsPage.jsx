import { useState, useEffect, useContext } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { fetchEvents } from '../utils/nostr'; // Assuming fetchEvents can get kind 1301
import { NostrContext } from '../contexts/NostrContext'; // Import NostrContext
import { displayDistance, formatTime, formatElevation } from '../utils/formatters'; // Import formatters

// Helper to extract a specific tag value
const getTagValue = (tags, tagName) => tags.find(t => t[0] === tagName)?.[1];
const getTagValues = (tags, tagName) => tags.filter(t => t[0] === tagName).map(t => t.slice(1));

const NostrStatsPage = () => {
  const { healthEncryptionPref, distanceUnit } = useSettings();
  const { publicKey: userPubkey } = useContext(NostrContext); // Get pubkey from NostrContext
  const [workoutEvents, setWorkoutEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // State to hold fetched NIP-101h metrics for each workout event
  const [detailedMetrics, setDetailedMetrics] = useState({}); // E.g. { [eventId]: { pace: {...}, distance: {...} } }
  const [loadingDetailsFor, setLoadingDetailsFor] = useState(null); // event.id of workout being loaded

  const loadWorkoutEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // userPubkey is now from NostrContext
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
      const plainEvents = Array.from(events).map(event => event.rawEvent());

      // Deduplication logic
      const uniqueEvents = [];
      const seenSignatures = new Set();
      const TIME_WINDOW_MINUTES = 10; // Deduplication window

      // Sort by created_at descending to process newest first for de-duplication context
      plainEvents.sort((a, b) => b.created_at - a.created_at);

      for (const event of plainEvents) {
        const workoutName = getTagValue(event.tags, 'workout') || '';
        const distanceTag = getTagValues(event.tags, 'distance');
        const distanceVal = distanceTag[0] && distanceTag[1] ? `${distanceTag[0]} ${distanceTag[1]}` : '';
        const durationVal = getTagValue(event.tags, 'duration') || '';
        
        // Rounded timestamp (e.g., to the nearest 10 minutes)
        const roundedTimestamp = Math.floor(event.created_at / (TIME_WINDOW_MINUTES * 60));
        
        const signature = `${workoutName}_${distanceVal}_${durationVal}_${roundedTimestamp}`;
        
        if (!seenSignatures.has(signature)) {
          seenSignatures.add(signature);
          uniqueEvents.push(event);
        }
      }
      // Now sort again for display (newest first if not already)
      setWorkoutEvents(uniqueEvents.sort((a,b) => b.created_at - a.created_at)); 

    } catch (err) {
      console.error('Error fetching NIP-101e events:', err);
      setError('Failed to load workout events from Nostr.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (userPubkey) { // Only load if pubkey is available
      loadWorkoutEvents();
    }
  }, [userPubkey]); // Re-run if userPubkey changes (e.g., after login)

  // Function to fetch and store NIP-101h metrics for a given Kind 1301 event ID
  const loadDetailedMetricsForWorkout = async (workoutEventId) => {
    if (!userPubkey || !workoutEventId) return;
    setLoadingDetailsFor(workoutEventId);
    try {
      const metricKinds = [1356, 1357, 1358, 1359, 1360, 1361, 1362]; // NIP-101h kinds
      const filter = {
        kinds: metricKinds,
        authors: [userPubkey],
        '#e': [workoutEventId],
        // limit: 100, // Or some reasonable limit per workout
      };
      const metricEventsRaw = await fetchEvents(filter);
      const plainMetricEvents = Array.from(metricEventsRaw).map(event => event.rawEvent());
      
      const metrics = {};
      plainMetricEvents.forEach(mEvent => {
        switch (mEvent.kind) {
          case 1356: metrics.intensity = mEvent; break;
          case 1357: metrics.calories = mEvent; break;
          case 1358: metrics.durationMetric = mEvent; break; // Renamed to avoid clash with 1301 duration tag
          case 1359: metrics.distanceMetric = mEvent; break;
          case 1360: metrics.paceMetric = mEvent; break;
          case 1361: metrics.elevationMetric = mEvent; break;
          case 1362: 
            if (!metrics.splits) metrics.splits = [];
            metrics.splits.push(mEvent);
            break;
          default: break;
        }
      });
      if (metrics.splits) {
        metrics.splits.sort((a,b) => parseInt(getTagValue(a.tags, 'split_index') || '0') - parseInt(getTagValue(b.tags, 'split_index') || '0'));
      }

      setDetailedMetrics(prev => ({ ...prev, [workoutEventId]: metrics }));
    } catch (err) {
      console.error(`Error fetching NIP-101h metrics for workout ${workoutEventId}:`, err);
      // Optionally set an error state for this specific workout
    } finally {
      setLoadingDetailsFor(null);
    }
  };

  // Helper to render individual metric
  const renderMetric = (label, value, unit = '') => {
    if (value === undefined || value === null) return null;
    return <p className="text-sm"><span className="font-semibold">{label}:</span> {value} {unit}</p>;
  };

  return (
    <div className="nostr-stats-page p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Nostr Workout Record</h2>
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
          {workoutEvents.map(event => {
            const workoutNameTag = getTagValue(event.tags, 'workout');
            const distanceTagValues = getTagValues(event.tags, 'distance'); // Will be [ [<value>, <unit>] ] or []
            const durationTagVal = getTagValue(event.tags, 'duration');
            const elevationGainTagValues = getTagValues(event.tags, 'elevation_gain'); // Similar to distance
            const sourceTag = getTagValue(event.tags, 'source');

            const workoutName = workoutNameTag || 'Workout'; // Fallback if no name
            
            let distVal = 'N/A';
            if (distanceTagValues.length > 0 && distanceTagValues[0].length >= 2) {
              distVal = `${distanceTagValues[0][0]} ${distanceTagValues[0][1]}`;
            }

            let elevVal = 'N/A';
            if (elevationGainTagValues.length > 0 && elevationGainTagValues[0].length >= 2) {
              elevVal = `${elevationGainTagValues[0][0]} ${elevationGainTagValues[0][1]}`;
            }

            const workoutDate = new Date(event.created_at * 1000).toLocaleString();
            const workoutContent = event.content;

            const currentDetailedMets = detailedMetrics[event.id];

            return (
              <li key={event.id} className="bg-gray-800 p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    {/* <p className="text-sm text-gray-400">ID: {event.id.substring(0, 10)}... (Kind 1301)</p> */}
                    <p className="text-lg font-semibold">{workoutName}</p>
                    <p className="text-gray-300">Date: {workoutDate}</p>
                  </div>
                  {/* Action buttons can go here later if needed (re-publish, etc.) */}
                </div>
                
                {/* Display summary from Kind 1301 tags */}
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <h4 className="font-semibold text-md mb-1">Workout Summary:</h4>
                  {renderMetric('Distance', distVal)}
                  {renderMetric('Duration', durationTagVal)}
                  {renderMetric('Elevation Gain', elevVal)}
                  {sourceTag && renderMetric('Source', sourceTag)}
                  {workoutContent && <p className="text-sm mt-1"><span className="font-semibold">Notes:</span> {workoutContent}</p>}
                </div>

                <details className="mt-3 text-sm" onToggle={(e) => {
                  if (e.target.open && !detailedMetrics[event.id] && loadingDetailsFor !== event.id) {
                    loadDetailedMetricsForWorkout(event.id);
                  }
                }}>
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold">
                    {loadingDetailsFor === event.id ? 'Loading Detailed Metrics...' : 'View Detailed Metrics'}
                  </summary>
                  {loadingDetailsFor === event.id && (
                     <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 my-2"></div>
                  )}
                  {currentDetailedMets && (
                    <div className="mt-2 pl-4 border-l-2 border-gray-700 space-y-1">
                      {currentDetailedMets.distanceMetric && renderMetric('Total Distance', currentDetailedMets.distanceMetric.content, getTagValue(currentDetailedMets.distanceMetric.tags, 'unit'))}
                      {currentDetailedMets.paceMetric && renderMetric('Average Pace', currentDetailedMets.paceMetric.content, getTagValue(currentDetailedMets.paceMetric.tags, 'unit'))}
                      {currentDetailedMets.elevationMetric && renderMetric('Total Elevation', currentDetailedMets.elevationMetric.content, getTagValue(currentDetailedMets.elevationMetric.tags, 'unit'))}
                      {currentDetailedMets.durationMetric && renderMetric('Total Duration', currentDetailedMets.durationMetric.content, getTagValue(currentDetailedMets.durationMetric.tags, 'unit'))}
                      {currentDetailedMets.calories && renderMetric('Calories Burned', currentDetailedMets.calories.content, getTagValue(currentDetailedMets.calories.tags, 'unit'))}
                      {currentDetailedMets.intensity && renderMetric('Intensity', `${currentDetailedMets.intensity.content}`)}
                      {currentDetailedMets.splits && currentDetailedMets.splits.length > 0 && (
                        <div className="mt-1">
                          <p className="font-semibold">Splits:</p>
                          <ul className="list-disc list-inside pl-2 text-xs">
                            {currentDetailedMets.splits.map(splitE => (
                              <li key={splitE.id}>
                                Split {getTagValue(splitE.tags, 'split_index')}: {splitE.content}s ({getTagValue(splitE.tags, 'unit')})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!(currentDetailedMets.distanceMetric || currentDetailedMets.paceMetric || currentDetailedMets.elevationMetric || currentDetailedMets.durationMetric || currentDetailedMets.calories || currentDetailedMets.intensity || (currentDetailedMets.splits && currentDetailedMets.splits.length > 0)) &&
                        <p className="text-gray-400 italic">No detailed NIP-101h metrics found for this workout.</p>
                      }
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-gray-500">
        Encryption preference: {healthEncryptionPref}. Note: This page currently displays raw event data. Decryption of content for private events is not yet implemented here.
      </p>
    </div>
  );
};

export default NostrStatsPage; 