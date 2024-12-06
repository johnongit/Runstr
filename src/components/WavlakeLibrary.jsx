import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import { WavlakePlayer } from './WavlakePlayer';

export const WavlakeLibrary = ({ npub }) => {
  const [userLibrary, setUserLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);

  const fetchUserLibrary = useCallback(async () => {
    const controller = new AbortController();
    
    try {
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`https://api.wavlake.com/v1/users/${npub}/library`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch user library');
      }
      const data = await response.json();
      setUserLibrary(data);
      setLoading(false);
      console.log('Received library data:', data);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      const errorMessage = 'Failed to load your library. Please try again.';
      setError(errorMessage);
      setLoading(false);
      console.error('Error fetching library:', err);
    }
    
    return () => {
      controller.abort();
    };
  }, [npub]);

  useEffect(() => {
    if (npub) {
      fetchUserLibrary();
    }

    return () => {
      // Cleanup is handled by the AbortController in fetchUserLibrary
    };
  }, [npub, fetchUserLibrary]);

  return (
    <div className="library-container">
      <h2>My Library</h2>
      {loading ? (
        <p>Loading your library...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          {currentTrack && (
            <WavlakePlayer track={currentTrack} />
          )}
          <div className="playlist">
            {userLibrary.map((track, index) => (
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
    </div>
  );
};

WavlakeLibrary.propTypes = {
  npub: PropTypes.string.isRequired
}; 