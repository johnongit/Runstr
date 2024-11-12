import { useState, useEffect } from 'react';

export const Music = () => {
  const [top40Tracks, setTop40Tracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTop40Tracks();
  }, []);

  const fetchTop40Tracks = async () => {
    try {
      const response = await fetch('https://api.wavlake.com/v1/tracks/top?limit=40');
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }
      const data = await response.json();
      setTop40Tracks(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load playlist');
      setLoading(false);
      console.error('Error fetching tracks:', err);
    }
  };

  return (
    <div className="music-container">
      <h2>Wavlake Top 40</h2>
      {loading ? (
        <p>Loading playlist...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <div className="playlist">
          {top40Tracks.map((track, index) => (
            <div key={track.id} className="track-item">
              <span className="track-number">{index + 1}</span>
              <div className="track-info">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
              <div className="track-controls">
                <button onClick={() => window.open(`https://wavlake.com/track/${track.id}`, '_blank')}>
                  Play on Wavlake
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 