import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveEvents } from '../services/EventService';

const EventBanner = () => {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    try {
      // Get active events
      const activeEvents = getActiveEvents();
      console.log('Active events for banner:', activeEvents);
      
      if (!activeEvents || activeEvents.length === 0) {
        console.log('No active events found for banner');
        return;
      }
      
      // Sort events: active first, then by start date
      const sortedEvents = activeEvents.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return new Date(a.startDate) - new Date(b.startDate); // Fixed comparison
      });
      
      if (sortedEvents.length > 0) {
        setEvent(sortedEvents[0]);
      }
    } catch (err) {
      console.error('Error loading events for banner:', err);
      setError(err.message);
    }
  }, []);
  
  if (error) {
    console.error('Error in EventBanner:', error);
    return null; // Don't show banner if there's an error
  }
  
  if (!event) return null;
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    // Format as Month/Day (e.g., May 4)
    return date.toLocaleDateString(undefined, { 
      month: 'long', 
      day: 'numeric'
    });
  };
  
  const handleClick = () => {
    navigate(`/event/${event.id}`);
  };
  
  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);
  const dateDisplay = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  
  return (
    <div className="relative bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 py-3 mb-4 rounded-md shadow-lg mx-4 border-2 border-indigo-400">
      <div className="flex items-center cursor-pointer" onClick={handleClick}>
        <div>
          <div className="font-bold text-lg">{event.title}</div>
          <div className="text-sm flex items-center text-indigo-100">
            <span className="mr-2">📅 {dateDisplay}</span>
            {event.hostClub?.name && (
              <span>Hosted by {event.hostClub.name}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventBanner; 