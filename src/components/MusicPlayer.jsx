import { useAudioPlayer } from '../hooks/useAudioPlayer';
import styles from '../assets/styles/AudioPlayer.module.css';

export function MusicPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious, 
    playlist 
  } = useAudioPlayer();

  if (!currentTrack) return null;

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <p>Selected Playlist: {playlist?.title || 'Unknown'}</p>
        <p>Selected Track: {currentTrack.title}</p>
      </div>
      <div className={styles.controls}>
        <button onClick={playPrevious} className={styles.controlButton}>
          ⏮️ Previous
        </button>
        <button onClick={togglePlayPause} className={styles.controlButton}>
          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        </button>
        <button onClick={playNext} className={styles.controlButton}>
          ⏭️ Next
        </button>
      </div>
      <div className={styles.nowPlaying}>
        <p>Now playing: {currentTrack.title} - {currentTrack.artist || 'Unknown Artist'}</p>
      </div>
    </div>
  );
} 