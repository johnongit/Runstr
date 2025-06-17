import { useEffect, useMemo, useRef, useState, useContext } from 'react';
import {
  fetchLibraryPlaylists,
  fetchTop40,
  fetchTrendingHipHop,
  fetchTrendingRock
} from '../utils/wavlake';
import { PlaylistSection } from '../components/PlaylistSection';
import { MusicPlayer } from '../components/MusicPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSettings } from '../contexts/SettingsContext';
import { NostrContext } from '../contexts/NostrContext';
import { getAllTracks, getTracksFromServer, DEFAULT_SERVERS, setDebugCallback } from '../lib/blossom';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export function Music() {
  const hasMounted = useRef(false);
  const { loadPlaylist, currentTrack } = useAudioPlayer();
  const { blossomEndpoint } = useSettings();
  const { publicKey, ndk } = useContext(NostrContext);

  const [pubkey, setPubkey] = useState(null);

  const [top40, setTop40] = useState();
  const [trendingRockPlaylist, setTrendingRockPlaylist] = useState();
  const [trendingHipHopPlaylist, setTrendingHipHopPlaylist] = useState();

  const [libraryPlaylists, setLibraryPlaylists] = useState();
  
  // Blossom-related state
  const [blossomTracks, setBlossomTracks] = useState([]);
  const [blossomLoading, setBlossomLoading] = useState(false);
  const [blossomError, setBlossomError] = useState(null);
  
  // Debug logging removed for production

  useEffect(() => {
    window.nostr
      .getPublicKey()
      .then((pk) => {
        setPubkey(pk);
      })
      .catch((err) => {
        console.error(err);
      });

    const handleAuthEvent = (event) => {
      if (event.detail.type === 'login') {
        setPubkey(event.detail.pubkey);
      }

      if (event.detail.type === 'logout') {
        setPubkey(null);
      }
    };

    document.addEventListener('nlAuth', handleAuthEvent);

    return () => {
      document.removeEventListener('nlAuth', handleAuthEvent);
    };
  }, []);

  useEffect(() => {
    if (hasMounted.current) return;

    hasMounted.current = true;

    fetchTop40()
      .then((playlist) => {
        setTop40(playlist);
      })
      .catch((err) => {
        console.error('top40 error: ', err);
      });

    fetchTrendingRock()
      .then((playlist) => {
        setTrendingRockPlaylist(playlist);
      })
      .catch((err) => {
        console.error('trending rock error: ', err);
      });

    fetchTrendingHipHop()
      .then((playlist) => {
        setTrendingHipHopPlaylist(playlist);
      })
      .catch((err) => {
        console.error('trending hiphop error: ', err);
      });
  }, []);

  useEffect(() => {
    if (pubkey) {
      fetchLibraryPlaylists(pubkey)
        .then((playlists) => {
          setLibraryPlaylists(playlists);
          console.log('library playlists :>> ', playlists);
        })
        .catch((err) => {
          console.error('error fetching library playlists', err);
        });
    } else {
      setLibraryPlaylists();
    }
  }, [pubkey]);

  // Load Blossom tracks when server URL is available
  useEffect(() => {
    const loadBlossomTracks = async () => {
      if (!pubkey) return;
      
      setBlossomLoading(true);
      setBlossomError(null);

      try {
        let tracks = [];
        
        if (blossomEndpoint && blossomEndpoint !== '') {
          // Load tracks from specific server
          tracks = await getTracksFromServer(blossomEndpoint, pubkey);
        } else {
          // Load tracks from all default servers
          tracks = await getAllTracks(DEFAULT_SERVERS, pubkey);
        }
        
        setBlossomTracks(tracks);
        
      } catch (error) {
        console.error('[Music] Error loading tracks:', error);
        const errorMsg = `Error loading tracks: ${error.message}`;
        setBlossomError(errorMsg);
        setBlossomTracks([]);
      } finally {
        setBlossomLoading(false);
      }
    };

    loadBlossomTracks();
  }, [blossomEndpoint, pubkey]);

  const handleSelectPlaylist = (playlistId) => {
    loadPlaylist(playlistId);
  };

  const handleSelectBlossomLibrary = () => {
    // Create a virtual playlist for Blossom tracks
    const blossomPlaylist = {
      id: 'blossom',
      title: 'My Blossom Library',
      tracks: blossomTracks
    };
    
    // Load the Blossom playlist using the new signature
    loadPlaylist('blossom', blossomPlaylist);
  };

  const trendingPlaylists = useMemo(
    () =>
      [top40, trendingRockPlaylist, trendingHipHopPlaylist].filter(
        (pl) => pl !== undefined
      ),
    [top40, trendingRockPlaylist, trendingHipHopPlaylist]
  );

  const userPlaylists = useMemo(() => {
    const playlists = [];
    if (libraryPlaylists) playlists.push(...libraryPlaylists);

    return playlists;
  }, [libraryPlaylists]);

  // Create a virtual playlist object for Blossom library
  const blossomPlaylistDisplay = useMemo(() => {
    if (blossomTracks.length === 0) return [];
    
    // Helper function to get playlist name from server URL
    const getPlaylistNameFromServer = (serverUrl) => {
      if (!serverUrl || serverUrl === '') {
        return 'Blossom Music Library';
      }
      
      // Find the server in DEFAULT_SERVERS
      const server = DEFAULT_SERVERS.find(s => s.url === serverUrl);
      if (server) {
        // Convert server names to playlist format
        if (server.url.includes('satellite.earth')) {
          return 'Satellite.Earth Playlist';
        } else if (server.url.includes('blossom.band')) {
          return 'Blossom.Band Playlist';
        } else if (server.url.includes('primal')) {
          return 'Primal.Band Playlist';
        } else {
          return `${server.name} Playlist`;
        }
      }
      
      // For custom servers, try to extract domain name
      try {
        const domain = new URL(serverUrl).hostname;
        return `${domain} Playlist`;
      } catch {
        return 'Blossom Music Library';
      }
    };
    
    const playlistTitle = getPlaylistNameFromServer(blossomEndpoint);
    const description = blossomEndpoint && blossomEndpoint !== '' 
      ? `${blossomTracks.length} tracks from ${blossomEndpoint}`
      : `${blossomTracks.length} tracks from Blossom servers`;
    
    return [{
      id: 'blossom',
      title: playlistTitle,
      description: description,
      tracks: blossomTracks
    }];
  }, [blossomEndpoint, blossomTracks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="page-title mb-8 text-center">Music</h1>
        


        {currentTrack && <MusicPlayer />}

        <PlaylistSection
          title="Trending"
          playlists={trendingPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
        
        {/* Blossom Library Section */}
        <div className="mb-8">
          <h2 className="section-heading mb-4 text-left">
            Blossom Library
          </h2>
          {blossomLoading && (
            <div className="text-gray-400 text-left mb-4">
              {blossomEndpoint && blossomEndpoint !== '' 
                ? `Loading tracks from ${blossomEndpoint}...`
                : 'Searching for audio tracks across Blossom servers...'
              }
            </div>
          )}
          {blossomError && (
            <div className="text-red-400 text-left mb-4">
              Error loading tracks: {blossomError}
            </div>
          )}
          {!blossomLoading && !blossomError && blossomTracks.length === 0 && (
            <div className="text-gray-400 text-left mb-4">
              {blossomEndpoint && blossomEndpoint !== '' 
                ? `No audio files found on ${blossomEndpoint}.`
                : 'No audio files found on Blossom servers. Try uploading some audio files to your Blossom server or check the console for detailed logs.'
              }
            </div>
          )}
          {blossomPlaylistDisplay.length > 0 && (
            <PlaylistSection
              title=""
              playlists={blossomPlaylistDisplay}
              handlePlaylistClick={handleSelectBlossomLibrary}
            />
          )}
        </div>
        
        <PlaylistSection
          title="Library"
          playlists={userPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
      </div>
    </div>
  );
}
