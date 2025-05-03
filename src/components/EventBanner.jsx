import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveEvents } from '../services/EventService';

const EventBanner = () => {
  const [event, setEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if banner was recently dismissed
    const dismissedUntil = localStorage.getItem('eventBannerDismissedUntil');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      setDismissed(true);
      return;
    }
    
    // Get active events
    const activeEvents = getActiveEvents();
    
    // Sort events: active first, then by start date
    const sortedEvents = activeEvents.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(a.startDate) - new Date(a.startDate);
    });
    
    if (sortedEvents.length > 0) {
      setEvent(sortedEvents[0]);
    }
  }, []);
  
  if (!event || dismissed) return null;
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  };
  
  const handleDismiss = (e) => {
    e.stopPropagation();
    // Dismiss for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem('eventBannerDismissedUntil', dismissUntil.toISOString());
    setDismissed(true);
  };
  
  const handleClick = () => {
    navigate(`/event/${event.id}`);
  };
  
  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);
  const dateDisplay = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  
  return (
    <div className="relative bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 py-3 mb-4 rounded-md shadow-lg mx-4 border border-indigo-500">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white hover:text-gray-200 transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
      
      <div className="flex items-center cursor-pointer" onClick={handleClick}>
        <div className="flex-shrink-0 mr-3">
          {event.hostClub?.avatar && (
            <img 
              src={event.hostClub.avatar} 
              alt={event.hostClub.name || 'Event host'} 
              className="h-10 w-10 rounded-full border-2 border-white"
            />
          )}
        </div>
        
        <div>
          <div className="font-bold text-lg">{event.title}</div>
          <div className="text-sm flex items-center text-indigo-100">
            <span className="mr-2">📅 {dateDisplay}</span>
            {event.hostClub?.name && (
              <span>Hosted by {event.hostClub.name}</span>
            )}
          </div>
        </div>
        
        <div className="ml-auto">
          <span className="bg-white text-indigo-600 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
            {event.status === 'active' ? '🔴 LIVE NOW' : '⏰ UPCOMING'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EventBanner; 