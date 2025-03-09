import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function FloatingMusicPlayer() {
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
  
  const [expanded, setExpanded] = useState(false);
  const [showUpcomingTracks, setShowUpcomingTracks] = useState(false);
  const navigate = useNavigate();
  
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
          position: i, // Position relative to current
          index: nextIndex // Actual index in the playlist
        });
      }
    }
    
    return upcomingTracks;
  };
  
  const upcomingTracks = getUpcomingTracks();

  // Handle click on an upcoming track
  const handleTrackClick = (trackIndex) => {
    skipToTrack(trackIndex);
    setShowUpcomingTracks(false);
  };
  
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
              ⏮️
            </button>
            <button onClick={togglePlayPause} className="control-button play-pause">
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button onClick={playNext} className="control-button">
              ⏭️
            </button>
          </div>

          {/* Toggle for upcoming tracks */}
          {upcomingTracks.length > 0 && (
            <div className="upcoming-tracks-toggle">
              <button 
                onClick={() => setShowUpcomingTracks(!showUpcomingTracks)} 
                className="toggle-button"
              >
                {showUpcomingTracks ? 'Hide upcoming' : 'Show upcoming'}
              </button>
            </div>
          )}

          {/* Upcoming tracks section */}
          {showUpcomingTracks && upcomingTracks.length > 0 && (
            <div className="upcoming-tracks-list">
              <ul>
                {upcomingTracks.map((track, index) => (
                  <li 
                    key={index} 
                    className="upcoming-track-item"
                    onClick={() => handleTrackClick(track.index)}
                  >
                    <span className="track-position">{track.position}.</span>
                    <span className="track-name">{track.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="floating-player-collapsed" onClick={() => setExpanded(true)}>
          <span className="now-playing-indicator">{isPlaying ? '▶️' : '⏸️'}</span>
          <span className="track-title-small">{currentTrack.title}</span>
        </div>
      )}
    </div>
  );
} 