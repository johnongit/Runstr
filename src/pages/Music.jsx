import { useState, useEffect } from 'react';
import { WavlakeLibrary } from '../components/WavlakeLibrary';

export const Music = () => {
  const [npub, setNpub] = useState(null);

  useEffect(() => {
    const initializeMusic = async () => {
      if (window.nostr) {
        try {
          const userPubkey = await window.nostr.getPublicKey();
          setNpub(userPubkey);
        } catch (err) {
          console.error('Error getting public key:', err);
        }
      }
    };

    initializeMusic();
  }, []);

  return (
    <div className="music-container">
      {npub ? (
        <WavlakeLibrary npub={npub} />
      ) : (
        <div className="login-prompt">
          <p>Please login with Nostr to view your library</p>
        </div>
      )}
    </div>
  );
}; 