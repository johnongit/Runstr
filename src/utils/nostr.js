import { SimplePool } from 'nostr-tools';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.bg'
];

// Export loggedInUser as a let variable
export let loggedInUser = null;

// Only create pool in browser environment
const pool = isBrowser ? new SimplePool() : null;

// Helper to check user agent
const getUserAgent = () => {
  if (!isBrowser) return '';
  return navigator.userAgent || '';
};

export const checkAmberInstalled = () => {
  if (!isBrowser) return Promise.resolve(false);

  const userAgent = getUserAgent();
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  
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

// Export fetchUserProfile as a const
export const fetchUserProfile = async (pubkey) => {
  if (!pubkey) return null;
  
  try {
    const response = await fetch(`https://api.nostr.band/v0/profiles/${pubkey}`);
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
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
};

export const publishToNostr = async (event) => {
  if (!isBrowser) return null;
  if (!event || !pool) return null;
  
  try {
    if (!window.nostr) {
      throw new Error('Nostr provider not found');
    }

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
  if (!isBrowser) return;

  const json = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    content: "Login to Running App",
    tags: []
  };

  const encodedJson = encodeURIComponent(JSON.stringify(json));
  const callbackUrl = encodeURIComponent(`${window.location.origin}/login?event=`);
  
  const userAgent = getUserAgent();
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  
  const customSchemeUrl = `nostrsigner:${encodedJson}?compressionType=none&returnType=signature&type=sign_event&callbackUrl=${callbackUrl}`;
  const universalLinkUrl = `https://amber.nostr.app/sign?json=${encodedJson}&callbackUrl=${callbackUrl}`;

  let appOpened = false;
  
  try {
    if (isMobile) {
      window.location.href = customSchemeUrl;
      
      const visibilityHandler = () => {
        if (document.hidden) {
          appOpened = true;
        }
      };
      
      document.addEventListener('visibilitychange', visibilityHandler);
      
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          document.removeEventListener('visibilitychange', visibilityHandler);
          if (!appOpened) {
            window.location.href = universalLinkUrl;
            setTimeout(resolve, 1000);
          } else {
            resolve();
          }
        }, 1500);
        
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
      window.location.href = universalLinkUrl;
      
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
  if (!isBrowser || !eventParam) return null;
  
  try {
    const event = JSON.parse(decodeURIComponent(eventParam));
    if (!event || !event.pubkey) {
      throw new Error('Invalid event data');
    }
    
    loggedInUser = event.pubkey;
    const profile = await fetchUserProfile(event.pubkey);
    return { event, profile };
  } catch (error) {
    console.error('Error parsing Nostr event:', error);
    return null;
  }
}; 