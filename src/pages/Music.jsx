import { useState, useEffect } from 'react';
import { WavlakePlayer } from '../components/WavlakePlayer';
import { WavlakeLibrary } from '../components/WavlakeLibrary';

export const Music = () => {
  const [top40Tracks, setTop40Tracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [activeTab, setActiveTab] = useState('top40');
  const [npub, setNpub] = useState(null);

  const fetchTop40Tracks = async () => {
    const controller = new AbortController();
    
    try {
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://api.wavlake.com/v1/tracks/top?limit=40', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTop40Tracks(data);
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      const errorMessage = 'Unable to load tracks at this time. Please try again later.';
      setError(errorMessage);
      setLoading(false);
      console.error('Error fetching tracks:', err);
    }
    
    return () => {
      controller.abort();
    };
  };

  useEffect(() => {
    fetchTop40Tracks();
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeMusic = async () => {
      if (window.nostr) {
        const userPubkey = await window.nostr.getPublicKey();
        if (mounted) {
          setNpub(userPubkey);
        }
      }
    };

    initializeMusic();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="music-container">
      <div className="music-tabs">
        <button 
          className={`tab-button ${activeTab === 'top40' ? 'active' : ''}`}
          onClick={() => setActiveTab('top40')}
        >
          Top 40
        </button>
        <button 
          className={`tab-button ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          My Library
        </button>
      </div>

      {activeTab === 'top40' ? (
        <>
          <h2>Wavlake Top 40</h2>
          {loading ? (
            <p>Loading playlist...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : (
            <>
              {currentTrack && (
                <WavlakePlayer track={currentTrack} />
              )}
              <div className="playlist">
                {top40Tracks.map((track, index) => (
                  <div 
                    key={track.id} 
                    className="track-item"
                    onClick={() => setCurrentTrack(track)}
                  >
                    <span className="track-number">{index + 1}</span>
                    <div className="track-info">
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        npub ? (
          <WavlakeLibrary npub={npub} />
        ) : (
          <div className="login-prompt">
            <p>Please login with Nostr to view your library</p>
          </div>
        )
      )}
    </div>
  );
}; 