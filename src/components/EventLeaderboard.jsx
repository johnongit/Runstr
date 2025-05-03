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
  
  // Helper to get medal emoji based on position
  const getMedalIcon = (position) => {
    switch(position) {
      case 0: return <span className="text-yellow-500 text-xl mr-2" title="1st Place">🥇</span>;
      case 1: return <span className="text-gray-400 text-xl mr-2" title="2nd Place">🥈</span>;
      case 2: return <span className="text-amber-600 text-xl mr-2" title="3rd Place">🥉</span>;
      default: return <span className="w-6 inline-block"></span>;
    }
  };
  
  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header grid grid-cols-6 py-2 px-4 bg-gray-100 text-gray-600 font-medium text-sm">
        <div className="col-span-1">Rank</div>
        <div className="col-span-2">Runner</div>
        <div className="col-span-1">Distance</div>
        <div className="col-span-1">Time</div>
        <div className="col-span-1">Pace</div>
      </div>
      
      <div className="leaderboard-entries">
        {leaderboard.map((entry, index) => {
          const pace = entry.duration / (entry.distance / 1000 / 60); // min/km
          const paceMin = Math.floor(pace);
          const paceSec = Math.floor((pace - paceMin) * 60);
          
          // Get profile info if available
          const profile = userProfiles.get(entry.pubkey) || { 
            displayName: `Runner ${index + 1}`,
            avatar: null 
          };
          
          return (
            <div 
              key={index} 
              className={`leaderboard-entry grid grid-cols-6 py-3 px-4 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              } ${index < 3 ? 'border-l-4 ' + (
                index === 0 ? 'border-yellow-400' : 
                index === 1 ? 'border-gray-400' : 
                'border-amber-600'
              ) : ''}`}
            >
              <div className="col-span-1 flex items-center">
                {getMedalIcon(index)}
                {index + 1}
              </div>
              <div className="col-span-2 flex items-center">
                {profile.avatar ? (
                  <img 
                    src={profile.avatar} 
                    alt={profile.displayName} 
                    className="w-8 h-8 rounded-full mr-2"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 mr-2 flex items-center justify-center">
                    <span className="text-gray-600 text-sm">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span>{profile.displayName}</span>
              </div>
              <div className="col-span-1">
                {(entry.distance / 1000).toFixed(2)} km
              </div>
              <div className="col-span-1">
                {formatTime(entry.duration)}
              </div>
              <div className="col-span-1">
                {`${paceMin}:${paceSec.toString().padStart(2, '0')}/km`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

EventLeaderboard.propTypes = {
  eventId: PropTypes.string.isRequired,
  userProfiles: PropTypes.instanceOf(Map)
};

EventLeaderboard.defaultProps = {
  userProfiles: new Map()
};

export default EventLeaderboard; 