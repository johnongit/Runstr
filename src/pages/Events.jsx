import { useState, useEffect } from 'react';
import { getAllEvents, initializeEvents } from '../services/EventService';
import EventCard from '../components/EventCard';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load run history and events from local storage
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Initialize events
      initializeEvents();
      
      // Load events
      const eventsData = getAllEvents();
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('There was a problem loading the events data. Please try again later.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  if (isLoading) {
    return (
      <div className="events-page loading">
        <h2>Events</h2>
        <div className="loading-indicator">
          <p>Loading events...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="events-page error">
        <h2>Events</h2>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="events-page">
      <h2>Events</h2>

      {events.length > 0 ? (
        <div className="events-section">
          <div className="events-list">
            {events.map(event => (
              <EventCard 
                key={event.id}
                event={event}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="no-events">
          <p>No active events at the moment.</p>
          <p>Check back soon for upcoming events!</p>
        </div>
      )}
    </div>
  );
};

export default Events; 