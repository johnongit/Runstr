import { useState, useEffect, useContext } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import styles from '../assets/styles/AudioPlayer.module.css';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { getLnurlForTrack } from '../utils/wavlake';

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
  const { wallet } = useAuth();
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

  // Handle zap function - sends Bitcoin to the artist
  const handleZapArtist = async () => {
    if (!currentTrack) return;
    if (!wallet || !wallet.isEnabled()) {
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: 'Wallet not connected. Please connect a Lightning wallet in your settings.' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
      return;
    }
    
    try {
      setZapStatus({ loading: true, success: false, error: null });

      // Get the LNURL for the current track
      const lnurl = await getLnurlForTrack(currentTrack.id);
      
      // If wallet doesn't support direct LNURL handling, fetch the invoice
      // For this implementation, we assume the wallet supports LNURL
      await wallet.sendPayment(lnurl);
      
      setZapStatus({ 
        loading: false, 
        success: true, 
        error: null 
      });
      
      // Clear success message after a few seconds
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
    } catch (error) {
      console.error('Error zapping artist:', error);
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: typeof error === 'string' ? error : error.message || 'Failed to zap artist.' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
    }
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
      {zapStatus.loading && (
        <div className={styles.zapMessage}>
          Sending {defaultZapAmount} sats to {currentTrack.artist || 'the artist'}...
        </div>
      )}
      {zapStatus.success && (
        <div className={styles.zapSuccess}>
          Successfully sent {defaultZapAmount} sats to {currentTrack.artist || 'the artist'}! ⚡️
        </div>
      )}
      {zapStatus.error && (
        <div className={styles.zapError}>
          {zapStatus.error}
        </div>
      )}
      
      <div className={styles.title}>
        <p>Selected Playlist: {playlist?.title || 'Unknown'}</p>
        <p>Selected Track: {currentTrack.title}</p>
      </div>
      <div className={styles.controls}>
        <button onClick={playPrevious} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-prev"></div>
            <span className={styles.buttonText}>Previous</span>
          </div>
        </button>
        <button onClick={safeTogglePlay} className={styles.controlButton}>
          <div className="icon-container">
            {isPlaying ? 
              <>
                <div className="icon-pause"></div>
                <span className={styles.buttonText}>Pause</span>
              </> : 
              <>
                <div className="icon-play"></div>
                <span className={styles.buttonText}>Play</span>
              </>
            }
          </div>
        </button>
        <button onClick={playNext} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-next"></div>
            <span className={styles.buttonText}>Next</span>
          </div>
        </button>
        <button onClick={handleZapArtist} className={`${styles.controlButton} ${styles.zapButton}`} disabled={zapStatus.loading}>
          <div className="icon-container">
            <div className="icon-zap">⚡</div>
            <span className={styles.buttonText}>Zap</span>
          </div>
        </button>
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
                  <div className="mini-icon-play"></div>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 