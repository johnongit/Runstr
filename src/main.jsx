import './hideErrorOverlay.js'; // Must come first to suppress dev overlays
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './utils/nostrPolyfills.js'; // Shim SimplePool.list for nostr-tools v2
import App from './App.jsx';
import './App.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
