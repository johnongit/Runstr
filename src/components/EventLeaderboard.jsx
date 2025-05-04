import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  
  // Get medal icon based on position
  const getMedalIcon = (position) => {
    switch (position) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '';
    }
  };
  
  return (
    <div className="overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="bg-indigo-900/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-300 uppercase tracking-wider">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-300 uppercase tracking-wider">Runner</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-300 uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-300 uppercase tracking-wider">Pace</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {leaderboard.map((entry, index) => {
            const profileInfo = userProfiles.get(entry.pubkey) || {};
            const displayName = profileInfo.name || entry.pubkey.slice(0, 8) + '...';
            
            return (
              <tr 
                key={entry.pubkey} 
                className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">{getMedalIcon(index)}</span>
                    <span className="font-medium text-white">{index + 1}</span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-indigo-200">
                  {displayName}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-indigo-200">
                  {formatTime(entry.time)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-indigo-200">
                  {entry.pace}/km
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

EventLeaderboard.propTypes = {
  eventId: PropTypes.string.isRequired,
  userProfiles: PropTypes.instanceOf(Map)
};

export default EventLeaderboard; 