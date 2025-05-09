import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './assets/styles/main.css'; // Import our main CSS file
import { ndkReadyPromise } from './lib/ndkSingleton';
import { startRewardScheduler } from './services/scheduler';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Kick-off NDK connection handshake ASAP (fire-and-forget)
ndkReadyPromise
  .then((ready) => {
    if (ready) {
      console.log('[index] NDK warm-up complete');
      // Start reward scheduler after NDK ready (ensuring libs loaded)
      startRewardScheduler();
    } else {
      console.warn('[index] NDK failed to connect during warm-up');
      // Start scheduler anyway (it doesn't strictly depend on NDK)
      startRewardScheduler();
    }
  })
  .catch((err) => console.error('[index] Unexpected NDK warm-up error', err)); 