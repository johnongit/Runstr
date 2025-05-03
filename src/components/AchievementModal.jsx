import { useState } from 'react';
import StreakRewardsCard from './StreakRewardsCard';
import LeaderboardTabs from './LeaderboardTabs';
import BitcoinTransactionHistory from './BitcoinTransactionHistory';

/**
 * Modal displaying detailed achievements, rewards, and transactions
 * Opens when the AchievementCard is clicked
 */
const AchievementModal = ({ onClose, currentStreak, runHistory, stats }) => {
  const [activeTab, setActiveTab] = useState('streaks');
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'streaks':
        return <StreakRewardsCard currentStreak={currentStreak} showTitle={false} />;
      case 'leaderboards':
        return <LeaderboardTabs runHistory={runHistory} stats={stats} />;
      case 'transactions':
        return <BitcoinTransactionHistory />;
      default:
        return <StreakRewardsCard currentStreak={currentStreak} showTitle={false} />;
    }
  };
  
  return (
    <div className="achievement-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Achievements & Rewards</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-tabs">
          <button 
            className={`tab-button ${activeTab === 'streaks' ? 'active' : ''}`}
            onClick={() => setActiveTab('streaks')}
          >
            STREAKS
          </button>
          <button 
            className={`tab-button ${activeTab === 'leaderboards' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboards')}
          >
            LEADERBOARDS
          </button>
          <button 
            className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            TRANSACTIONS
          </button>
        </div>
        
        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AchievementModal; 