import { useState, useEffect } from 'react';
import { getEventLeaderboard } from '../services/EventService';

const EventLeaderboard = ({ eventId, userProfiles = new Map() }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  
  useEffect(() => {
    const data = getEventLeaderboard(eventId);
    setLeaderboard(data);
  }, [eventId]);
  
  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-4">
        <p>No participants yet. Be the first to register and run!</p>
      </div>
    );
  }
  
  // Helper to format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 text-left">Rank</th>
            <th className="px-4 py-2 text-left">Runner</th>
            <th className="px-4 py-2 text-right">Time</th>
            <th className="px-4 py-2 text-right">Pace</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((run, index) => {
            const profile = userProfiles.get(run.pubkey) || {};
            const displayName = profile.name || profile.display_name || 'Anonymous Runner';
            
            // Calculate pace (minutes per km or mile)
            const paceMinPerKm = (run.duration / 60) / (run.distance / 1000);
            
            return (
              <tr 
                key={index} 
                className={`${index < 3 ? 'font-medium' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <td className="px-4 py-2">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && index + 1}
                </td>
                <td className="px-4 py-2">
                  {displayName}
                </td>
                <td className="px-4 py-2 text-right">
                  {formatTime(run.duration)}
                </td>
                <td className="px-4 py-2 text-right">
                  {paceMinPerKm.toFixed(2)} min/km
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default EventLeaderboard; 