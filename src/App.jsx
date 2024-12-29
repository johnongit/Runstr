import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RunTracker } from './components/RunTracker.jsx';
import { MenuBar } from './components/MenuBar.jsx';
import { Login } from './pages/Login.jsx';
import { RunHistory } from './pages/RunHistory.jsx';
import { Achievements } from './pages/Achievements.jsx';
import { RunClub } from './pages/RunClub.jsx';
import { Wallet } from './pages/Wallet.jsx';
import { Music } from './pages/Music.jsx';
import { NWC } from './pages/NWC.jsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <MenuBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/history" element={<RunHistory />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/club" element={<RunClub />} />
        <Route path="/club/join/:teamId" element={<RunClub />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/nwc" element={<NWC />} />
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
