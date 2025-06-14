import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import rewardsPayoutService from '../services/rewardsPayoutService';
import { Button } from './ui/button';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { 
    distanceUnit, toggleDistanceUnit,
    healthEncryptionPref, setHealthEncryptionPref,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl,
    skipStartCountdown, setSkipStartCountdown,
    usePedometer, setUsePedometer,
  } = useSettings();

  // State for the fallback lightning address in the modal
  const [manualLnAddress, setManualLnAddress] = useState('');
  const [lnAddressStatusMessage, setLnAddressStatusMessage] = useState('');

  // Load manualLnAddress when settings modal becomes visible or component mounts
  useEffect(() => {
    const savedLnAddress = localStorage.getItem('manualLightningAddress');
    if (savedLnAddress) {
      setManualLnAddress(savedLnAddress);
    }
  }, []);

  const menuItems = [
    { 
      name: 'DASHBOARD', 
      path: '/', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ) 
    },
    { 
      name: 'STATS', 
      path: '/history', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ) 
    },
    { 
      name: 'FEED', 
      path: '/club', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ) 
    },
    { 
      name: 'TEAMS', 
      path: '/teams', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ) 
    },
    { 
      name: 'MUSIC', 
      path: '/music', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ) 
    }
  ];

  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  const handleActivityModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleSaveLnAddress = () => {
    if (manualLnAddress && manualLnAddress.includes('@') && manualLnAddress.includes('.')) {
      localStorage.setItem('manualLightningAddress', manualLnAddress);
      setLnAddressStatusMessage('Lightning Address saved!');
    } else if (!manualLnAddress) {
      localStorage.removeItem('manualLightningAddress');
      setLnAddressStatusMessage('Lightning Address cleared.');
    } else {
      setLnAddressStatusMessage('Please enter a valid Lightning Address (e.g., user@domain.com)');
    }
    setTimeout(() => setLnAddressStatusMessage(''), 3000);
  };

  return (
    <div className="w-full">
      {/* Header with Settings - Updated with Design System */}
      <header className="flex justify-between items-center p-4 w-full bg-background border-b border-border">
        <Link to="/" className="text-xl font-bold text-text-primary hover:text-interactive transition-colors duration-normal">
          #RUNSTR
        </Link>
        <div className="min-w-[120px]">
          <FloatingMusicPlayer />
        </div>
        <button 
          className="text-text-secondary hover:text-text-primary transition-colors duration-normal p-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={toggleSettings}
          aria-label="Open Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Settings Modal - Updated with Design System */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-text-primary">Settings</h3>
              <button 
                onClick={toggleSettings} 
                className="text-text-secondary hover:text-text-primary transition-colors duration-normal p-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Types Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Activity Types</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={mode === ACTIVITY_TYPES.RUN ? "accent" : "secondary"}
                  size="md"
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.RUN)}
                  className="text-center"
                >
                  Run
                </Button>
                <Button
                  variant={mode === ACTIVITY_TYPES.WALK ? "accent" : "secondary"}
                  size="md"
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.WALK)}
                  className="text-center"
                >
                  Walk
                </Button>
                <Button
                  variant={mode === ACTIVITY_TYPES.CYCLE ? "accent" : "secondary"}
                  size="md"
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.CYCLE)}
                  className="text-center"
                >
                  Cycle
                </Button>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                Currently tracking: {getActivityText()}
              </p>
            </div>
            
            {/* Run Behavior Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Run Behavior</h4>
              <div className="bg-surface-elevated border border-border p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Skip Start Countdown</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-accent bg-surface border-border focus:ring-accent focus:ring-2 rounded"
                    checked={skipStartCountdown}
                    onChange={() => setSkipStartCountdown(!skipStartCountdown)}
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  Start the run immediately when you tap "Start Run".
                </p>
              </div>
            </div>
            
            {/* Distance Unit Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Distance Units</h4>
              <div className="flex justify-center mb-2">
                <div className="flex rounded-full bg-surface-elevated border border-border p-1">
                  <Button
                    variant={distanceUnit === 'km' ? "accent" : "ghost"}
                    size="sm"
                    onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
                    className="rounded-full px-6 py-2"
                  >
                    Kilometers
                  </Button>
                  <Button
                    variant={distanceUnit === 'mi' ? "accent" : "ghost"}
                    size="sm"
                    onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
                    className="rounded-full px-6 py-2"
                  >
                    Miles
                  </Button>
                </div>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
              </p>
            </div>
            
            {/* Health Encryption Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Health Data Privacy</h4>
              <div className="flex items-center justify-between bg-surface-elevated border border-border p-4 rounded-lg mb-3">
                <span className="text-sm text-text-secondary mr-3">Encrypt Health Data (NIP-44)</span>
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-accent bg-surface border-border focus:ring-accent focus:ring-2 rounded"
                  checked={healthEncryptionPref === 'encrypted'}
                  onChange={() => {
                    const currentPrefIsEncrypted = healthEncryptionPref === 'encrypted';
                    const newPrefWillBeEncrypted = !currentPrefIsEncrypted;
                    if (newPrefWillBeEncrypted === false) {
                      const confirmDisable = window.confirm(
                        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
                      );
                      if (!confirmDisable) {
                        return;
                      }
                    }
                    setHealthEncryptionPref(newPrefWillBeEncrypted ? 'encrypted' : 'plaintext');
                  }}
                />
              </div>

              {/* Publish Destination Section */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Publish Destination</label>
                <div className="flex rounded-md bg-surface-elevated border border-border p-1 space-x-1">
                  <Button
                    variant={publishMode === 'public' ? "accent" : "ghost"}
                    size="sm"
                    onClick={() => setPublishMode('public')}
                    className="flex-1 text-xs"
                  >
                    Public Relays
                  </Button>
                  <Button
                    variant={publishMode === 'private' ? "accent" : "ghost"}
                    size="sm"
                    onClick={() => setPublishMode('private')}
                    className="flex-1 text-xs"
                  >
                    Private Relay
                  </Button>
                  <Button
                    variant={publishMode === 'mixed' ? "accent" : "ghost"}
                    size="sm"
                    onClick={() => setPublishMode('mixed')}
                    className="flex-1 text-xs"
                  >
                    Mixed
                  </Button>
                </div>
                {(publishMode === 'private' || publishMode === 'mixed') && (
                  <div className="mt-2">
                    <label htmlFor="privateRelayUrlInputModal" className="block text-xs font-medium text-text-secondary mb-1">
                      Private Relay URL (wss://...)
                    </label>
                    <input
                      id="privateRelayUrlInputModal"
                      type="text"
                      value={privateRelayUrl}
                      onChange={e => setPrivateRelayUrl(e.target.value)}
                      placeholder="wss://your-private-relay.com"
                      className="w-full bg-surface-elevated border border-border p-2 rounded-md text-text-primary text-sm focus:ring-accent focus:border-accent focus:ring-2"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Bitcoin Rewards Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Bitcoin Rewards</h4>
              <p className="text-sm text-text-secondary">
                Runstr now automatically sends Bitcoin rewards directly to your connected Nostr account (via Zaps).
                You no longer need to configure a separate Lightning Address here. Ensure your Nostr profile has a Lightning Address set up to receive rewards.
              </p>
            </div>
            
            {/* Step Counting Settings Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-text-primary">Step Counting (Walking)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-surface-elevated border border-border p-4 rounded-lg mb-3">
                  <span className="text-sm text-text-secondary mr-3">Use Device Step Counter</span>
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-accent bg-surface border-border focus:ring-accent focus:ring-2 rounded"
                    checked={usePedometer}
                    onChange={() => setUsePedometer(!usePedometer)}
                  />
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2 text-text-primary">Rewards</h4>
              <div className="bg-surface-elevated border border-border p-4 rounded-lg">
                <label htmlFor="manualLnAddressInput" className="block text-sm font-medium text-text-primary mb-1">Fallback Lightning Address</label>
                <input
                  type="email"
                  id="manualLnAddressInput"
                  placeholder="yourname@example.com"
                  value={manualLnAddress}
                  onChange={(e) => setManualLnAddress(e.target.value)}
                  className="w-full p-2 rounded-md bg-surface border border-border text-text-primary focus:ring-accent focus:border-accent focus:ring-2"
                />
                <Button 
                  onClick={handleSaveLnAddress} 
                  className="mt-2 w-full"
                  variant="primary"
                  size="md"
                >
                  Save Address
                </Button>
                {lnAddressStatusMessage && <p className="mt-2 text-xs text-center text-text-secondary">{lnAddressStatusMessage}</p>}
                <p className="mt-2 text-xs text-text-tertiary">
                  This is a global fallback. If Runstr attempts to send a reward and cannot find the recipient's Lightning Address from their Nostr profile, it will use this address instead.
                </p>
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <Link 
                to="/nwc" 
                className="flex items-center p-3 bg-surface-elevated border border-border rounded-lg text-text-primary hover:bg-surface transition-colors duration-normal"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Wallet</span>
              </Link>
              <Link 
                to="/about" 
                className="flex items-center p-3 bg-surface-elevated border border-border rounded-lg text-text-primary hover:bg-surface transition-colors duration-normal"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-interactive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>About Runstr</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Updated with Design System */}
      <nav className="fixed bottom-0 left-0 w-full bg-background border-t border-border py-2 z-40 shadow-lg">
        <div className="max-w-[500px] mx-auto px-2">
          <ul className="flex justify-between">
            {menuItems.map((item) => (
              <li key={item.name} className="flex-1">
                <Link 
                  to={item.path} 
                  className={`flex flex-col items-center justify-center px-2 py-2 rounded-md min-h-[44px] transition-all duration-normal ease-out ${
                    location.pathname === item.path 
                      ? 'text-interactive bg-surface-elevated' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  <div className="mb-1">
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium tracking-wide text-center">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}; 