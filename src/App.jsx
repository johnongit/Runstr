import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { AppRoutes } from './AppRoutes';
import { MenuBar } from './components/MenuBar';
import { FloatingMusicPlayer } from './components/FloatingMusicPlayer';
import './App.css';

const App = () => {
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <div className="app">
              <MenuBar />
              <AppRoutes />
              <FloatingMusicPlayer />
            </div>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
