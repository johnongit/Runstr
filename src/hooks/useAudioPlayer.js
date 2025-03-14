import { useContext } from 'react';
<<<<<<< HEAD
import { AudioContext } from '../contexts/audioContext';

export function useAudioPlayer() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error(
      'useAudioPlayer must be used within an AudioPlayerProvider'
    );
  }
  return context;
}
=======
import { AudioPlayerContext } from '../contexts/audioPlayerContext';

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  
  return context;
};
>>>>>>> Simple-updates
