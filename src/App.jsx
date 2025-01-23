import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AchievementProvider } from './contexts/AchievementContext.jsx';
import { AppRoutes } from './AppRoutes';
import { MenuBar } from './components/MenuBar';
import './App.css';

const App = () => {
  return (
    <Router>
      <NostrProvider>
        <AchievementProvider>
          <div className="app">
            <MenuBar />
            <AppRoutes />
          </div>
        </AchievementProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
