import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import { getToken } from "nostr-tools/nip98";

const WAVLAKE_API_BASE_URL = "https://api.wavlake.com/v1";

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
        setIsLoading(true);
        setError(null);

        if (!window.nostr) {
          throw new Error('Nostr provider not found');
        }

        const streamUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
        const token = await getToken(
          streamUrl,
          "get",
          async (event) => {
            try {
              const signedEvent = await window.nostr.signEvent(event);
              if (!signedEvent) throw new Error('Failed to sign event');
              return signedEvent;
            } catch (err) {
              throw new Error(`Signing failed: ${err.message}`);
            }
          }
        );

        setAudioUrl(`${streamUrl}?auth=${encodeURIComponent(token)}&format=mp3`);
      } catch (err) {
        console.error('Error setting up audio stream:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (track?.id) {
      setupAudioStream();
    }
  }, [track?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', () => setIsPlaying(false));
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Playback error:', err);
      setError('Playback failed');
    }
  };

  return (
    <div className="wavlake-player">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
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