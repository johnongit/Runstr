import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy load components to improve initial load performance
const RunTracker = lazy(() => import('./components/RunTracker').then(module => ({ default: module.RunTracker || module.default })));
const RunHistory = lazy(() => import('./pages/RunHistory').then(module => ({ default: module.RunHistory || module.default })));
const RunClub = lazy(() => import('./pages/RunClub').then(module => ({ default: module.RunClub || module.default })));
const Wallet = lazy(() => import('./pages/Wallet').then(module => ({ default: module.Wallet || module.default })));
const Music = lazy(() => import('./pages/Music').then(module => ({ default: module.Music || module.default })));
const NWC = lazy(() => import('./pages/NWC').then(module => ({ default: module.NWC || module.default })));
const Goals = lazy(() => import('./pages/Goals').then(module => ({ default: module.Goals || module.default })));
const TeamDetail = lazy(() => import('./pages/TeamDetail').then(module => ({ default: module.TeamDetail || module.default })));
const Events = lazy(() => import('./pages/Events').then(module => ({ default: module.Events || module.default })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile || module.default })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About || module.default })));
const MyClubsScreen = lazy(() => import('./pages/MyClubsScreen').then(module => ({ default: module.MyClubsScreen || module.default })));
const GroupDiscoveryScreen = lazy(() => import('./components/GroupDiscoveryScreen').then(module => ({ default: module.GroupDiscoveryScreen || module.default })));
const Teams = lazy(() => import('./pages/Teams').then(module => ({ default: module.Teams || module.default })));

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
