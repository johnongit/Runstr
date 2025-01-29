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
export const pool = isBrowser ? new SimplePool() : null;

// Initialize pool connections
if (pool) {
  console.log('Initializing Nostr pool connections...');
  RELAYS.forEach(async (relay) => {
    try {
      await pool.ensureRelay(relay);
      console.log(`Connected to relay: ${relay}`);
    } catch (err) {
      console.warn(`Failed to connect to relay ${relay}:`, err);
    }
  });
}

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
  if (!isBrowser) {
    console.error('Not in browser environment');
    return null;
  }
  
  if (!event) {
    console.error('No event provided');
    return null;
  }
  
  if (!pool) {
    console.error('Nostr pool not initialized');
    return null;
  }
  
  try {
    if (!window.nostr) {
      console.error('Nostr provider not found. Please ensure you are logged in.');
      throw new Error('Nostr provider not found');
    }

    console.log('Publishing event:', event);
    const signedEvent = await window.nostr.signEvent(event);
    console.log('Event signed:', signedEvent);

    const connectedRelays = Array.from(pool.relays.values())
      .filter(relay => relay.status === 1)
      .map(relay => relay.url);
    
    if (connectedRelays.length === 0) {
      throw new Error('No relays connected. Please try again.');
    }

    console.log('Publishing to relays:', connectedRelays);
    const pubs = pool.publish(connectedRelays, signedEvent);
    
    // Wait for at least 2 relays to confirm publication
    const pub = await Promise.any([
      Promise.all(pubs.slice(0, 2)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Publication timeout')), 10000))
    ]);
    
    console.log('Publication successful:', pub);
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
    tags: [['client', 'Nostr Run Club']]
  };

  const encodedJson = encodeURIComponent(JSON.stringify(json));
  const callbackUrl = encodeURIComponent(`${window.location.origin}/login?event=`);
  
  const userAgent = getUserAgent();
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;

  // URLs for different signing methods
  const amberSchemeUrl = `nostrsigner:${encodedJson}?compressionType=none&returnType=signature&type=sign_event&callbackUrl=${callbackUrl}`;
  const amberUniversalUrl = `https://amber.nostr.app/sign?json=${encodedJson}&callbackUrl=${callbackUrl}`;
  const snortUrl = `https://snort.social/sign?json=${encodedJson}&callbackUrl=${callbackUrl}`;
  
  // Check if NIP-07 extension is available
  if (window.nostr) {
    try {
      const pubkey = await window.nostr.getPublicKey();
      if (pubkey) {
        console.log('NIP-07 extension found and working');
        return { pubkey };
      }
    } catch (err) {
      console.warn('NIP-07 extension found but not working:', err);
    }
  }

  // Try to detect installed signers
  const hasAmber = await checkAmberInstalled();
  console.log('Amber signer detected:', hasAmber);

  let signerAttempted = false;

  if (isMobile) {
    if (hasAmber) {
      signerAttempted = true;
      try {
        // Try Amber custom scheme first
        window.location.href = amberSchemeUrl;
        
        // Wait to see if app opens
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (!document.hidden) {
              // If app didn't open, try universal link
              window.location.href = amberUniversalUrl;
            }
            resolve();
          }, 1500);

          // If page is hidden, app probably opened
          const visibilityHandler = () => {
            if (document.hidden) {
              clearTimeout(timeout);
              resolve();
            }
          };
          document.addEventListener('visibilitychange', visibilityHandler, { once: true });
        });
      } catch (err) {
        console.warn('Amber signer attempt failed:', err);
      }
    }

    // If Amber didn't work or isn't installed, try Snort
    if (!signerAttempted || document.visibilityState !== 'hidden') {
      window.location.href = snortUrl;
    }
  } else {
    // For desktop, show options dialog
    const signerChoice = await showSignerDialog();
    switch (signerChoice) {
      case 'extension':
        window.open('https://getalby.com', '_blank');
        break;
      case 'amber':
        window.location.href = amberUniversalUrl;
        break;
      case 'snort':
        window.location.href = snortUrl;
        break;
      default:
        throw new Error('Please select a signing method');
    }
  }
};

// Helper function to show signer options dialog
const showSignerDialog = () => {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin-top: 0;">Choose Your Nostr Signer</h3>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button onclick="this.parentElement.dataset.choice='extension'" style="padding: 10px;">
          Install Browser Extension (recommended)
        </button>
        <button onclick="this.parentElement.dataset.choice='amber'" style="padding: 10px;">
          Use Amber Web Signer
        </button>
        <button onclick="this.parentElement.dataset.choice='snort'" style="padding: 10px;">
          Use Snort Web Signer
        </button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const buttons = dialog.getElementsByTagName('button');
    Array.from(buttons).forEach(button => {
      button.addEventListener('click', (e) => {
        const choice = e.target.parentElement.dataset.choice;
        document.body.removeChild(dialog);
        document.body.removeChild(overlay);
        resolve(choice);
      });
    });
  });
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