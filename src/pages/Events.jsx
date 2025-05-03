import { useState, useEffect } from 'react';
import { useRunStats } from '../hooks/useRunStats';
import runDataService from '../services/RunDataService';
import LeaderboardTabs from '../components/LeaderboardTabs';

const Events = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboards');
  
  // Load run history from local storage
  useEffect(() => {
    try {
      const runs = runDataService.getAllRuns();
      setRunHistory(runs);
    } catch (error) {
      console.error('Error loading run history:', error);
      setRunHistory([]);
    }
  }, []);
  
  // Use the useRunStats hook to calculate stats
  const { stats } = useRunStats(runHistory);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
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
            stats={stats}
          />
        </div>
      ) : (
        <div className="events-section">
          <div className="coming-soon">
            <h3>Coming Soon!</h3>
            <p>We're working on exciting running events and challenges.</p>
            <p>Check back later for virtual races, challenges, and community events!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events; 