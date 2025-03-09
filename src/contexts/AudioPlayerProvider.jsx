import { useReducer, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AudioPlayerContext, initialState, audioReducer } from './audioPlayerContext';
import { fetchPlaylist } from '../utils/wavlake';
import ReactAudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

export const AudioPlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  
  // Local state for playlist and current track
  const [playlist, setPlaylist] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioPlayerRef, setAudioPlayerRef] = useState(null);

  // Load playlist when playlist ID changes
  const loadPlaylist = async (playlistId) => {
    try {
      const fetchedPlaylist = await fetchPlaylist(playlistId);
      setPlaylist(fetchedPlaylist);
      setCurrentTrackIndex(0);
      if (fetchedPlaylist.tracks && fetchedPlaylist.tracks.length > 0) {
        dispatch({ type: 'SET_TRACK', payload: fetchedPlaylist.tracks[0] });
        dispatch({ type: 'PLAY' });
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  };

  // Update current track when currentTrackIndex changes
  useEffect(() => {
    if (playlist && playlist.tracks && playlist.tracks.length > 0) {
      dispatch({ type: 'SET_TRACK', payload: playlist.tracks[currentTrackIndex] });
      // If we're not on the first track, and a track is already playing, 
      // keep playing when we change tracks
      if (state.isPlaying) {
        // Small timeout to ensure the new track is loaded before playing
        setTimeout(() => {
          audioPlayerRef?.audio?.current?.play().catch(e => console.log('Auto-play prevented:', e));
        }, 100);
      }
    }
  }, [currentTrackIndex, playlist, state.isPlaying, audioPlayerRef]);

  // Play next track
  const playNext = useCallback(() => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) =>
        current < playlist.tracks.length - 1 ? current + 1 : 0
      );
    }
  }, [playlist]);

  // Play previous track
  const playPrevious = useCallback(() => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) => (current > 0 ? current - 1 : 0));
    }
  }, [playlist]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      dispatch({ type: 'PAUSE' });
      audioPlayerRef?.audio?.current?.pause();
    } else {
      dispatch({ type: 'PLAY' });
      audioPlayerRef?.audio?.current?.play().catch(e => console.log('Play prevented:', e));
    }
  }, [state.isPlaying, audioPlayerRef, dispatch]);

  // Handle track ended event
  const handleTrackEnded = useCallback(() => {
    // Set a small timeout to ensure state updates properly
    setTimeout(() => {
      playNext();
      dispatch({ type: 'PLAY' });
    }, 50);
  }, [playNext, dispatch]);

  return (
    <AudioPlayerContext.Provider
      value={{
        ...state,
        dispatch,
        loadPlaylist,
        playNext,
        playPrevious,
        togglePlayPause,
        playlist,
        currentTrackIndex,
        setAudioPlayerRef
      }}
    >
      {children}
      {state.currentTrack && (
        <div className="global-audio-player" style={{ display: 'none' }}>
          <ReactAudioPlayer
            ref={setAudioPlayerRef}
            autoPlay={state.isPlaying}
            src={state.currentTrack.mediaUrl}
            onClickNext={playNext}
            onClickPrevious={playPrevious}
            onEnded={handleTrackEnded}
            onPlay={() => dispatch({ type: 'PLAY' })}
            onPause={() => dispatch({ type: 'PAUSE' })}
            showJumpControls={false}
            showSkipControls
          />
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 