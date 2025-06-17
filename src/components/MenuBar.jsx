import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import rewardsPayoutService from '../services/rewardsPayoutService';
import { testConnection, DEFAULT_SERVERS } from '../lib/blossom';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { 
    distanceUnit, toggleDistanceUnit,
    healthEncryptionPref, setHealthEncryptionPref,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl,
    blossomEndpoint, setBlossomEndpoint,
    skipStartCountdown, setSkipStartCountdown,
    usePedometer, setUsePedometer,
    useLocalStats, setUseLocalStats,
    autoPostToNostr, setAutoPostToNostr
  } = useSettings();

  // State for the fallback lightning address in the modal
  const [manualLnAddress, setManualLnAddress] = useState('');
  const [lnAddressStatusMessage, setLnAddressStatusMessage] = useState('');
  
  // Blossom connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [customBlossomUrl, setCustomBlossomUrl] = useState('');

  // Load manualLnAddress when settings modal becomes visible or component mounts
  useEffect(() => {
    // Only load if the modal might be opened, or simply on mount.
    // If settingsOpen state is not directly accessible here, loading on mount is fine.
    const savedLnAddress = localStorage.getItem('manualLightningAddress');
    if (savedLnAddress) {
      setManualLnAddress(savedLnAddress);
    }
  }, []); // Empty dependency array: runs once on mount.
           // Or, if settingsOpen is available: [settingsOpen] to run when modal visibility changes

  const menuItems = [
    { 
      name: 'DASHBOARD', 
      path: '/', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ) 
    },
    { 
      name: 'STATS', 
      path: useLocalStats ? '/history' : '/nostr-stats', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ) 
    },
    { 
      name: 'FEED', 
      path: '/club', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ) 
    },
    { 
      name: 'TEAMS', 
      path: '/teams', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ) 
    },
    { 
      name: 'MUSIC', 
      path: '/music', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  const handleHealthEncryptionToggle = async (e) => {
    const enable = e.target.checked;
    if (!enable) {
      const confirmDisable = window.confirm(
        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
      );
      if (!confirmDisable) {
        e.preventDefault();
        return;
      }
    }
    setHealthEncryptionPref(enable ? 'encrypted' : 'plaintext');
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

  const handleTestBlossomConnection = async () => {
    // Determine the actual URL to test
    const urlToTest = blossomEndpoint === 'custom' ? customBlossomUrl : blossomEndpoint;
    
    if (!urlToTest) {
      setConnectionStatus({ success: false, message: 'Please enter a Blossom server URL first' });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const isConnected = await testConnection(urlToTest);
      if (isConnected) {
        setConnectionStatus({ 
          success: true, 
          message: 'Successfully connected to Blossom server!' 
        });
      } else {
        setConnectionStatus({ 
          success: false, 
          message: 'Could not connect to Blossom server. Please check the URL.' 
        });
      }
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    } finally {
      setIsTestingConnection(false);
      // Clear status after 5 seconds
      setTimeout(() => setConnectionStatus(null), 5000);
    }
  };

  return (
    <div className="w-full">
      {/* Header with Settings */}
      <header className="flex justify-between items-center p-4 w-full">
        <Link to="/" className="text-xl font-bold">#RUNSTR</Link>
        <div className="min-w-[120px]">
          <FloatingMusicPlayer />
        </div>
        <button className="text-gray-400" onClick={toggleSettings}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black bg-opacity-70">
          <div className="bg-bg-secondary rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-lg max-h-[90vh] overflow-y-auto border border-border-secondary">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button onClick={toggleSettings} className="text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Types Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Activity Types</h4>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.RUN ? 'bg-primary' : 'bg-bg-tertiary'} text-text-primary text-center transition-colors duration-normal hover:bg-primary/80`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.RUN)}
                >
                  Run
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.WALK ? 'bg-primary' : 'bg-bg-tertiary'} text-text-primary text-center transition-colors duration-normal hover:bg-primary/80`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.WALK)}
                >
                  Walk
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.CYCLE ? 'bg-primary' : 'bg-bg-tertiary'} text-text-primary text-center transition-colors duration-normal hover:bg-primary/80`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.CYCLE)}
                >
                  Cycle
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Currently tracking: {getActivityText()}
              </p>
            </div>
            
            {/* Run Behavior Section - NEW */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Run Behavior</h4>
              <div className="bg-bg-tertiary p-3 rounded-lg space-y-3 border border-border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Skip Start Countdown</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={skipStartCountdown}
                    onChange={() => setSkipStartCountdown(!skipStartCountdown)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Start the run immediately when you tap "Start Run".
                </p>
              </div>
            </div>
            
            {/* Stats Settings Section - NEW */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Stats Settings</h4>
              <div className="bg-bg-tertiary p-3 rounded-lg space-y-3 border border-border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary mr-3">Use Local Stats</span>
                  <input 
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
                    checked={useLocalStats}
                    onChange={() => setUseLocalStats(!useLocalStats)}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  When enabled, the Stats tab shows local run history instead of Nostr workout stats.
                </p>
              </div>
            </div>
            
            {/* Distance Unit Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Distance Units</h4>
              <div className="flex justify-center mb-2">
                <div className="flex rounded-full bg-bg-tertiary p-1 border border-border-secondary">
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-primary text-text-primary' : 'text-text-muted hover:text-text-secondary'} transition-colors duration-normal`}
                    onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
                  >
                    Kilometers
                  </button>
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-primary text-text-primary' : 'text-text-muted hover:text-text-secondary'} transition-colors duration-normal`}
                    onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
                  >
                    Miles
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
              </p>
            </div>
            
            {/* Health Encryption Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Health Data Privacy</h4>
              <div className="flex items-center justify-between bg-bg-tertiary p-3 rounded-lg mb-3 border border-border-secondary">
                <span className="text-sm text-text-secondary mr-3">Encrypt Health Data (NIP-44)</span>
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-primary bg-bg-tertiary border-border-secondary focus:ring-primary rounded"
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

              {/* Publish Destination Section - ADDED HERE */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Publish Destination</label>
                <div className="flex rounded-md bg-bg-tertiary p-1 space-x-1 border border-border-secondary">
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors duration-normal ${
                      publishMode === 'public' ? 'bg-primary text-text-primary' : 'text-text-muted hover:bg-bg-secondary hover:text-text-secondary'
                    }`}
                    onClick={() => setPublishMode('public')}
                  >
                    Public Relays
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors duration-normal ${
                      publishMode === 'private' ? 'bg-primary text-text-primary' : 'text-text-muted hover:bg-bg-secondary hover:text-text-secondary'
                    }`}
                    onClick={() => setPublishMode('private')}
                  >
                    Private Relay
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors duration-normal ${
                      publishMode === 'mixed' ? 'bg-primary text-text-primary' : 'text-text-muted hover:bg-bg-secondary hover:text-text-secondary'
                    }`}
                    onClick={() => setPublishMode('mixed')}
                  >
                    Mixed
                  </button>
                </div>
                {(publishMode === 'private' || publishMode === 'mixed') && (
                  <div className="mt-2">
                    <label htmlFor="privateRelayUrlInputModal" className="block text-xs font-medium text-text-muted mb-1">
                      Private Relay URL (wss://...)
                    </label>
                    <input
                      id="privateRelayUrlInputModal"
                      type="text"
                      value={privateRelayUrl}
                      onChange={e => setPrivateRelayUrl(e.target.value)}
                      placeholder="wss://your-private-relay.com"
                      className="w-full bg-bg-primary p-2 rounded-md text-text-primary text-sm border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Bitcoin Rewards Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Bitcoin Rewards</h4>
              {/*
              <div className="space-y-2">
                <label htmlFor="lnAddressInput" className="text-sm text-gray-400">Lightning Address (to receive streak rewards)</label>
                <div className="flex">
                  <input
                    id="lnAddressInput"
                    type="text"
                    defaultValue={localStorage.getItem('lightningAddress') || ''}
                    placeholder="you@getalby.com"
                    className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                  />
                  <button
                    className="bg-indigo-600 px-4 rounded-r-lg text-white text-sm"
                    onClick={() => {
                      const val = document.getElementById('lnAddressInput').value.trim();
                      if (val && val.includes('@')) {
                        localStorage.setItem('lightningAddress', val);
                        localStorage.setItem('runstr_lightning_addr', val);
                        alert('Lightning address saved!');
                      } else {
                        alert('Enter a valid Lightning address e.g. name@domain.com');
                      }
                    }}
                  >Save</button>
                </div>
                <p className="text-xs text-gray-500">If you also connect an NWC wallet, the app will pay that first and fall back to this address if needed.</p>
              </div>
              */}
              <p className="text-sm text-gray-400">
                Runstr now automatically sends Bitcoin rewards directly to your connected Nostr account (via Zaps).
                You no longer need to configure a separate Lightning Address here. Ensure your Nostr profile has a Lightning Address set up to receive rewards.
              </p>
              {/* End of debug section – TEST PAYOUT button removed for production */}
            </div>
            
            {/* Step Counting Settings Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Step Counting (Walking)</h4>
              <div className="space-y-3">
                {/* NEW Pedometer Button - Replaced with Checkbox */}
                <div className="flex items-center justify-between bg-[#111827] p-3 rounded-lg mb-3">
                  <span className="text-sm text-gray-400 mr-3">Use Device Step Counter</span>
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 rounded"
                    checked={usePedometer}
                    onChange={() => setUsePedometer(!usePedometer)}
                  />
                </div>
                {/* End Pedometer Checkbox */}
              </div>
            </div>
            
            {/* Blossom Music Server Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Music Server</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="blossomEndpointSelect" className="block text-sm font-medium text-gray-300 mb-1">
                    Blossom Music Server
                  </label>
                  <select
                    id="blossomEndpointSelect"
                    value={blossomEndpoint}
                    onChange={e => setBlossomEndpoint(e.target.value)}
                    className="w-full bg-[#0b101a] p-2 rounded-md text-white text-sm border border-gray-600 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Search All Servers</option>
                    {DEFAULT_SERVERS.map(server => (
                      <option key={server.url} value={server.url}>
                        {server.name} {server.type === 'nip96' ? '(NIP-96)' : '(Blossom)'}
                      </option>
                    ))}
                    <option value="custom">Custom Server...</option>
                  </select>
                </div>
                
                {blossomEndpoint === 'custom' && (
                  <div>
                    <label htmlFor="customBlossomInput" className="block text-sm font-medium text-gray-300 mb-1">
                      Custom Server URL
                    </label>
                    <input
                      id="customBlossomInput"
                      type="text"
                      value={customBlossomUrl}
                      onChange={e => setCustomBlossomUrl(e.target.value)}
                      placeholder="https://your-blossom-server.com"
                      className="w-full bg-[#0b101a] p-2 rounded-md text-white text-sm border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleTestBlossomConnection}
                    disabled={isTestingConnection || (!blossomEndpoint || blossomEndpoint === 'custom' && !customBlossomUrl)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm rounded-md transition-colors"
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  {connectionStatus && (
                    <span className={`text-sm ${connectionStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                      {connectionStatus.message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Choose a specific server or leave blank to search all servers. NIP-96 servers support authenticated file listing, while Blossom servers use direct file access.
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2 text-gray-200">Rewards</h4>
              <div className="setting-item bg-gray-800 p-3 rounded-md">
                <label htmlFor="manualLnAddressInput" className="block text-sm font-medium text-gray-300 mb-1">Fallback Lightning Address</label>
                <input
                  type="email"
                  id="manualLnAddressInput"
                  placeholder="yourname@example.com"
                  value={manualLnAddress}
                  onChange={(e) => setManualLnAddress(e.target.value)}
                  className="w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-purple-500 focus:border-purple-500"
                />
                <button 
                  onClick={handleSaveLnAddress} 
                  className="mt-2 w-full px-4 py-2 rounded-md text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Save Address
                </button>
                {lnAddressStatusMessage && <p className="mt-2 text-xs text-center text-gray-400">{lnAddressStatusMessage}</p>}
                <p className="mt-2 text-xs text-gray-500">
                  This is a global fallback. If Runstr attempts to send a reward and cannot find the recipient's Lightning Address from their Nostr profile, it will use this address instead.
                </p>
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <Link 
                to="/nwc" 
                className="flex items-center p-3 bg-[#111827] rounded-lg text-white"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Wallet</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-bg-primary py-2 z-40 border-t border-border-secondary">
        <div className="max-w-[500px] mx-auto px-2">
          <ul className="flex justify-between">
            {menuItems.map((item) => (
              <li key={item.name} className="flex-1">
                <Link 
                  to={item.path} 
                  className={`flex flex-col items-center justify-center px-1 py-1 rounded-md h-full ${location.pathname === item.path ? 'text-purple-400' : 'text-gray-400'}`}
                >
                  {item.icon}
                  <span className="text-xs font-medium tracking-wider text-center whitespace-nowrap">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};
