// Service Worker per AR Mobile Cardboard Experience
// Versione cache
const CACHE_NAME = 'ar-mobile-v1.0.0';
const STATIC_CACHE = 'ar-mobile-static-v1.0.0';
const DYNAMIC_CACHE = 'ar-mobile-dynamic-v1.0.0';

// File da cachare per funzionamento offline
const STATIC_FILES = [
  '/',
  '/index.html',
  '/css/mobile-ar.css',
  '/js/ar-app.js',
  '/js/mobile-utils.js',
  '/manifest.json',
  // CDN files (cached dinamicamente)
];

// File che non devono essere cachati
const EXCLUDE_FROM_CACHE = [
  '/sw.js',
  '/admin',
  '/api'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static files:', error);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Rimuovi cache vecchie
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Intercettazione delle richieste di rete
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Ignora richieste non HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignora file esclusi dalla cache
  if (EXCLUDE_FROM_CACHE.some(path => requestUrl.pathname.includes(path))) {
    return;
  }
  
  // Strategia di caching basata sul tipo di risorsa
  if (requestUrl.pathname.endsWith('.html') || requestUrl.pathname === '/') {
    // HTML: Network First (per aggiornamenti)
    event.respondWith(networkFirstStrategy(event.request));
  } else if (requestUrl.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    // Risorse statiche: Cache First
    event.respondWith(cacheFirstStrategy(event.request));
  } else if (requestUrl.hostname.includes('cdn.jsdelivr.net') || 
             requestUrl.hostname.includes('cdnjs.cloudflare.com')) {
    // CDN: Cache First con fallback
    event.respondWith(cacheFirstStrategy(event.request, DYNAMIC_CACHE));
  } else {
    // Altre richieste: Network First
    event.respondWith(networkFirstStrategy(event.request));
  }
});

// Strategia Cache First
async function cacheFirstStrategy(request, cacheName = STATIC_CACHE) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('Service Worker: Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache solo risposte valide
    if (networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache First error:', error);
    
    // Fallback per risorse critiche
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/index.html');
    }
    
    throw error;
  }
}

// Strategia Network First
async function networkFirstStrategy(request, cacheName = DYNAMIC_CACHE) {
  try {
    console.log('Service Worker: Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache risposte valide
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback per documenti
    if (request.destination === 'document') {
      const staticCache = await caches.open(STATIC_CACHE);
      return staticCache.match('/index.html');
    }
    
    throw error;
  }
}

// Gestione messaggi dal client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0].postMessage({
          version: CACHE_NAME,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        });
        break;
        
      case 'CACHE_STATS':
        getCacheStats().then((stats) => {
          event.ports[0].postMessage(stats);
        });
        break;
    }
  }
});

// Funzioni di utilità
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    stats[cacheName] = {
      count: keys.length,
      urls: keys.map(request => request.url)
    };
  }
  
  return stats;
}

// Gestione errori globali
self.addEventListener('error', (event) => {
  console.error('Service Worker: Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

// Notifica di aggiornamento disponibile
self.addEventListener('controllerchange', () => {
  console.log('Service Worker: Controller changed - new version available');
});

console.log('Service Worker: Loaded successfully');

// Background Sync per richieste offline (se supportato)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
      event.waitUntil(
        // Qui puoi aggiungere logica per sincronizzare dati offline
        Promise.resolve()
      );
    }
  });
}

// Push notifications (se supportate)
if ('push' in self.registration) {
  self.addEventListener('push', (event) => {
    console.log('Service Worker: Push message received');
    
    const options = {
      body: event.data ? event.data.text() : 'Nuova notifica da AR Mobile',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'explore',
          title: 'Apri AR',
          icon: '/icons/icon-72.png'
        },
        {
          action: 'close',
          title: 'Chiudi',
          icon: '/icons/icon-72.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('AR Mobile', options)
    );
  });
  
  self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
      event.waitUntil(
        clients.openWindow('/')
      );
    }
  });
}