import React, { useState, useEffect } from 'react';
import enhancedSeasonPassService from '../../services/enhancedSeasonPassService';
import seasonPassService from '../../services/seasonPassService';

interface DebugInfo {
  localStorage: string[];
  nostr: string[];
  merged: string[];
  cacheInfo: {
    hasCache: boolean;
    cacheAge?: number;
    lastEventId?: string;
  };
}

export const SeasonPassDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testPubkey, setTestPubkey] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadDebugInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await enhancedSeasonPassService.getSourceBreakdown();
      setDebugInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debug info');
    } finally {
      setLoading(false);
    }
  };

  const testParticipant = async () => {
    if (!testPubkey.trim()) {
      setTestResult('Please enter a pubkey to test');
      return;
    }

    setLoading(true);
    try {
      const [enhancedResult, localResult] = await Promise.all([
        enhancedSeasonPassService.isParticipant(testPubkey.trim()),
        Promise.resolve(seasonPassService.isParticipant(testPubkey.trim()))
      ]);

      setTestResult(`Enhanced: ${enhancedResult}, Local: ${localResult}`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshNostrCache = async () => {
    setLoading(true);
    try {
      await enhancedSeasonPassService.refreshNostrParticipants();
      await loadDebugInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cache');
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    enhancedSeasonPassService.clearNostrCache();
    loadDebugInfo();
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-secondary p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-text-primary">Season Pass Debug</h3>
        <div className="space-x-2">
          <button
            onClick={loadDebugInfo}
            disabled={loading}
            className="px-3 py-1 bg-primary text-text-primary text-sm rounded hover:bg-primary/80 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={refreshNostrCache}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            Refresh Nostr
          </button>
          <button
            onClick={clearCache}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Clear Cache
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
          <p className="text-text-secondary mt-2">Loading...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded">
          {error}
        </div>
      )}

      {debugInfo && (
        <div className="space-y-4">
          {/* Participant Count Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-bg-tertiary p-3 rounded">
              <h4 className="font-semibold text-text-primary">localStorage</h4>
              <p className="text-2xl font-bold text-blue-400">{debugInfo.localStorage.length}</p>
            </div>
            <div className="bg-bg-tertiary p-3 rounded">
              <h4 className="font-semibold text-text-primary">Nostr</h4>
              <p className="text-2xl font-bold text-green-400">{debugInfo.nostr.length}</p>
            </div>
            <div className="bg-bg-tertiary p-3 rounded">
              <h4 className="font-semibold text-text-primary">Total Unique</h4>
              <p className="text-2xl font-bold text-primary">{debugInfo.merged.length}</p>
            </div>
          </div>

          {/* Cache Info */}
          <div className="bg-bg-tertiary p-3 rounded">
            <h4 className="font-semibold text-text-primary mb-2">Cache Status</h4>
            <div className="text-sm space-y-1">
              <p>Has Cache: <span className={debugInfo.cacheInfo.hasCache ? 'text-green-400' : 'text-red-400'}>
                {debugInfo.cacheInfo.hasCache ? 'Yes' : 'No'}
              </span></p>
              {debugInfo.cacheInfo.cacheAge && (
                <p>Cache Age: <span className="text-text-secondary">
                  {Math.round(debugInfo.cacheInfo.cacheAge / 1000 / 60)} minutes
                </span></p>
              )}
              {debugInfo.cacheInfo.lastEventId && (
                <p>Last Event: <span className="text-text-secondary font-mono text-xs">
                  {debugInfo.cacheInfo.lastEventId.substring(0, 16)}...
                </span></p>
              )}
            </div>
          </div>

          {/* Participant Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-bg-tertiary p-3 rounded">
              <h4 className="font-semibold text-text-primary mb-2">localStorage Participants</h4>
              <div className="max-h-32 overflow-y-auto">
                {debugInfo.localStorage.length === 0 ? (
                  <p className="text-text-secondary text-sm">No local participants</p>
                ) : (
                  debugInfo.localStorage.map(pubkey => (
                    <div key={pubkey} className="text-xs font-mono text-text-secondary mb-1">
                      {pubkey.substring(0, 16)}...
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-bg-tertiary p-3 rounded">
              <h4 className="font-semibold text-text-primary mb-2">Nostr Participants</h4>
              <div className="max-h-32 overflow-y-auto">
                {debugInfo.nostr.length === 0 ? (
                  <p className="text-text-secondary text-sm">No Nostr participants</p>
                ) : (
                  debugInfo.nostr.map(pubkey => (
                    <div key={pubkey} className="text-xs font-mono text-text-secondary mb-1">
                      {pubkey.substring(0, 16)}...
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Test Participant */}
          <div className="bg-bg-tertiary p-3 rounded">
            <h4 className="font-semibold text-text-primary mb-2">Test Participant</h4>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Enter pubkey to test..."
                value={testPubkey}
                onChange={(e) => setTestPubkey(e.target.value)}
                className="flex-1 px-3 py-1 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm"
              />
              <button
                onClick={testParticipant}
                disabled={loading}
                className="px-3 py-1 bg-primary text-text-primary text-sm rounded hover:bg-primary/80 disabled:opacity-50"
              >
                Test
              </button>
            </div>
            {testResult && (
              <p className="text-sm text-text-secondary">{testResult}</p>
            )}
          </div>

          {/* Integration Info */}
          <div className="bg-bg-tertiary p-3 rounded">
            <h4 className="font-semibold text-text-primary mb-2">Integration Details</h4>
            <div className="text-xs space-y-1 font-mono">
              <p>Admin NPUB: <span className="text-green-400">npub17fqk2nfrk2hdaqn4mmw3awshj83f9k0wpky8w5hx3fqym67g3rxqdfsld3</span></p>
              <p>D-Tag: <span className="text-blue-400">runstr-season-1-participants</span></p>
              <p>Kind: <span className="text-yellow-400">30000</span> (NIP-51 List)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 