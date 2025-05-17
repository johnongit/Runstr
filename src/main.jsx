import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './utils/nostrPolyfills.js'; // Shim SimplePool.list for nostr-tools v2
import App from './App.jsx';

/* -----------------------------------------------------------
  Temporary debug overlay to surface runtime errors on device
  Remove this block once blank-screen issue is fixed
------------------------------------------------------------*/
if (typeof window !== 'undefined') {
  const showError = (msg) => {
    const el = document.createElement('pre');
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;max-height:45%;overflow:auto;' +
      'background:#300;color:#f88;padding:8px 12px;z-index:99999;' +
      'font-size:12px;font-family:monospace;white-space:pre-wrap;';
    el.textContent = msg;
    document.body.appendChild(el);
  };

  window.addEventListener('error', (e) => {
    showError('[error] ' + e.message + '\n' + (e.error?.stack || ''));
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason?.message || reason;
    // Ignore benign Purple Pages relay rejection noise
    if (typeof msg === 'string' && msg.includes('Purple Pages only accepts')) {
      // Prevent the default overlay
      e.preventDefault();
      console.info('Ignored relay rejection from Purple Pages');
      return;
    }
    showError('[promise] ' + msg + '\n' + (reason?.stack || ''));
  });

  // Global suppression of unhandled promise rejections to remove red overlay in dev
  window.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
    console.warn('Suppressed unhandled rejection:', e.reason);
  });
}
/* ---------------------------------------------------------*/

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
