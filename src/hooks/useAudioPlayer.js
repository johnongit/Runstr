import { useContext } from 'react';
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
