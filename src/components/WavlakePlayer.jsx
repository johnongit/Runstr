import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';

// Use proxy for local development
const API_BASE_URL = '/api/v1';

export const WavlakePlayer = ({ track }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const setupInProgressRef = useRef(false);

  // Effect for audio event listeners
  useEffect(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e) => {
      if (audio.src) {
        console.error('Audio playback error:', e);
        console.error('Audio error details:', {
          error: audio.error?.message || 'Unknown error',
          code: audio.error?.code,
          networkState: audio.networkState,
          readyState: audio.readyState,
          currentSrc: audio.currentSrc
        });
        setError('Playback failed: ' + (audio.error?.message || 'Unknown error'));
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Effect for track changes
  useEffect(() => {
    const setupAudio = async () => {
      if (setupInProgressRef.current) {
        console.log('Setup already in progress, skipping');
        return;
      }

      try {
        setupInProgressRef.current = true;
        setIsLoading(true);
        setError(null);
        setIsPlaying(false);

        // Create stream URL directly
        const streamUrl = `${API_BASE_URL}/tracks/${track.id}/stream`;
        console.log('Using stream URL:', streamUrl);

        // Create a new Audio instance
        const newAudio = new Audio();
        newAudio.preload = 'auto';
        newAudio.crossOrigin = 'anonymous';
        
        // Wait for audio to be ready with timeout
        await Promise.race([
          new Promise((resolve, reject) => {
            const handleCanPlay = () => {
              console.log('Audio can play');
              resolve();
            };
            
            const handleError = () => {
              reject(new Error('Failed to load audio'));
            };

            newAudio.addEventListener('canplay', handleCanPlay, { once: true });
            newAudio.addEventListener('error', handleError, { once: true });
            
            newAudio.src = streamUrl;
            newAudio.load();
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Audio load timeout')), 15000)
          )
        ]);

        audioRef.current = newAudio;
        console.log('Audio setup complete');
      } catch (err) {
        console.error('Setup error:', {
          message: err.message,
          type: err.name,
          trackId: track.id,
          url: `${API_BASE_URL}/tracks/${track.id}/stream`
        });
        setError(err.message || 'Failed to setup audio');
      } finally {
        setIsLoading(false);
        setupInProgressRef.current = false;
      }
    };

    if (track?.id) {
      setupAudio();
    }

    return () => {
      const currentAudio = audioRef.current;
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio.load();
        audioRef.current = null;
      }
      setIsPlaying(false);
    };
  }, [track]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio?.src || isLoading) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        setError(null);
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error('Playback error:', err);
      setError('Playback failed: ' + (err.message || 'Unknown error'));
      setIsPlaying(false);
    }
  };

  return (
    <div className="wavlake-player">
      <div className="track-info">
        <h3>{track.title}</h3>
        <p>{track.artist}</p>
        {error && <p className="error-message">{error}</p>}
      </div>
      <div className="player-controls">
        <button 
          onClick={togglePlay} 
          className="play-button"
          disabled={isLoading || error || !audioRef.current?.src}
        >
          {isLoading ? '⌛' : isPlaying ? '⏸️' : '▶️'}
        </button>
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

WavlakePlayer.propTypes = {
  track: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired
  }).isRequired
}; 