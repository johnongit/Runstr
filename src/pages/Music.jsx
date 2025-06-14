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
import { listTracks } from '../lib/blossom';
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

  // Load Blossom tracks when server URL and pubkey are available
  useEffect(() => {
    const loadBlossomTracks = async () => {
      if (!blossomEndpoint || !publicKey || !ndk?.signer) {
        setBlossomTracks([]);
        setBlossomError(null);
        return;
      }

      setBlossomLoading(true);
      setBlossomError(null);

      try {
        console.log('[Music] Loading Blossom tracks from:', blossomEndpoint);
        
        // Create a sign function that works with our NDK signer
        const signEvent = async (eventTemplate) => {
          if (!ndk.signer || typeof ndk.signer.sign !== 'function') {
            throw new Error('No signer available');
          }
          
          console.log('[Music] Signing NIP-98 event template:', eventTemplate);
          
          // Don't modify the event template - nip98.getToken creates the correct structure
          // Just ensure pubkey is set if missing
          const nip98EventTemplate = {
            ...eventTemplate,
            pubkey: eventTemplate.pubkey || publicKey,
          };
          
          console.log('[Music] Using NIP-98 event template as-is:', nip98EventTemplate);
          
          // Create a proper NDK event and sign it
          const ndkEvent = new NDKEvent(ndk, nip98EventTemplate);
          await ndkEvent.sign();
          
          const signedEvent = ndkEvent.rawEvent();
          console.log('[Music] Signed NIP-98 event:', signedEvent);
          
          // Return the raw event object that NIP-98 expects
          return signedEvent;
        };

        const tracks = await listTracks(blossomEndpoint, publicKey, signEvent);
        setBlossomTracks(tracks);
        console.log(`[Music] Loaded ${tracks.length} Blossom tracks`);
        
      } catch (error) {
        console.error('[Music] Error loading Blossom tracks:', error);
        setBlossomError(error.message);
        setBlossomTracks([]);
      } finally {
        setBlossomLoading(false);
      }
    };

    loadBlossomTracks();
  }, [blossomEndpoint, publicKey, ndk?.signer]);

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
    if (!blossomEndpoint || blossomTracks.length === 0) return [];
    
    return [{
      id: 'blossom',
      title: 'My Blossom Library',
      description: `${blossomTracks.length} tracks from your Blossom server`,
      tracks: blossomTracks
    }];
  }, [blossomEndpoint, blossomTracks]);

  return (
    <div className="container text-center py-12">
      <h1 className="text-2xl font-bold mb-4">WAVLAKE</h1>
      <div className="bg-[#1a1a1a] rounded-lg p-4 sm:p-8 w-full mx-auto">
        {currentTrack && <MusicPlayer />}

        <PlaylistSection
          title="Trending"
          playlists={trendingPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
        
        {/* Blossom Library Section */}
        {blossomEndpoint && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-left">My Blossom Library</h2>
            {blossomLoading && (
              <div className="text-gray-400 text-left mb-4">
                Loading tracks from your Blossom server...
              </div>
            )}
            {blossomError && (
              <div className="text-red-400 text-left mb-4">
                Error loading Blossom tracks: {blossomError}
              </div>
            )}
            {!blossomLoading && !blossomError && blossomTracks.length === 0 && (
              <div className="text-gray-400 text-left mb-4">
                No audio files found on your Blossom server.
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
        )}
        
        <PlaylistSection
          title="Library"
          playlists={userPlaylists}
          handlePlaylistClick={handleSelectPlaylist}
        />
      </div>
    </div>
  );
}
