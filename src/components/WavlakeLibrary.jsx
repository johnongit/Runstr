import { useState, useEffect } from 'react';
import { WavlakePlayer } from './WavlakePlayer';
import { fetchLikedPlaylist } from '../utils/wavlake';

export const WavlakeLibrary = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const likedPlaylist = await fetchLikedPlaylist();
        setPlaylists([likedPlaylist]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching library:', err);
        setError('Failed to load your library. Please try again.');
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  const handlePlaylistClick = (playlistId) => {
    setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
  };

  return (
    <div className="library-container">
      <h1>Library</h1>
      {loading ? (
        <p>Loading your library...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          {currentTrack && <WavlakePlayer track={currentTrack} />}
          <div className="playlists-grid">
            {playlists.map(playlist => (
              <div key={playlist.id}>
                <div 
                  className="playlist-card" 
                  onClick={() => handlePlaylistClick(playlist.id)}
                >
                  <div className="playlist-artwork">
                    <div className="artwork-grid">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="artwork-placeholder">
                          {playlist.tracks?.[index]?.artwork && (
                            <img 
                              src={playlist.tracks[index].artwork} 
                              alt="" 
                              className="artwork-image"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="playlist-info">
                    <h3>{playlist.title}</h3>
                    <p>{playlist.tracks?.length || 0} tracks</p>
                    {playlist.isPrivate && (
                      <p className="private-note">Private (must be logged in with nip-07 ext to play)</p>
                    )}
                  </div>
                </div>

                {expandedPlaylist === playlist.id && (
                  <div className="track-list">
                    {playlist.tracks?.map(track => (
                      <div 
                        key={track.id} 
                        className="track-item"
                        onClick={() => setCurrentTrack(track)}
                      >
                        <img 
                          src={track.artwork} 
                          alt="" 
                          className="track-artwork"
                        />
                        <div className="track-info">
                          <h4>{track.title}</h4>
                          <p>{track.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}; 