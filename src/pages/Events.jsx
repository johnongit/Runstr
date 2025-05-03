import { useState, useEffect } from 'react';
import { useRunStats } from '../hooks/useRunStats';
import runDataService from '../services/RunDataService';
import LeaderboardTabs from '../components/LeaderboardTabs';
import EventCard from '../components/EventCard';
import { getAllEvents, initializeEvents } from '../services/EventService';

const Events = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboards');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load run history and events from local storage
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Initialize events
      initializeEvents();
      
      // Load run history
      const runs = runDataService.getAllRuns();
      setRunHistory(runs || []);
      
      // Load events
      const eventsData = getAllEvents();
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('There was a problem loading the leaderboard data. Please try again later.');
      setRunHistory([]);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Use the useRunStats hook to calculate stats
  const { stats } = useRunStats(runHistory);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  if (isLoading) {
    return (
      <div className="events-page loading">
        <h2>Events & Leaderboards</h2>
        <div className="loading-indicator">
          <p>Loading leaderboards...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="events-page error">
        <h2>Events & Leaderboards</h2>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="events-page">
      <h2>Events & Leaderboards</h2>
      
      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'leaderboards' ? 'active' : ''}`}
          onClick={() => handleTabChange('leaderboards')}
        >
          Leaderboards
        </button>
        <button 
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => handleTabChange('events')}
        >
          Events
        </button>
      </div>
      
      {activeTab === 'leaderboards' ? (
        <div className="leaderboards-section">
          <LeaderboardTabs 
            runHistory={runHistory} 
            stats={stats || {}}
          />
        </div>
      ) : (
        <div className="events-section">
          {events.length > 0 ? (
            <div className="events-list">
              {events.map(event => (
                <EventCard 
                  key={event.id}
                  event={event}
                />
              ))}
            </div>
          ) : (
            <div className="no-events">
              <p>No active events at the moment.</p>
              <p>Check back soon for upcoming events!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Events; 