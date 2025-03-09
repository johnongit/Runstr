import { Routes, Route } from 'react-router-dom';
import { RunTracker } from './components/RunTracker';
import { RunHistory } from './pages/RunHistory';
import { Achievements } from './pages/Achievements';
import { RunClub } from './pages/RunClub';
import { Wallet } from './pages/Wallet';
import { Music } from './pages/Music';
import { NWC } from './pages/NWC';
import { Goals } from './pages/Goals';
import { Team } from './pages/Team';
import { Events } from './pages/Events';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/history" element={<RunHistory />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/club" element={<RunClub />} />
      <Route path="/club/join/:teamId" element={<RunClub />} />
      <Route path="/team" element={<Team />} />
      <Route path="/team/profile/:teamId" element={<Team />} />
      <Route path="/events" element={<Events />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/music" element={<Music />} />
      <Route path="/nwc" element={<NWC />} />
      <Route path="/goals" element={<Goals />} />
      <Route path="/" element={<RunTracker />} />
    </Routes>
  );
};
