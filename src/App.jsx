import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { TeamsProvider } from './contexts/TeamsContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { MenuBar } from './components/MenuBar';
import { initializeNostr } from './utils/nostr';
// Import connection manager and feed state
import nostrConnectionManager from './utils/nostrConnectionManager';
import globalFeedState from './utils/globalFeedState';
import './App.css';

console.log("App.jsx is loading");

// Improved error boundary fallback
const ErrorFallback = () => (
  <div className="p-6 bg-red-900/30 border border-red-800 rounded-lg m-4">
    <h2 className="text-2xl font-bold text-white mb-4">App Loading Error</h2>
    <p className="text-red-300 mb-4">
      There was a problem loading the app. This could be due to network issues or a problem with the app itself.
    </p>
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
    >
      Reload App
    </button>
  </div>
);

// Enhanced loading component with timeout detection
const EnhancedLoadingFallback = () => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  useEffect(() => {
    // After 5 seconds of loading, show a timeout warning
    const timeoutId = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-300">Loading RUNSTR...</p>
      
      {showTimeoutWarning && (
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg max-w-md">
          <p className="text-yellow-300 text-center mb-2">
            Loading is taking longer than expected. Please be patient.
          </p>
          <p className="text-yellow-400 text-sm text-center">
            If this persists, try reloading the app.
          </p>
        </div>
      )}
    </div>
  );
};

// Lazy load AppRoutes with error handling
const AppRoutes = lazy(() => 
  import('./AppRoutes')
    .then(module => {
      console.log("AppRoutes module loaded successfully");
      return { default: module.default || module.AppRoutes };
    })
    .catch(error => {
      console.error("Error loading AppRoutes:", error);
      return { 
        default: () => <ErrorFallback /> 
      };
    })
);

const App = () => {
  const [hasError, setHasError] = useState(false);
  const [feedPreloadProgress, setFeedPreloadProgress] = useState(0);
  
  // Initialize Nostr connection as soon as the app launches
  useEffect(() => {
    const preloadNostr = async () => {
      try {
        console.log('Preloading Nostr connection on app launch');
        
        // Initialize connection
        const connected = await initializeNostr();
        nostrConnectionManager.setConnectionStatus(connected);
        globalFeedState.setInitialized(connected);
        
        if (!connected) {
          console.error('Failed to connect to Nostr network');
          return;
        }
        
        // Start feed preloading with background priority
        try {
          // Mark as preloading in progress
          globalFeedState.setPreloading(true);
          globalFeedState.setLoadingProgress(5);
          setFeedPreloadProgress(5);
          
          // Dynamically import feed functions to avoid circular dependencies
          const { fetchRunningPosts, loadSupplementaryData, processPostsWithData } = await import('./utils/nostr');
          
          // Start feed operation if no higher priority operations are active
          if (nostrConnectionManager.startOperation('background')) {
            console.log('Preloading feed data in background');
            
            // Fetch a reasonable number of posts (more than default to avoid frequent refreshes)
            globalFeedState.setLoadingProgress(10);
            setFeedPreloadProgress(10);
            
            const runPosts = await fetchRunningPosts(15);
            globalFeedState.updatePreloadedCount(runPosts.length);
            
            // Update progress
            globalFeedState.setLoadingProgress(40);
            setFeedPreloadProgress(40);
            
            // Load supplementary data in parallel
            const supplementaryData = await loadSupplementaryData(runPosts);
            globalFeedState.setLoadingProgress(70);
            setFeedPreloadProgress(70);
            
            // Process posts with supplementary data
            const processedPosts = await processPostsWithData(runPosts, supplementaryData);
            
            // Store in global state
            globalFeedState.setCachedPosts(processedPosts);
            globalFeedState.storeSupplementaryData(supplementaryData);
            
            // Complete preloading
            globalFeedState.setLoadingProgress(100);
            setFeedPreloadProgress(100);
            globalFeedState.completePreload();
            
            console.log(`Successfully preloaded ${processedPosts.length} feed posts`);
            
            // End the operation
            nostrConnectionManager.endOperation('background');
          } else {
            console.log('Feed preloading deferred due to higher priority operations');
          }
        } catch (error) {
          console.error('Error in feed preloading:', error);
          globalFeedState.setPreloading(false);
        }
      } catch (error) {
        console.error('Error in preloadNostr:', error);
      }
    };
    
    preloadNostr();
  }, []);
  
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  
  if (hasError) {
    return <ErrorFallback />;
  }
  
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <SettingsProvider>
              <ActivityModeProvider>
                <RunTrackerProvider>
                  <TeamsProvider>
                    <div className="relative w-full h-full bg-[#111827] text-white">
                      <MenuBar />
                      <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                        <Suspense fallback={<EnhancedLoadingFallback />}>
                          <AppRoutes />
                        </Suspense>
                      </main>
                    </div>
                  </TeamsProvider>
                </RunTrackerProvider>
              </ActivityModeProvider>
            </SettingsProvider>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
