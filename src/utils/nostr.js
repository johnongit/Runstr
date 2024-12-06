import { SimplePool } from 'nostr-tools';

let loggedInUser = null;
const pool = new SimplePool();

const RELAYS = [
  'wss://purplepag.es',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://nostrelites.org',
  'wss://wot.utxo.one'
];


export const publishToNostr = async (event) => {
  if (!event) return null;
  
  try {
    const signedEvent = await window.nostr.signEvent(event);
    const pubs = pool.publish(RELAYS, signedEvent);
    
    // Wait for at least 3 relays to confirm publication
    const pub = await Promise.any([
      Promise.all(pubs.slice(0, 3)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    return pub;
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
    throw error;
  }
};

const signInWithNostr = () => {
  const json = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    content: "Login to Running App",
    tags: []
  };

  const encodedJson = encodeURIComponent(JSON.stringify(json));
  const callbackUrl = `${window.location.origin}/login?event=`;
  
  // Add a small delay to ensure the app switch works properly on mobile
  setTimeout(() => {
    // Try to use universal links first
    window.location.href = `https://amber.nostr.app/sign?json=${encodedJson}&callbackUrl=${callbackUrl}`;
    
    // Fallback to custom scheme after a short delay if universal link doesn't work
    setTimeout(() => {
      window.location.href = `nostrsigner:${encodedJson}?compressionType=none&returnType=signature&type=sign_event&callbackUrl=${callbackUrl}`;
    }, 500);
  }, 100);
};

export const handleNostrCallback = async (eventParam) => {
  if (!eventParam) return null;
  try {
    const event = JSON.parse(decodeURIComponent(eventParam));
    loggedInUser = event.pubkey;
    
    // Fetch user profile after successful login
    const profile = await fetchUserProfile(event.pubkey);
    return { event, profile };
  } catch (error) {
    console.error('Error parsing Nostr event:', error);
    return null;
  }
};

async function fetchUserProfile(pubkey) {
  try {
    const response = await fetch(`https://api.nostr.band/v0/profiles/${pubkey}`);
    const data = await response.json();
    
    if (data && data.profiles && data.profiles.length > 0) {
      const profile = data.profiles[0];
      return {
        pubkey,
        name: profile.name || 'Unknown',
        about: profile.about || '',
        banner: profile.banner || '',
        picture: profile.picture || '',
      };
    }
    
    return {
      pubkey,
      name: 'Unknown',
      about: '',
      banner: '',
      picture: '',
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return {
      pubkey,
      name: 'Unknown',
      about: '',
      banner: '',
      picture: '',
    };
  }
}

export { loggedInUser, RELAYS, signInWithNostr, fetchUserProfile }; 