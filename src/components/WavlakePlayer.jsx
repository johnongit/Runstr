import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import { getToken } from "nostr-tools/nip98";

const WAVLAKE_API_BASE_URL = "https://api.wavlake.com/v1";
// eslint-disable-next-line no-unused-vars
const WAVLAKE_CATALOG_API_BASE_URL = "https://catalog.wavlake.com/v1";

export const WavlakePlayer = ({ track }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    const setupAudioStream = async () => {
      try {
        const streamUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
        const token = await getToken(
          streamUrl,
          "get",
          (event) => window.nostr.signEvent(event),
          true
        );

        setAudioUrl(`${streamUrl}.mp3?auth=${encodeURIComponent(token)}&format=mp3`);
      } catch (err) {
        console.error('Error setting up audio stream:', err);
        setError('Failed to initialize audio stream');
      }
    };

    setupAudioStream();
  }, [track.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadstart', () => setIsLoading(true));
      audio.addEventListener('canplay', () => setIsLoading(false));
      audio.addEventListener('error', handleError);
      
      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('loadstart', () => setIsLoading(true));
        audio.removeEventListener('canplay', () => setIsLoading(false));
        audio.removeEventListener('error', handleError);
      };
    }
  }, []);

  const handleError = () => {
    setError('Failed to load audio. Please try again.');
    setIsPlaying(false);
    setIsLoading(false);
  };

  const updateProgress = () => {
    if (audioRef.current) {
      const value = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(value);
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          await audioRef.current.pause();
        } else {
          setError(null);
          await audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (err) {
        console.error('Playback error:', err);
        setError('Failed to play audio. Please try again.');
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="wavlake-player">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <div className="track-info">
        <h3>{track.title}</h3>
        <p>{track.artist}</p>
        {error && <p className="error-message">{error}</p>}
      </div>
      <div className="player-controls">
        <button 
          onClick={togglePlay} 
          className="play-button"
          disabled={isLoading || !audioUrl}
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