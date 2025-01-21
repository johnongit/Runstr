const CACHE_NAME = 'nostr-run-club-v1';

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    })
  );
});

// Store location data for sync
let pendingLocations = [];

function syncLocationData() {
  return Promise.all(pendingLocations.map(location => 
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'LOCATION_UPDATE',
          position: location
        });
      });
    })
  )).then(() => {
    pendingLocations = [];
  });
}

// Background Sync for Location Updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'syncLocation') {
    event.waitUntil(syncLocationData());
  }
});

// Handle Location Updates in Background
let watchId = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_TRACKING') {
    startLocationTracking();
  } else if (event.data.type === 'STOP_TRACKING') {
    stopLocationTracking();
  }
});

function startLocationTracking() {
  if (!watchId && 'geolocation' in self) {
    watchId = self.registration.backgroundFetch.watchPosition(
      (position) => {
        // Store position for sync if clients are not available
        pendingLocations.push(position);
        // Send location update to all clients
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'LOCATION_UPDATE',
              position: {
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  speed: position.coords.speed
                },
                timestamp: position.timestamp
              }
            });
          });
        });
      },
      (error) => {
        console.error('Background location error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000
      }
    );
  }
}

function stopLocationTracking() {
  if (watchId) {
    self.registration.backgroundFetch.clearWatch(watchId);
    watchId = null;
  }
}

// Keep alive
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      // Perform minimal work to keep service worker alive
      Promise.resolve()
    );
  }
}); 