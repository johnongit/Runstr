import { useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNostr } from '../hooks/useNostr';
import { displayDistance } from '../utils/formatters';
import { useSettings } from '../contexts/SettingsContext';
import '../assets/styles/leaderboard.css';
import PropTypes from 'prop-types';

/**
 * Leaderboard component with tabs for different leaderboard types
 */
const LeaderboardTabs = ({ runHistory, stats, showSettings = true }) => {
  // Handle case where NostrContext might not be fully initialized yet
  const nostrContext = useNostr();
  const publicKey = nostrContext?.publicKey || null;
  // Default to empty Map if profiles isn't available
  const profiles = nostrContext?.profiles || new Map();
  
  const { distanceUnit } = useSettings();
  const [activeTab, setActiveTab] = useState('distance');
  
  // Always call hooks, even if we might not use their results
  const { 
    participating,
    toggleParticipation,
    currentPeriod,
    changePeriod,
    distanceLeaderboard,
    streakLeaderboard,
    improvementLeaderboard
  } = useLeaderboard(publicKey, profiles, runHistory || [], stats || {});
  
  // Safety check - if essential data is missing, show a fallback UI
  if (!runHistory || !stats) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-error">
          <h3>Leaderboard Unavailable</h3>
          <p>We couldn&apos;t load your running data. Please try again later or complete a run to join the leaderboards.</p>
        </div>
      </div>
    );
  }
  
  // Handle tab changes
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };
  
  // Handle period change
  const handlePeriodChange = (period) => {
    changePeriod(period);
  };
  
  // Format improvement rate number for display
  const formatImprovement = (rate) => {
    if (rate > 0) {
      return <span className="positive">+{rate.toFixed(1)}%</span>;
    } else if (rate < 0) {
      return <span className="negative">{rate.toFixed(1)}%</span>;
    }
    return <span>0%</span>;
  };
  
  // Get the active leaderboard based on tab
  const getActiveLeaderboard = () => {
    switch (activeTab) {
      case 'distance':
        return distanceLeaderboard;
      case 'streak':
        return streakLeaderboard;
      case 'improvement':
        return improvementLeaderboard;
      default:
        return distanceLeaderboard;
    }
  };
  
  // Render leaderboard entry based on active tab
  const renderLeaderboardMetric = (entry) => {
    switch (activeTab) {
      case 'distance':
        return displayDistance(entry.distance, distanceUnit);
      case 'streak':
        return `${entry.streak} day${entry.streak !== 1 ? 's' : ''}`;
      case 'improvement':
        return formatImprovement(entry.improvementRate);
      default:
        return '';
    }
  };
  
  // Get leaderboard title based on active tab and period
  const getLeaderboardTitle = () => {
    let periodText = '';
    if (activeTab === 'distance') {
      switch (currentPeriod) {
        case 'week':
          periodText = 'Weekly';
          break;
        case 'month':
          periodText = 'Monthly';
          break;
        case 'all-time':
          periodText = 'All-time';
          break;
        default:
          periodText = 'Weekly';
      }
    }
    
    switch (activeTab) {
      case 'distance':
        return `${periodText} Distance Leaderboard`;
      case 'streak':
        return 'Streak Leaderboard';
      case 'improvement':
        return 'Weekly Improvement Leaderboard';
      default:
        return 'Leaderboard';
    }
  };
  
  // Show period selector only for distance leaderboard
  const showPeriodSelector = activeTab === 'distance';
  
  return (
    <div className="leaderboard-container">
      {/* Participation toggle */}
      {showSettings && (
        <div className="leaderboard-settings">
          <label className="participation-toggle">
            <span>Participate in leaderboards</span>
            <input 
              type="checkbox" 
              checked={participating} 
              onChange={toggleParticipation}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      )}
      
      {/* Tab navigation */}
      <div className="leaderboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'distance' ? 'active' : ''}`} 
          onClick={() => handleTabChange('distance')}
        >
          Distance
        </button>
        <button 
          className={`tab-button ${activeTab === 'streak' ? 'active' : ''}`}
          onClick={() => handleTabChange('streak')}
        >
          Streak
        </button>
        <button 
          className={`tab-button ${activeTab === 'improvement' ? 'active' : ''}`}
          onClick={() => handleTabChange('improvement')}
        >
          Improvement
        </button>
      </div>
      
      {/* Period selector (only for distance) */}
      {showPeriodSelector && (
        <div className="period-selector">
          <button 
            className={`period-button ${currentPeriod === 'week' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('week')}
          >
            Week
          </button>
          <button 
            className={`period-button ${currentPeriod === 'month' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('month')}
          >
            Month
          </button>
          <button 
            className={`period-button ${currentPeriod === 'all-time' ? 'active' : ''}`}
            onClick={() => handlePeriodChange('all-time')}
          >
            All Time
          </button>
        </div>
      )}
      
      {/* Leaderboard header */}
      <h3 className="leaderboard-title">{getLeaderboardTitle()}</h3>
      
      {/* Leaderboard entries */}
      <div className="leaderboard-list">
        {getActiveLeaderboard().length > 0 ? (
          getActiveLeaderboard().map(entry => (
            <div 
              key={entry.pubkey} 
              className={`leaderboard-entry ${entry.isCurrentUser ? 'is-current-user' : ''}`}
            >
              <div className="entry-rank">{entry.rank}</div>
              <div className="entry-user">
                <div className="entry-avatar">
                  {entry.picture ? (
                    <img src={entry.picture} alt={entry.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {entry.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="entry-name">{entry.name}</div>
              </div>
              <div className="entry-metric">
                {renderLeaderboardMetric(entry)}
              </div>
            </div>
          ))
        ) : (
          <div className="no-entries">
            <p>No entries yet. Start running to join the leaderboard!</p>
          </div>
        )}
      </div>
      
      {/* Rewards explanation */}
      <div className="leaderboard-rewards-info">
        <h4>Bitcoin Rewards</h4>
        <p>Top performers earn Bitcoin rewards automatically!</p>
        <ul>
          <li>🥇 1st place: 1000 sats</li>
          <li>🥈 2nd place: 500 sats</li>
          <li>🥉 3rd place: 250 sats</li>
          {activeTab === 'improvement' && (
            <li>⭐ 10%+ improvement: 50 sats</li>
          )}
        </ul>
      </div>
    </div>
  );
};

// Add prop validations
LeaderboardTabs.propTypes = {
  runHistory: PropTypes.array,
  stats: PropTypes.object,
  showSettings: PropTypes.bool
};

export default LeaderboardTabs; 