import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy load components to improve initial load performance
const RunTracker = lazy(() => import('./pages/RunTracker'));
const RunHistory = lazy(() => import('./pages/RunHistory'));
const RunClub = lazy(() => import('./pages/RunClub'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Music = lazy(() => import('./pages/Music'));
const NWC = lazy(() => import('./pages/NWC'));
const Goals = lazy(() => import('./pages/Goals'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const Events = lazy(() => import('./pages/Events'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const MyClubsScreen = lazy(() => import('./pages/MyClubsScreen'));
const GroupDiscoveryScreen = lazy(() => import('./components/GroupDiscoveryScreen'));
const Teams = lazy(() => import('./pages/Teams'));

// Loading component to show while lazy loading
const LoadingComponent = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <Routes>
        <Route path="/history" element={<RunHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/club" element={<RunClub />} />
        <Route path="/nwc" element={<NWC />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/music" element={<Music />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/events" element={<Events />} />
        <Route path="/about" element={<About />} />
        
        {/* Teams routes */}
        <Route path="/teams" element={<Teams />} />
        <Route path="/discover-clubs" element={<GroupDiscoveryScreen />} />
        <Route path="/my-clubs" element={<MyClubsScreen />} />
        <Route path="/teams/:teamId" element={<TeamDetail />} />
        
        <Route path="/" element={<RunTracker />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
