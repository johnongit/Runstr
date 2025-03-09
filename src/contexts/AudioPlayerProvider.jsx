import { useReducer, useState, useEffect } from 'react';
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
    }
  }, [currentTrackIndex, playlist]);

  // Play next track
  const playNext = () => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) =>
        current < playlist.tracks.length - 1 ? current + 1 : 0
      );
    }
  };

  // Play previous track
  const playPrevious = () => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) => (current > 0 ? current - 1 : 0));
    }
  };

  // Play/pause toggle
  const togglePlayPause = () => {
    if (state.isPlaying) {
      dispatch({ type: 'PAUSE' });
      audioPlayerRef?.audio?.current?.pause();
    } else {
      dispatch({ type: 'PLAY' });
      audioPlayerRef?.audio?.current?.play();
    }
  };

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
            onEnded={playNext}
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