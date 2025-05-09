import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './assets/styles/main.css'; // Import our main CSS file
import { ndkReadyPromise } from './lib/ndkSingleton';

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
    } else {
      console.warn('[index] NDK failed to connect during warm-up');
    }
  })
  .catch((err) => console.error('[index] Unexpected NDK warm-up error', err)); 