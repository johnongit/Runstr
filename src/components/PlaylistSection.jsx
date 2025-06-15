import styles from '../assets/styles/PlaylistSection.module.css';
import PropTypes from 'prop-types';

export const PlaylistSection = ({ title, playlists, handlePlaylistClick }) => {
  
  // Helper function to check if playlist is from Blossom (no artwork URLs)
  const isBlossomPlaylist = (playlist) => {
    if (!playlist.tracks || playlist.tracks.length === 0) return false;
    // Check if tracks have source: 'blossom' or if they lack artworkUrl/albumArtUrl
    return playlist.tracks.some(track => 
      track.source === 'blossom' || 
      (!track.artworkUrl && !track.albumArtUrl)
    );
  };

  // Create bouquet placeholder component
  const BlossomBouquetPlaceholder = () => (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '40px',
      borderRadius: '4px'
    }}>
      🌸
    </div>
  );

  return (
    <div className={styles.playlistSection}>
      <h2>{title}</h2>
      <div className={styles.playlistsContainer}>
        {playlists.map(({ id, title: playlistTitle, tracks, isPrivate }) => (
          <div
            key={id}
            className={styles.playlist}
            onClick={() => handlePlaylistClick(id)}
          >
            <div className={styles.playlistArt}>
              {isBlossomPlaylist({ tracks }) ? (
                <BlossomBouquetPlaceholder />
              ) : (
                tracks
                  .slice(0, 4)
                  .map(({ id, artworkUrl, albumArtUrl, title: trackTitle }) => (
                    <img
                      key={id}
                      src={artworkUrl ?? albumArtUrl}
                      alt={`${trackTitle} art`}
                      width={500}
                      height={500}
                    />
                  ))
              )}
            </div>
            <div className={styles.playlistMetadata}>
              <p>{playlistTitle}</p>
              <p>{tracks.length} tracks</p>
              {isPrivate && (
                <small>Private (must be logged in with to play)</small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

PlaylistSection.propTypes = {
  title: PropTypes.string.isRequired,
  playlists: PropTypes.array.isRequired,
  handlePlaylistClick: PropTypes.func.isRequired
};
