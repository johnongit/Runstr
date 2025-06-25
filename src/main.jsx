import './hideErrorOverlay.js'; // Must come first to suppress dev overlays
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './utils/nostrPolyfills.js'; // Shim SimplePool.list for nostr-tools v2
import App from './App.jsx';
import React from 'react';
import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);
