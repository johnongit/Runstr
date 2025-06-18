import { useState, useEffect, useContext } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import styles from '../assets/styles/AudioPlayer.module.css';
import { NostrContext } from '../contexts/NostrContext';
import WavlakeZap from './WavlakeZap';

export function MusicPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious,
    skipToTrack,
    playlist,
    currentTrackIndex
  } = useAudioPlayer();
  
  const { defaultZapAmount } = useContext(NostrContext);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [zapStatus, setZapStatus] = useState({ loading: false, success: false, error: null });

  // Reset error when track changes
  useEffect(() => {
    setErrorMessage('');
    setShowErrorMessage(false);
    setZapStatus({ loading: false, success: false, error: null });
  }, [currentTrack]);

  // Error handling function
  const handlePlaybackError = (error) => {
    console.error('Playback error:', error);
    const message = typeof error === 'string' ? error : 'Error playing track';
    setErrorMessage(message);
    setShowErrorMessage(true);
    // Hide error after 5 seconds
    setTimeout(() => setShowErrorMessage(false), 5000);
  };

  // Attempt to play and catch errors
  const safeTogglePlay = () => {
    try {
      togglePlayPause();
    } catch (error) {
      handlePlaybackError(error);
    }
  };

  // Handle zap success
  const handleZapSuccess = (/* result */) => {
    setZapStatus({
      loading: false,
      success: true,
      error: null
    });
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setZapStatus(prev => ({
        ...prev,
        success: false
      }));
    }, 3000);
  };

  // Handle zap error
  const handleZapError = (error) => {
    console.error('Zap error:', error);
    setZapStatus({
      loading: false,
      success: false,
      error: error.message || 'Failed to send zap'
    });
    
    // Hide error message after 5 seconds
    setTimeout(() => {
      setZapStatus(prev => ({
        ...prev,
        error: null
      }));
    }, 5000);
  };

  if (!currentTrack) return null;

  // Calculate upcoming tracks (next 3 tracks after current one)
  const getUpcomingTracks = () => {
    if (!playlist || !playlist.tracks) return [];
    
    const upcomingTracks = [];
    const totalTracks = playlist.tracks.length;
    
    // Get up to 3 upcoming tracks
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentTrackIndex + i) % totalTracks;
      if (nextIndex !== currentTrackIndex) { // Avoid adding current track if playlist has only one track
        upcomingTracks.push({
          ...playlist.tracks[nextIndex],
          position: nextIndex + 1, // 1-based position for display
          index: nextIndex // Actual index in the playlist for skipping
        });
      }
    }
    
    return upcomingTracks;
  };
  
  const upcomingTracks = getUpcomingTracks();

  // Handle click on an upcoming track
  const handleTrackClick = (trackIndex) => {
    skipToTrack(trackIndex);
  };

  return (
    <div className={styles.container}>
      {/* Error message display */}
      {showErrorMessage && errorMessage && (
        <div className={styles.errorMessage}>
          {errorMessage}
        </div>
      )}
      
      {/* Zap status messages */}
      {zapStatus.error && (
        <div className={styles.zapError}>
          {zapStatus.error}
        </div>
      )}
      {zapStatus.success && (
        <div className={styles.zapSuccess}>
          Successfully sent {defaultZapAmount} sats to {currentTrack.artist || 'the artist'}! ⚡️
        </div>
      )}
      
      <div className={styles.title}>
        <p>Selected Playlist: {playlist?.title || 'Unknown'}</p>
      </div>
      <div className={styles.controls}>
        <button onClick={playPrevious} className={`${styles.controlButton} music-control-button`}>
          <span className="unicode-icon text-xl font-bold select-none">⏮</span>
        </button>
        <button onClick={safeTogglePlay} className={`${styles.controlButton} music-control-button`}>
          <span className="unicode-icon text-xl font-bold select-none">
            {isPlaying ? '⏸' : '▶'}
          </span>
        </button>
        <button onClick={playNext} className={`${styles.controlButton} music-control-button`}>
          <span className="unicode-icon text-xl font-bold select-none">⏭</span>
        </button>
        <WavlakeZap 
          trackId={currentTrack.id}
          amount={defaultZapAmount}
          buttonClass={`${styles.controlButton} ${styles.zapButton}`}
          buttonText=""
          onSuccess={handleZapSuccess}
          onError={handleZapError}
        />
      </div>
      <div className={styles.nowPlaying}>
        <p>Now playing: {currentTrack.title} - {currentTrack.artist || 'Unknown Artist'}</p>
      </div>
      
      {/* Upcoming tracks section */}
      {upcomingTracks.length > 0 && (
        <div className={styles.upcomingTracks}>
          <h3>Coming Up Next:</h3>
          <ul className={styles.tracksList}>
            {upcomingTracks.map((track, index) => (
              <li 
                key={index} 
                className={styles.trackItem}
                onClick={() => handleTrackClick(track.index)}
              >
                <span className={styles.trackNumber}>{track.position}.</span>
                <span className={styles.trackTitle}>{track.title}</span>
                <span className={styles.trackArtist}>{track.artist || 'Unknown Artist'}</span>
                <span className={styles.playIcon}>
                  <span className="unicode-icon text-sm font-bold select-none">▶</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 