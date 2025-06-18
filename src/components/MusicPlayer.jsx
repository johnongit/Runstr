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
        <button onClick={playPrevious} className={styles.controlButton}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>
        <button onClick={safeTogglePlay} className={styles.controlButton}>
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
            </svg>
          )}
        </button>
        <button onClick={playNext} className={styles.controlButton}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 