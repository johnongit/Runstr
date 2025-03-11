import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function FloatingMusicPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious
  } = useAudioPlayer();
  
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  
  if (!currentTrack) return null;

  return (
    <div className={`floating-player ${expanded ? 'expanded' : 'collapsed'}`}>
      {expanded ? (
        <div className="floating-player-expanded">
          <div className="floating-player-header">
            <button onClick={() => setExpanded(false)} className="collapse-button">
              ▼ Minimize
            </button>
            <button onClick={() => navigate('/music')} className="music-page-button">
              Go to Music Page
            </button>
          </div>
          <div className="track-info">
            <p className="track-title">{currentTrack.title}</p>
            <p className="track-artist">{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
          <div className="player-controls">
            <button onClick={playPrevious} className="control-button">
              <div className="icon-container">
                <div className="icon-prev"></div>
              </div>
            </button>
            <button onClick={togglePlayPause} className="control-button play-pause">
              <div className="icon-container">
                {isPlaying ? <div className="icon-pause"></div> : <div className="icon-play"></div>}
              </div>
            </button>
            <button onClick={playNext} className="control-button">
              <div className="icon-container">
                <div className="icon-next"></div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="floating-player-collapsed" onClick={() => setExpanded(true)}>
          <span className="now-playing-indicator">
            <div className="icon-container">
              {isPlaying ? <div className="mini-icon-pause"></div> : <div className="mini-icon-play"></div>}
            </div>
          </span>
          <span className="track-title-small">{currentTrack.title}</span>
        </div>
      )}
    </div>
  );
} 