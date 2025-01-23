import { SimplePool } from 'nostr-tools';

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.bg'
];

let loggedInUser = null;

const pool = new SimplePool();

export const checkAmberInstalled = () => {
  // Check if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Check if running on Android
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS || isAndroid) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2500);

      window.addEventListener('blur', () => {
        clearTimeout(timeout);
        resolve(true);
      }, { once: true });
    });
  }
  return Promise.resolve(true);
};

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

export const signInWithNostr = async () => {
  const json = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    content: "Login to Running App",
    tags: []
  };

  const encodedJson = encodeURIComponent(JSON.stringify(json));
  const callbackUrl = encodeURIComponent(`${window.location.origin}/login?event=`);
  
  // Check device type
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  
  // URLs for different protocols
  const customSchemeUrl = `nostrsigner:${encodedJson}?compressionType=none&returnType=signature&type=sign_event&callbackUrl=${callbackUrl}`;
  const universalLinkUrl = `https://amber.nostr.app/sign?json=${encodedJson}&callbackUrl=${callbackUrl}`;

  // Track if app was opened
  let appOpened = false;
  
  try {
    if (isMobile) {
      // Try custom scheme first on mobile
      window.location.href = customSchemeUrl;
      
      // Set up visibility change detection
      const visibilityHandler = () => {
        if (document.hidden) {
          appOpened = true;
        }
      };
      
      document.addEventListener('visibilitychange', visibilityHandler);
      
      // Wait for app to open or timeout
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          document.removeEventListener('visibilitychange', visibilityHandler);
          if (!appOpened) {
            // Try universal link as fallback
            window.location.href = universalLinkUrl;
            // Give universal link some time to work
            setTimeout(resolve, 1000);
          } else {
            resolve();
          }
        }, 1500);
        
        // If app opens before timeout, resolve immediately
        const earlyResolve = () => {
          if (appOpened) {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', visibilityHandler);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', earlyResolve);
      });
    } else {
      // On desktop, try universal link first
      window.location.href = universalLinkUrl;
      
      // Fallback to custom scheme after a delay
      await new Promise(resolve => {
        setTimeout(() => {
          if (!document.hidden) {
            window.location.href = customSchemeUrl;
          }
          resolve();
        }, 1500);
      });
    }
  } catch (error) {
    console.error('Error during Nostr login:', error);
    throw new Error('Failed to open Amber. Please make sure it is installed.');
  }
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

export { loggedInUser, fetchUserProfile }; 