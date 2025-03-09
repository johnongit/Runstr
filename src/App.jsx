import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AchievementProvider } from './contexts/AchievementContext.jsx';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { AppRoutes } from './AppRoutes';
import { MenuBar } from './components/MenuBar';
import { FloatingMusicPlayer } from './components/FloatingMusicPlayer';
import './App.css';

const App = () => {
  return (
    <Router>
      <NostrProvider>
        <AchievementProvider>
          <AudioPlayerProvider>
            <div className="app">
              <MenuBar />
              <AppRoutes />
              <FloatingMusicPlayer />
            </div>
          </AudioPlayerProvider>
        </AchievementProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
