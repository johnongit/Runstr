import { useReducer, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { AudioPlayerContext, initialState, audioReducer } from './audioPlayerContext';
import { fetchPlaylist, LIKED, WAVLAKE_API_BASE_URL } from '../utils/wavlake';
import { nip98 } from 'nostr-tools';

// Lazy load the audio player to improve initial page load time
const ReactAudioPlayer = lazy(() => import('react-h5-audio-player').then(module => {
  // Also import the CSS only when the component is loaded
  import('react-h5-audio-player/lib/styles.css');
  return module;
}));

export const AudioPlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  
  // Local state for playlist and current track
  const [playlist, setPlaylist] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioPlayerRef, setAudioPlayerRef] = useState(null);
  const [audioPlayerLoaded, setAudioPlayerLoaded] = useState(false);
  const [currentBlobUrl, setCurrentBlobUrl] = useState(null);

  // Helper function to get a playable URL for a track
  const getPlayableUrlForTrack = useCallback(async (track, currentPlaylistId) => {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      setCurrentBlobUrl(null);
    }

    // Handle Blossom tracks - they already have direct mediaUrl
    if (track && track.source === 'blossom') {
      console.log(`[AudioPlayerProvider] Using direct Blossom URL: ${track.mediaUrl}`);
      return track.mediaUrl;
    }

    if (currentPlaylistId === LIKED && track && track.id) {
      const targetStreamUrl = `${WAVLAKE_API_BASE_URL}/stream/track/${track.id}`;
      console.log(`[AudioPlayerProvider] Fetching liked track stream from: ${targetStreamUrl}`);

      if (!window.nostr || typeof window.nostr.signEvent !== 'function') {
        const errorMsg = 'Nostr extension not available or signEvent is not a function.';
        console.error(`[AudioPlayerProvider] ${errorMsg}`);
        alert(errorMsg);
        return null;
      }

      try {
        const authToken = await nip98.getToken(
          targetStreamUrl,
          'get',
          (event) => window.nostr.signEvent(event),
          true
        );

        if (!authToken) {
          throw new Error('Failed to get auth token for stream.');
        }

        const response = await fetch(targetStreamUrl, {
          headers: { Authorization: authToken },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream fetch failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
        }
        
        const audioBlob = await response.blob();
        const newBlobUrl = URL.createObjectURL(audioBlob);
        setCurrentBlobUrl(newBlobUrl);
        console.log(`[AudioPlayerProvider] Created blob URL for liked track: ${newBlobUrl}`);
        return newBlobUrl;
      } catch (error) {
        console.error(`[AudioPlayerProvider] Error getting playable URL for liked track ${track.id}:`, error);
        alert(`Could not load stream for ${track.title || 'track'}: ${error.message}`);
        return null;
      }
    }
    return track ? track.mediaUrl : null;
  }, [currentBlobUrl]);

  // Load playlist when playlist ID changes or when a playlist object is passed directly
  const loadPlaylist = useCallback(async (playlistIdOrObject, directPlaylist = null) => {
    try {
      let fetchedPlaylist;
      
      // If directPlaylist is provided, use it (for Blossom)
      if (directPlaylist) {
        console.log(`[AudioPlayerProvider] Loading direct playlist: ${directPlaylist.title}`);
        fetchedPlaylist = directPlaylist;
      } else {
        // Otherwise, fetch from WavLake API
        console.log(`[AudioPlayerProvider] Loading playlist: ${playlistIdOrObject}`);
        fetchedPlaylist = await fetchPlaylist(playlistIdOrObject);
      }
      
      if (!fetchedPlaylist) {
        console.error(`[AudioPlayerProvider] Playlist not found: ${playlistIdOrObject}`);
        alert(`Could not load playlist: Playlist not found`);
        return;
      }
      
      if (!fetchedPlaylist.tracks || !Array.isArray(fetchedPlaylist.tracks)) {
        console.error(`[AudioPlayerProvider] Invalid playlist format: ${playlistIdOrObject}`, fetchedPlaylist);
        alert(`Could not load playlist: Invalid playlist format`);
        return;
      }
      
      if (fetchedPlaylist.tracks.length === 0) {
        console.warn(`[AudioPlayerProvider] Playlist is empty: ${playlistIdOrObject}`);
        alert(`This playlist is empty`);
        setPlaylist(null);
        dispatch({ type: 'SET_TRACK', payload: null });
        return;
      }
      
      console.log(`[AudioPlayerProvider] Playlist loaded: ${fetchedPlaylist.title} (${fetchedPlaylist.tracks.length} tracks)`);
      
      setPlaylist(fetchedPlaylist);
      setCurrentTrackIndex(0);
      
      const firstTrack = fetchedPlaylist.tracks[0];
      const playableMediaUrl = await getPlayableUrlForTrack(firstTrack, fetchedPlaylist.id);
      
      if (!playableMediaUrl) {
        console.error(`[AudioPlayerProvider] First track missing playable media URL:`, firstTrack);
        dispatch({ type: 'SET_TRACK', payload: null });
        return;
      }
      
      dispatch({ type: 'SET_TRACK', payload: { ...firstTrack, mediaUrl: playableMediaUrl } });
      setAudioPlayerLoaded(true);
    } catch (error) {
      console.error('[AudioPlayerProvider] Error loading playlist:', error);
      alert(`Failed to load playlist: ${error.message}`);
      dispatch({ type: 'SET_TRACK', payload: null });
    }
  }, [getPlayableUrlForTrack]);

  // Update current track when currentTrackIndex or playlist changes
  useEffect(() => {
    const updateTrack = async () => {
      if (playlist && playlist.tracks && playlist.tracks.length > 0 && currentTrackIndex < playlist.tracks.length) {
        const newTrack = playlist.tracks[currentTrackIndex];
        const playableUrl = await getPlayableUrlForTrack(newTrack, playlist.id);

        if (playableUrl) {
          dispatch({ type: 'SET_TRACK', payload: { ...newTrack, mediaUrl: playableUrl } });
          if (state.isPlaying && audioPlayerRef?.audio?.current && audioPlayerRef.audio.current.src !== playableUrl) {
            setTimeout(() => {
              audioPlayerRef.audio.current.load();
              audioPlayerRef.audio.current?.play().catch(e => console.log('[AudioPlayerProvider] Auto-play on track change prevented:', e));
            }, 100);
          }
        } else {
          dispatch({ type: 'SET_TRACK', payload: null });
        }
      } else if (playlist && playlist.tracks && playlist.tracks.length === 0) {
        dispatch({ type: 'SET_TRACK', payload: null });
        setPlaylist(null);
      }
    };
    updateTrack();
  }, [currentTrackIndex, playlist, getPlayableUrlForTrack, state.isPlaying, audioPlayerRef]);

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
      const currentTime = audioPlayerRef?.audio?.current?.currentTime || 0;
      const RESTART_THRESHOLD = 3;
      
      if (currentTime <= RESTART_THRESHOLD && currentTrackIndex > 0) {
        setCurrentTrackIndex((current) => (current > 0 ? current - 1 : 0));
      } else {
        if (audioPlayerRef?.audio?.current) {
          audioPlayerRef.audio.current.currentTime = 0;
          if (!state.isPlaying) {
            dispatch({ type: 'PLAY' });
            setTimeout(() => audioPlayerRef.audio.current?.play().catch(e => console.log('[AudioPlayerProvider] Play on restart prevented:', e)), 50);
          }
        }
      }
    }
  }, [playlist, audioPlayerRef, currentTrackIndex, state.isPlaying, dispatch]);

  // Skip to a specific track by index
  const skipToTrack = useCallback(async (trackIndex) => {
    if (playlist && playlist.tracks && trackIndex >= 0 && trackIndex < playlist.tracks.length) {
      setCurrentTrackIndex(trackIndex);
      if (!state.isPlaying) {
        dispatch({ type: 'PLAY' }); 
      }
    }
  }, [playlist, dispatch, state.isPlaying]);

  // Play/pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!state.currentTrack || !state.currentTrack.mediaUrl) {
      console.warn("[AudioPlayerProvider] No current track to play/pause or mediaUrl missing.");
      if (playlist && playlist.tracks && playlist.tracks.length > 0 && !state.currentTrack) {
        const firstTrack = playlist.tracks[0];
        const playableMediaUrl = await getPlayableUrlForTrack(firstTrack, playlist.id);
        if (playableMediaUrl) {
          dispatch({ type: 'SET_TRACK', payload: { ...firstTrack, mediaUrl: playableMediaUrl } });
          setAudioPlayerLoaded(true);
          dispatch({ type: 'PLAY' });
          setTimeout(() => audioPlayerRef?.audio?.current?.play().catch(e => console.warn('[AudioPlayerProvider] Play on toggle (initial load) prevented:', e)), 100);
        }
      }
      return;
    }

    if (!audioPlayerLoaded) {
      setAudioPlayerLoaded(true);
      dispatch({ type: 'PLAY' });
      setTimeout(() => {
         audioPlayerRef?.audio?.current?.play().catch(e => console.warn('[AudioPlayerProvider] Play on toggle (deferred load) prevented:', e));
      }, 250);
      return;
    }

    if (state.isPlaying) {
      audioPlayerRef?.audio?.current?.pause();
      dispatch({ type: 'PAUSE' });
    } else {
      audioPlayerRef?.audio?.current?.play().catch(e => console.warn('[AudioPlayerProvider] Play on toggle prevented:', e));
      dispatch({ type: 'PLAY' });
    }
  }, [state.isPlaying, state.currentTrack, audioPlayerRef, dispatch, audioPlayerLoaded, playlist, getPlayableUrlForTrack]);

  // Handle track ended event
  const handleTrackEnded = useCallback(() => {
    setTimeout(() => {
      playNext();
      if (!state.isPlaying) {
        dispatch({ type: 'PLAY' });
      }
    }, 50);
  }, [playNext, dispatch, state.isPlaying]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        console.log('[AudioPlayerProvider] Revoked Blob URL on unmount:', currentBlobUrl);
      }
    };
  }, [currentBlobUrl]);

  return (
    <AudioPlayerContext.Provider
      value={{
        ...state,
        dispatch,
        loadPlaylist,
        playNext,
        playPrevious,
        skipToTrack,
        togglePlayPause,
        playlist,
        currentTrackIndex,
        setAudioPlayerRef
      }}
    >
      {children}
      {state.currentTrack && state.currentTrack.mediaUrl && audioPlayerLoaded && (
        <div className="global-audio-player" style={{ display: 'none' }}>
          <Suspense fallback={<div>Loading player...</div>}>
            <ReactAudioPlayer
              ref={setAudioPlayerRef}
              autoPlay={state.isPlaying}
              src={state.currentTrack.mediaUrl}
              onClickNext={playNext}
              onClickPrevious={playPrevious}
              onEnded={handleTrackEnded}
              onError={(e) => console.error('[AudioPlayerProvider] ReactAudioPlayer error:', e)}
              onCanPlay={() => {
                if (state.isPlaying && audioPlayerRef?.audio?.current) {
                   audioPlayerRef.audio.current.play().catch(err => console.warn("Error playing onCanPlay:", err));
                }
              }}
              showJumpControls={false}
              showSkipControls
            />
          </Suspense>
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 